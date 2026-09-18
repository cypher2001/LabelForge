import { test, expect } from '@playwright/test';
import { waitForAppReady, dismissInfoDialog, dismissCompatibilityWarning } from './helpers/app';

/** The accent colour as the browser actually resolves it */
const accent = (page: any) => page.evaluate(
  () => getComputedStyle(document.documentElement).getPropertyValue('--lf-accent').trim());

const openSettings = async (page: any) => {
  await page.click('#print-settings-btn');
  await page.waitForSelector('#print-settings-dialog:not(.hidden)');
};

test.describe.serial('Colorway', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);
    await dismissCompatibilityWarning(page);
    await dismissInfoDialog(page);
  });

  test('defaults to ember, with no attribute set', async ({ page }) => {
    await expect(page.locator('html')).not.toHaveAttribute('data-colorway', /.*/);
    await openSettings(page);
    await expect(page.locator('#colorway-select')).toHaveValue('ember');
  });

  test('every colorway repaints the accent, and each is distinct', async ({ page }) => {
    await openSettings(page);
    const seen = new Map<string, string>();

    for (const way of ['ember', 'ocean', 'forest', 'orchid', 'graphite']) {
      await page.selectOption('#colorway-select', way);
      await page.waitForTimeout(150);
      const colour = await accent(page);
      expect(colour, `${way} must resolve an accent`).toBeTruthy();
      seen.set(way, colour);
    }

    // A colorway that looks like another one is not a colorway
    expect(new Set(seen.values()).size).toBe(seen.size);
  });

  test('applies immediately, without pressing Save', async ({ page }) => {
    const before = await accent(page);
    await openSettings(page);
    await page.selectOption('#colorway-select', 'ocean');
    await page.waitForTimeout(150);

    expect(await accent(page)).not.toBe(before);
    await expect(page.locator('html')).toHaveAttribute('data-colorway', 'ocean');
  });

  test('survives a reload with no flash of the default accent', async ({ page }) => {
    await openSettings(page);
    await page.selectOption('#colorway-select', 'forest');
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => localStorage.getItem('phomymo_colorway'))).toBe('forest');

    await page.reload({ waitUntil: 'domcontentloaded' });
    // Asserted before the app boots: the inline head script must have run
    await expect(page.locator('html')).toHaveAttribute('data-colorway', 'forest');
  });

  test('a corrupted stored value falls back to the default', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('phomymo_colorway', 'nonsense"><script>'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).not.toHaveAttribute('data-colorway', /.*/);
  });

  test('the choice is independent of the light/dark theme', async ({ page }) => {
    await openSettings(page);
    await page.selectOption('#colorway-select', 'orchid');
    await page.waitForTimeout(150);
    const light = await accent(page);
    await page.click('#print-settings-close');

    await page.click('#theme-toggle');
    await page.waitForTimeout(250);

    // Still orchid, but the dark block must have supplied its own value -
    // if the light accent leaked through, dark mode gets a too-dark accent
    await expect(page.locator('html')).toHaveAttribute('data-colorway', 'orchid');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await accent(page)).not.toBe(light);
  });

  test('Reset returns the colorway to ember', async ({ page }) => {
    await openSettings(page);
    await page.selectOption('#colorway-select', 'graphite');
    await page.waitForTimeout(150);

    await page.click('#print-settings-reset');
    await page.waitForTimeout(200);
    await expect(page.locator('html')).not.toHaveAttribute('data-colorway', /.*/);
    await expect(page.locator('#colorway-select')).toHaveValue('ember');
  });
});
