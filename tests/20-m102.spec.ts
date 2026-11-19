import { test, expect } from '@playwright/test';
import { waitForAppReady, dismissInfoDialog, dismissCompatibilityWarning } from './helpers/app';

test.describe.serial('M102 support', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);
    await dismissCompatibilityWarning(page);
    await dismissInfoDialog(page);
  });

  test('appears as a selectable printer model', async ({ page }) => {
    await page.click('#print-settings-btn');
    await expect(page.locator('#print-settings-dialog')).toBeVisible();

    const option = page.locator('#printer-model option[value="m102"]');
    await expect(option).toHaveCount(1);
    await expect(option).toHaveText(/M102 \(48mm\)/);

    await page.locator('#printer-model').selectOption('m102');
    await expect(page.locator('#printer-model')).toHaveValue('m102');
  });

  test('auto-detects M102 geometry', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const p = await import('/printer.js?v=135');
      await p.loadPrinterDefinitions();
      return {
        recognized: p.isDeviceRecognized('M102'),
        isM102: p.isM102Printer('M102', 'auto'),
        width: p.getPrinterWidthBytes('M102', 'auto'),
        dpi: p.getPrinterDpi('M102', 'auto'),
        description: p.getPrinterDescription('M102', 'auto'),
        manualWidth: p.getPrinterWidthBytes('', 'm102'),
        cloneRecognized: p.isDeviceRecognized('Q485E66Q9530019'),
        cloneIsM102: p.isM102Printer('Q485E66Q9530019', 'auto'),
        alignment: p.getPrinterAlignment('Q485E66Q9530019', 'auto'),
      };
    });

    expect(result).toEqual({
      recognized: true,
      isM102: true,
      width: 48,
      dpi: 203,
      description: 'M102 (48mm)',
      manualWidth: 48,
      cloneRecognized: true,
      cloneIsM102: true,
      alignment: 'right',
    });
  });

  test('uses the M102 Print Master command sequence', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const p = await import('/printer.js?v=135');
      await p.loadPrinterDefinitions();

      const chunks: Uint8Array[] = [];
      const transport: any = {
        withExclusive: (fn: () => Promise<void>) => fn(),
        send: async (bytes: Uint8Array) => { chunks.push(new Uint8Array(bytes)); },
        delay: async () => {},
      };

      const raster = new Uint8Array(48 * 10);
      raster[0] = 0xff;
      raster[raster.length - 1] = 0xaa;

      await p.print(
        transport,
        { data: raster, widthBytes: 48, heightLines: 10 },
        { isBLE: true, deviceName: 'M102', printerModel: 'auto', density: 6, feed: 32 },
      );

      const total = chunks.reduce((n, chunk) => n + chunk.length, 0);
      const out = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
      }

      const hex = [...out].map((b) => b.toString(16).padStart(2, '0')).join(' ');
      return {
        prefix: hex.slice(0, 65),
        total,
        hasM110Footer: hex.includes('1f f0'),
        topByte: out[22],
        shiftedByte: out[22 + 5 * 48],
        lastByte: out[out.length - 1],
      };
    });

    expect(result.prefix).toBe(
      '1f 11 02 0b 1f 11 23 05 1b 40 1f 11 21 01 1d 76 30 00 30 00 0f 00',
    );
    expect(result.total).toBe(22 + 48 * 15);
    expect(result.hasM110Footer).toBe(false);
    expect(result.topByte).toBe(0);
    expect(result.shiftedByte).toBe(0xff);
    expect(result.lastByte).toBe(0xaa);
  });

  test('rejects a raster that is not 384 dots wide', async ({ page }) => {
    const message = await page.evaluate(async () => {
      const p = await import('/printer.js?v=135');
      await p.loadPrinterDefinitions();
      const transport: any = {
        withExclusive: (fn: () => Promise<void>) => fn(),
        send: async () => {},
        delay: async () => {},
      };

      try {
        await p.print(
          transport,
          { data: new Uint8Array(54 * 2), widthBytes: 54, heightLines: 2 },
          { isBLE: true, deviceName: 'M102', printerModel: 'auto' },
        );
        return 'no error';
      } catch (e: any) {
        return e.message;
      }
    });

    expect(message).toContain('M102 expects 48 bytes per row');
  });
});
