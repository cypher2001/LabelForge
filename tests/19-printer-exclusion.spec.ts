import { test, expect } from '@playwright/test';

/**
 * A printer has one write characteristic and no framing, so anything sent
 * while raster data is streaming is read as more raster data. Connecting
 * schedules a status query 500ms later, which is why it was the first label
 * after pairing that came out garbled, and only ever the first.
 *
 * These run against the real modules with the BLE I/O stubbed out, so they
 * exercise the actual locking in ble.js and printer.js.
 */
test.describe.serial('Printer exclusive access', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  /** Run a print and a status query at once; return the order of the writes */
  const racePrintAgainstQuery = (page: any) => page.evaluate(async () => {
    const { BLETransport } = await import('/ble.js?v=105');
    const { print } = await import('/printer.js?v=135');

    const t: any = new BLETransport();
    t.connected = true;
    t.isConnected = () => true;
    t.delay = () => new Promise(r => setTimeout(r, 0));   // keep the test quick

    const log: string[] = [];
    t.send = async () => { log.push('print'); await new Promise(r => setTimeout(r, 0)); };
    t.query = async () => { log.push('QUERY'); await new Promise(r => setTimeout(r, 0)); };

    const raster = { data: new Uint8Array(64), widthBytes: 8, heightLines: 8 };

    // Exactly the collision: a print starting while the post-connect query runs
    await Promise.all([
      print(t, raster, { isBLE: true, deviceName: '', printerModel: 'auto' }),
      t.queryAll(),
    ]);
    return log;
  });

  test('a status query never lands in the middle of a print', async ({ page }) => {
    const log = await racePrintAgainstQuery(page);

    expect(log).toContain('print');
    expect(log).toContain('QUERY');

    // The whole point: no query between the first and last byte of the job
    const first = log.indexOf('print');
    const last = log.lastIndexOf('print');
    const queriesInside = log.slice(first, last).filter(x => x === 'QUERY');
    expect(queriesInside).toEqual([]);
  });

  test('the two run one after the other, not interleaved', async ({ page }) => {
    const log = await racePrintAgainstQuery(page);

    // Each operation occupies one unbroken run of the log
    const runs: string[] = [];
    for (const entry of log) if (runs[runs.length - 1] !== entry) runs.push(entry);
    expect(runs.length).toBe(2);
  });

  test('withExclusive serialises callers and survives one of them throwing', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { BLETransport } = await import('/ble.js?v=105');
      const t: any = new BLETransport();
      const log: string[] = [];

      const job = (name: string, fail = false) => t.withExclusive(async () => {
        log.push(`${name}:start`);
        await new Promise(r => setTimeout(r, 5));
        log.push(`${name}:end`);
        if (fail) throw new Error('boom');
      });

      const failed = job('a', true).then(() => 'resolved', () => 'rejected');
      const after = job('b');
      await Promise.all([failed, after]);

      // A rejected holder must release the lock, not strand everyone behind it
      return { log, failed: await failed };
    });

    expect(result.failed).toBe('rejected');
    expect(result.log).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });
});
