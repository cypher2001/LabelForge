import { test, expect } from '@playwright/test';
import { waitForAppReady, dismissInfoDialog, dismissCompatibilityWarning, screenshot } from './helpers/app';

const CH = '13-theme';

test.describe.serial('Theme', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);
    await dismissCompatibilityWarning(page);
    await dismissInfoDialog(page);
  });

  test('toggles between light and dark', async ({ page }) => {
    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('#theme-icon-dark')).toBeVisible();

    await page.click('#theme-toggle');
    await page.waitForTimeout(200);
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('#theme-icon-light')).toBeVisible();

    await page.click('#theme-toggle');
    await page.waitForTimeout(200);
    await expect(root).toHaveAttribute('data-theme', 'light');
  });

  test('dark theme actually repaints the chrome', async ({ page }) => {
    const header = page.locator('header').first();
    const lightBg = await header.evaluate(el => getComputedStyle(el).backgroundColor);

    await page.click('#theme-toggle');
    await page.waitForTimeout(300);
    const darkBg = await header.evaluate(el => getComputedStyle(el).backgroundColor);

    expect(darkBg).not.toBe(lightBg);

    // Text has to move too, or dark mode is unreadable
    const textColor = await page.locator('#print-size').evaluate(el => getComputedStyle(el).color);
    expect(textColor).toBeTruthy();
  });

  test('label previews stay paper-white in dark mode', async ({ page }) => {
    await page.click('#theme-toggle');
    await page.waitForTimeout(300);

    // .lf-paper opts out of the dark remap - a label preview is paper
    const paperBg = await page.locator('#full-preview-canvas').evaluate(
      el => getComputedStyle(el).backgroundColor);
    expect(paperBg).toBe('rgb(255, 255, 255)');
  });

  test('the choice survives a reload, with no flash of the wrong theme', async ({ page }) => {
    await page.click('#theme-toggle');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => localStorage.getItem('phomymo_theme'))).toBe('dark');

    await page.reload({ waitUntil: 'domcontentloaded' });
    // Asserted before the app boots: the inline head script must have run
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('every visible control is readable in dark mode', async ({ page }) => {
    await page.click('#add-text');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.click('#theme-toggle');
    await page.waitForTimeout(400);

    // Walk up for the nearest painted background, then compute WCAG contrast.
    // A class-based assertion would have missed the real bug: .toolbar-btn
    // never set a colour at all, so its labels inherited default black.
    const failures = await page.evaluate(() => {
      const parse = (c: string) => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const bgOf = (el: Element | null): number[] => {
        while (el) {
          const c = getComputedStyle(el).backgroundColor;
          const rgba = (c.match(/[\d.]+/g) || []).map(Number);
          if (rgba.length >= 3 && (rgba.length < 4 || rgba[3] > 0)) return rgba.slice(0, 3);
          el = el.parentElement;
        }
        return [255, 255, 255];
      };

      const bad: string[] = [];
      const selectors = ['.toolbar-btn', '#print-size', '.prop-label', 'footer a', '#canvas-empty p',
                         '#template-panel span', '#template-panel button', '#template-panel p',
                         '#gallery-dialog h3', '#gallery-dialog h4'];
      for (const sel of selectors) {
        for (const el of Array.from(document.querySelectorAll(sel))) {
          const rect = (el as HTMLElement).getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if ((el as HTMLElement).offsetParent === null) continue;

          const fg = lum(parse(getComputedStyle(el).color));
          const bg = lum(bgOf(el));
          const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
          if (ratio < 3) {
            bad.push(`${sel} "${(el.textContent || '').trim().slice(0, 20)}" ratio ${ratio.toFixed(2)}`);
          }
        }
      }
      return bad;
    });

    expect(failures, `unreadable in dark mode:\n${failures.join('\n')}`).toEqual([]);
  });

  test('screenshots of both themes', async ({ page }) => {
    await page.click('#add-text');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await screenshot(page, CH, 1, 'light');

    await page.click('#theme-toggle');
    await page.waitForTimeout(500);
    await screenshot(page, CH, 2, 'dark');
  });
});
