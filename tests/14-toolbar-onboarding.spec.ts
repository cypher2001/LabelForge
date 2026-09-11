import { test, expect } from '@playwright/test';
import { waitForAppReady, dismissInfoDialog, dismissCompatibilityWarning, screenshot } from './helpers/app';

const CH = '14-toolbar';

test.describe.serial('Toolbar and onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);
    await dismissCompatibilityWarning(page);
    await dismissInfoDialog(page);
  });

  test('toolbar is grouped and every button survived the restructure', async ({ page }) => {
    await expect(page.locator('.lf-group')).toHaveCount(8);

    // The regrouping moved markup around; each control must still be there
    for (const id of ['add-text', 'add-image', 'add-barcode', 'add-qr', 'add-shape-btn',
                      'duplicate-btn', 'delete-btn', 'undo-btn', 'redo-btn',
                      'bring-front', 'send-back', 'group-btn', 'ungroup-btn',
                      'align-btn', 'grid-btn', 'save-btn', 'load-btn', 'export-btn', 'elements-btn']) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    await screenshot(page, CH, 1, 'grouped-toolbar');
  });

  test('empty state shows on a blank label and clears on first element', async ({ page }) => {
    await expect(page.locator('#canvas-empty')).toBeVisible();

    await page.click('#add-text');
    await page.waitForTimeout(400);
    await expect(page.locator('#canvas-empty')).toBeHidden();
  });

  test('empty state returns when the last element is deleted', async ({ page }) => {
    await page.click('#add-text');
    await page.waitForTimeout(400);
    await expect(page.locator('#canvas-empty')).toBeHidden();

    await page.click('#delete-btn');
    await page.waitForTimeout(400);
    await expect(page.locator('#canvas-empty')).toBeVisible();
  });

  test('empty-state shortcuts add the right element', async ({ page }) => {
    await page.click('#empty-add-qr');
    await page.waitForTimeout(500);

    await expect(page.locator('#canvas-empty')).toBeHidden();
    // The QR properties section is what appears for a QR element
    await expect(page.locator('#prop-qr-data')).toBeVisible();
  });

  test('empty state is themed too', async ({ page }) => {
    await page.click('#theme-toggle');
    await page.waitForTimeout(300);
    await expect(page.locator('#canvas-empty')).toBeVisible();
    await screenshot(page, CH, 2, 'empty-state-dark');
  });
});
