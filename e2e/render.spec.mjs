import {test, expect} from '@playwright/test';

test('render PoC: camera presets, saved views in the project and high-resolution image export', async ({page}) => {
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('[data-mode="render"]').click();
  await page.locator('[data-cam="iso"]').click();
  await page.locator('#viewName').fill('Overview');
  await page.locator('#saveView').click();
  await expect(page.locator('#viewList [data-view-go]')).toHaveCount(1);
  await page.locator('#imgSize').selectOption('2k');
  await page.locator('#imgFormat').selectOption('jpeg');
  await expect(page.locator('#imgTransparent')).toBeDisabled();
  await page.locator('#imgFormat').selectOption('png');
  await page.locator('#imgTransparent').check();
  await expect(page.locator('#imgAo')).toBeDisabled();
  const [download] = await Promise.all([page.waitForEvent('download', {timeout: 120000}), page.locator('#exportImage').click()]);
  expect(download.suggestedFilename()).toMatch(/-Overview-2560x1440\.png$/);
  await expect(page.locator('#imgStatus')).toContainText('2560 × 1440');
  const viewport = await page.evaluate(() => { const c = document.querySelector('#viewport canvas'); return c.width > 0 && c.width < 2560; });
  expect(viewport).toBe(true);
  await page.reload();
  await page.locator('[data-mode="render"]').click();
  await expect(page.locator('#viewList [data-view-go]')).toHaveText('Overview');
  expect(errors).toEqual([]);
});
