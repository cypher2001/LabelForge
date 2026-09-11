import { test, expect } from '@playwright/test';
import { waitForAppReady, dismissInfoDialog, dismissCompatibilityWarning, screenshot } from './helpers/app';

const CH = '16-gallery';

/** A thumbnail counts as drawn if it has non-white pixels */
function thumbHasInk(page, key: string) {
  return page.evaluate((k) => {
    const c = Array.from(document.querySelectorAll('.gallery-thumb'))
      .find(el => (el as HTMLCanvasElement).dataset.key === k) as HTMLCanvasElement;
    if (!c || c.width === 0) return false;
    const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200) return true;
    }
    return false;
  }, key);
}

test.describe.serial('Template gallery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);
    await dismissCompatibilityWarning(page);
    await dismissInfoDialog(page);
  });

  test('opens from the empty state and shows the starters', async ({ page }) => {
    await expect(page.locator('#canvas-empty')).toBeVisible();
    await page.click('#empty-templates');

    await expect(page.locator('#gallery-dialog')).toBeVisible();
    await expect(page.locator('#gallery-starters .gallery-card')).toHaveCount(4);
    await expect(page.locator('#gallery-saved-empty')).toBeVisible();

    await page.waitForTimeout(600);
    await screenshot(page, CH, 1, 'gallery');
  });

  test('every starter renders a thumbnail', async ({ page }) => {
    await page.click('#gallery-btn');
    await page.waitForTimeout(800);

    for (const id of ['asset-tag', 'shipping', 'cable', 'storage-jar']) {
      expect(await thumbHasInk(page, `starter:${id}`), `${id} drew nothing`).toBe(true);
    }
  });

  test('picking a starter loads its elements and label size', async ({ page }) => {
    await page.click('#gallery-btn');
    await page.waitForTimeout(500);
    await page.locator('.gallery-card[data-key="starter:asset-tag"]').click();
    await page.waitForTimeout(600);

    await expect(page.locator('#gallery-dialog')).toBeHidden();
    await expect(page.locator('#canvas-empty')).toBeHidden();

    // The asset tag is 50 x 25mm and carries a templated field
    await expect(page.locator('#print-size')).toHaveText('50 x 25 mm');
    await expect(page.locator('#template-toolbar-btn')).toBeVisible();

    await page.click('#elements-btn');
    await expect(page.locator('.element-list-item')).toHaveCount(3);
  });

  test('a starter with a field feeds the series generator', async ({ page }) => {
    await page.click('#gallery-btn');
    await page.waitForTimeout(500);
    await page.locator('.gallery-card[data-key="starter:asset-tag"]').click();
    await page.waitForTimeout(600);

    // {{SN}} appears in both the text and the QR, so one field, not two
    await expect(page.locator('#template-field-count')).toHaveText('1');
  });

  test('replacing existing work asks first', async ({ page }) => {
    await page.click('#add-text');
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');

    page.on('dialog', d => d.dismiss());
    await page.click('#gallery-btn');
    await page.waitForTimeout(400);
    await page.locator('.gallery-card[data-key="starter:cable"]').click();
    await page.waitForTimeout(500);

    // Dismissed, so the label size must be untouched
    await expect(page.locator('#print-size')).toHaveText('40 x 30 mm');
  });

  test('saved designs appear with thumbnails', async ({ page }) => {
    await page.click('#gallery-btn');
    await page.waitForTimeout(400);
    await page.locator('.gallery-card[data-key="starter:cable"]').click();
    await page.waitForTimeout(500);

    await page.click('#save-btn');
    await page.locator('#save-name').fill('Cable test');
    await page.click('#save-confirm');
    await page.waitForTimeout(500);

    await page.click('#gallery-btn');
    await page.waitForTimeout(800);
    await expect(page.locator('#gallery-saved .gallery-card')).toHaveCount(1);
    await expect(page.locator('#gallery-saved-empty')).toBeHidden();
    expect(await thumbHasInk(page, 'design:Cable test')).toBe(true);
  });
});
