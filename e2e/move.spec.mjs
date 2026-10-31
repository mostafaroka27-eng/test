import {test, expect} from '@playwright/test';

test('select a unit, drag it on the floor, nudge with arrows, rotate with R, delete with the Delete key and undo', async ({page}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#addBase').click();
  await expect(page.locator('#tree button')).toHaveCount(2);
  await page.locator('#tree button').first().click();
  const canvas = page.locator('#viewport canvas');
  const box = await canvas.boundingBox();
  const startX = Number(await page.locator('#posX').inputValue());
  let moved = false;
  for (const dy of [0.55, 0.45, 0.65, 0.35, 0.75]) {
    for (const dx of [0.5, 0.4, 0.6, 0.3, 0.7]) {
      const x = box.x + box.width * dx, y = box.y + box.height * dy;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 60, y, {steps: 6}); await page.mouse.move(x + 120, y, {steps: 6}); await page.mouse.up();
      const now = Number(await page.locator('#posX').inputValue());
      if (now !== startX) { moved = true; break; }
    }
    if (moved) break;
  }
  expect(moved).toBe(true);
  const afterDrag = Number(await page.locator('#posX').inputValue());
  expect(afterDrag % 10 === 0 || (await page.locator('#warning').textContent()).includes('Snapped')).toBe(true);
  await page.locator('body').click({position: {x: 5, y: 5}}).catch(() => {});
  await page.locator('#tree button').first().click();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#posX')).toHaveValue(String(afterDrag + 10));
  await page.keyboard.press('Shift+ArrowUp');
  const z = Number(await page.locator('#posZ').inputValue());
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#posZ')).toHaveValue(String(z + 10));
  await page.keyboard.press('r');
  await expect(page.locator('#rotation')).toHaveValue('90');
  await page.locator('#openFronts').click();
  await expect(page.locator('#openFronts')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#openFronts').click();
  await expect(page.locator('#openFronts')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#tree button').first().click();
  await page.keyboard.press('Delete');
  await expect(page.locator('#tree button')).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect(page.locator('#tree button')).toHaveCount(2);
  expect(errors).toEqual([]);
});
