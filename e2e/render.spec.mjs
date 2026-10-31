import {test, expect} from '@playwright/test';

test('render PoC: camera presets, saved views in the project and high-resolution image export', async ({page}) => {
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('[data-mode="render"]').click();
  await page.locator('#roomLook').selectOption('room');
  await page.locator('#floorLook').selectOption('walnut');
  await page.locator('[data-cam="eye"]').click();
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
  await expect(page.locator('#roomLook')).toHaveValue('room');
  expect(errors).toEqual([]);
});

test('path-traced image of the realistic room can be exported and cancelled', async ({page}) => {
  test.setTimeout(300000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('[data-kitchen="base600"]').click();
  await page.locator('[data-mode="render"]').click();
  await page.locator('#roomLook').selectOption('room');
  await page.locator('[data-cam="iso"]').click();
  await page.locator('#imgEngine').selectOption('path');
  await expect(page.locator('#imgAo')).toBeDisabled();
  // Software rendering in CI is slow: 2 samples prove the pipeline, not the quality.
  await page.evaluate(() => { const s = document.getElementById('ptSamples'); s.add(new Option('2', '2')); s.value = '2'; });
  await page.locator('#imgSize').selectOption('screen');
  const [download] = await Promise.all([page.waitForEvent('download', {timeout: 280000}), page.locator('#exportImage').click()]);
  expect(download.suggestedFilename()).toMatch(/-iso-screen\.png$/);
  await expect(page.locator('#imgStatus')).toContainText('Path traced');
  await expect(page.locator('#ptCancel')).toBeHidden();
  await page.evaluate(() => { document.getElementById('ptSamples').value = '1024'; });
  await page.locator('#exportImage').click();
  await expect(page.locator('#ptCancel')).toBeVisible();
  await page.locator('#ptCancel').click();
  await expect(page.locator('#imgStatus')).toHaveText('Path tracing cancelled', {timeout: 200000});
  await expect(page.locator('#exportImage')).toBeEnabled();
  expect(errors).toEqual([]);
});
