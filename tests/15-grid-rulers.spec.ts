import { test, expect } from '@playwright/test';
import { waitForAppReady, dismissInfoDialog, dismissCompatibilityWarning, screenshot } from './helpers/app';

const CH = '15-grid';

/** Fingerprint of what is painted on the label canvas */
function canvasFingerprint(page) {
  return page.evaluate(() => {
    const c = document.querySelector('#preview-canvas') as HTMLCanvasElement;
    const url = c.toDataURL();
    return url.length + ':' + url.slice(-48);
  });
}

async function openGridMenu(page) {
  await page.click('#grid-btn');
  await expect(page.locator('#grid-dropdown')).toBeVisible();
}

test.describe.serial('Grid, snapping and rulers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);
    await dismissCompatibilityWarning(page);
    await dismissInfoDialog(page);
  });

  test('grid is off by default and paints when enabled', async ({ page }) => {
    const before = await canvasFingerprint(page);

    await openGridMenu(page);
    await page.locator('#grid-show').check();
    await page.waitForTimeout(400);

    expect(await canvasFingerprint(page)).not.toBe(before);
    await expect(page.locator('#grid-btn')).toHaveClass(/lf-toggle-on/);

    await page.locator('#grid-show').uncheck();
    await page.waitForTimeout(400);
    expect(await canvasFingerprint(page)).toBe(before);
  });

  test('snapping quantises a dragged element to the spacing', async ({ page }) => {
    await page.click('#add-text');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    await openGridMenu(page);
    await page.locator('#grid-show').check();
    await page.locator('#grid-snap').check();
    await page.locator('#grid-size').fill('5');
    await page.locator('#grid-size').dispatchEvent('change');
    await page.waitForTimeout(300);
    await page.click('#grid-btn'); // close the menu

    // Put the element on a deliberately off-grid position, then drag it
    await page.locator('.element-list-item').first().click().catch(() => {});
    await page.click('#elements-btn');
    await page.locator('.element-list-item').first().click();
    await page.waitForTimeout(200);
    await page.locator('#prop-x').fill('37');
    await page.locator('#prop-x').dispatchEvent('change');
    await page.waitForTimeout(300);

    const canvas = page.locator('#preview-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('no canvas box');

    // A small drag; the result must land on a multiple of the spacing
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 13, box.y + box.height / 2 + 7, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(400);

    const x = Number(await page.locator('#prop-x').inputValue());
    const y = Number(await page.locator('#prop-y').inputValue());
    // 5mm spacing at 8 px/mm = 40 canvas px
    expect(x % 40).toBeCloseTo(0, 5);
    expect(y % 40).toBeCloseTo(0, 5);
  });

  test('rulers appear and follow the unit', async ({ page }) => {
    await expect(page.locator('#ruler-h')).toBeHidden();

    await openGridMenu(page);
    await page.locator('#rulers-show').check();
    await page.waitForTimeout(400);

    await expect(page.locator('#ruler-h')).toBeVisible();
    await expect(page.locator('#ruler-v')).toBeVisible();

    await screenshot(page, CH, 1, 'grid-and-rulers');
  });

  test('spacing is entered in the display unit', async ({ page }) => {
    await openGridMenu(page);
    await page.locator('#grid-show').check();
    await page.locator('#grid-size').fill('10');
    await page.locator('#grid-size').dispatchEvent('change');
    await page.waitForTimeout(300);
    await page.click('#grid-btn');

    // Switch to inches: 10mm should re-read as 0.39in, not stay "10"
    await page.click('#print-settings-btn');
    await page.locator('#display-units').selectOption('in');
    await page.click('#print-settings-save');
    await page.waitForTimeout(400);

    await openGridMenu(page);
    await expect(page.locator('#grid-size')).toHaveValue('0.39');
    await expect(page.locator('#grid-size-unit')).toHaveText('in');
  });

  test('settings survive a reload', async ({ page }) => {
    await openGridMenu(page);
    await page.locator('#grid-show').check();
    await page.locator('#rulers-show').check();
    await page.waitForTimeout(300);

    await page.reload({ waitUntil: 'networkidle' });
    await waitForAppReady(page);
    await dismissCompatibilityWarning(page);
    await dismissInfoDialog(page);

    await expect(page.locator('#grid-btn')).toHaveClass(/lf-toggle-on/);
    await expect(page.locator('#ruler-h')).toBeVisible();
  });
});
