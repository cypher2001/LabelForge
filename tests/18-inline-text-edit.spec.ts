import { test, expect } from '@playwright/test';
import { waitForAppReady, dismissInfoDialog, dismissCompatibilityWarning } from './helpers/app';

/** Fingerprint of what is painted on the label canvas */
const fingerprint = (page: any) => page.evaluate(() => {
  const c = document.querySelector('#preview-canvas') as HTMLCanvasElement;
  const url = c.toDataURL();
  return url.length + ':' + url.slice(-48);
});

const editorCss = (page: any) => page.locator('#inline-text-editor').evaluate((el) => {
  const c = getComputedStyle(el);
  return {
    border: parseFloat(c.borderTopWidth),
    outline: parseFloat(c.outlineWidth),
    background: c.backgroundColor,
    boxShadow: c.boxShadow,
    fontSize: parseFloat(c.fontSize),
    lineHeight: parseFloat(c.lineHeight),
    paddingTop: parseFloat(c.paddingTop),
    paddingLeft: parseFloat(c.paddingLeft),
  };
});

/** Double-click the centre of the canvas, where the new text element sits */
async function startEditing(page: any) {
  const box = await page.locator('#preview-canvas').boundingBox();
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForSelector('#inline-text-editor:not(.hidden)', { timeout: 5000 });
  await page.waitForTimeout(150);
}

test.describe.serial('Inline text editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);
    await dismissCompatibilityWarning(page);
    await dismissInfoDialog(page);
    await page.click('#add-text');
    await page.waitForTimeout(400);
    // Adding text drops straight into the inline editor. Leave it, so each
    // test starts from a canvas that is actually painting the element.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    await expect(page.locator('#inline-text-editor')).toHaveClass(/hidden/);
    // Zoom stays at 100% so element units and CSS pixels are the same number
    await expect(page.locator('#zoom-level')).toHaveText('100%');
  });

  test('the element stops being painted under its own editor', async ({ page }) => {
    const before = await fingerprint(page);
    await startEditing(page);
    const during = await fingerprint(page);

    // The ghost was the canvas still drawing the element beneath a translucent
    // textarea, a couple of pixels off. If the canvas is unchanged, it is
    // still painting it and the shadow is still there.
    expect(during).not.toBe(before);
  });

  test('the editor adds no border and is fully opaque', async ({ page }) => {
    await startEditing(page);
    const css = await editorCss(page);

    // A border insets the text relative to the canvas; an outline does not
    expect(css.border).toBe(0);
    expect(css.outline).toBeGreaterThan(0);
    expect(css.boxShadow).toBe('none');
    // Any alpha below 1 lets the canvas show through - that was the shadow
    expect(css.background).not.toMatch(/rgba\([^)]*,\s*0?\.\d+\s*\)/);
    // The canvas insets text by 4px, so the editor must too
    expect(css.paddingLeft).toBeCloseTo(4, 1);
  });

  test('editor font size and line height match the canvas', async ({ page }) => {
    await page.locator('#prop-font-size').fill('30');
    await page.locator('#prop-font-size').dispatchEvent('change');
    await page.waitForTimeout(250);

    await startEditing(page);
    const css = await editorCss(page);

    expect(css.fontSize).toBeCloseTo(30, 1);
    expect(css.lineHeight).toBeCloseTo(30 * 1.2, 1);   // canvas uses fontSize * 1.2
  });

  test('autoScale: the editor shrinks with the canvas instead of jumping on blur', async ({ page }) => {
    // A size far too large for the box, which the canvas will scale down
    await page.locator('#prop-font-size').fill('96');
    await page.locator('#prop-font-size').dispatchEvent('change');
    await page.locator('#prop-auto-scale').check();
    await page.waitForTimeout(250);

    await startEditing(page);
    await page.locator('#inline-text-editor').fill('A considerably longer line of text');
    await page.waitForTimeout(250);

    const css = await editorCss(page);
    // Previously the editor showed the stored 96px while the canvas drew the
    // fitted size, so the text visibly resized the moment you clicked away
    expect(css.fontSize).toBeLessThan(96);
    expect(css.lineHeight).toBeCloseTo(css.fontSize * 1.2, 0);
  });

  test('vertical centring matches the canvas, not the top of the box', async ({ page }) => {
    await page.locator('#prop-font-size').fill('20');
    await page.locator('#prop-font-size').dispatchEvent('change');
    await page.locator('#prop-height').fill('80');
    await page.locator('#prop-height').dispatchEvent('change');
    await page.waitForTimeout(250);

    await startEditing(page);
    await page.locator('#inline-text-editor').fill('One line');
    await page.waitForTimeout(250);

    const css = await editorCss(page);
    // verticalAlign defaults to middle: canvas centres the block in the box,
    // so a single 20px line in an 80px box starts at (80 - 24) / 2 = 28
    expect(css.paddingTop).toBeCloseTo((80 - 20 * 1.2) / 2, 0);
  });
});
