import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const rows = (page, kind) => page.locator('#parts tr').filter({has: page.locator('td', {hasText: new RegExp(`^${kind}$`)})});
async function set(page, id, value) {
  const el = page.locator('#' + id);
  await el.evaluate(node => { const group = node.closest('details'); if (group) group.open = true; });
  if (await el.evaluate(node => node.tagName) === 'SELECT') await el.selectOption(value);
  else { await el.fill(String(value)); await el.press('Tab'); }
}

test('1.6 unit details: covers, fillers, handles, glass, lights and accessories reach the model and the accessories list', async ({page}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await set(page, 'coverLeft', 18); await set(page, 'coverRight', 18);
  await expect(rows(page, 'endPanel')).toHaveCount(2);
  await set(page, 'topFiller', 300);
  await expect(rows(page, 'topFiller')).toHaveCount(1);
  await set(page, 'doors', 2);
  await set(page, 'handleType', 'knob');
  // Light under the top of bay 1 from the Lighting group.
  await page.locator('[data-light="0:top"]').check();
  await expect(page.locator('[data-light="0:top"]')).toBeChecked();
  // Selecting a shelf offers a light toggle for that shelf.
  await rows(page, 'shelf').first().click();
  await expect(page.locator('#ctxLight')).toBeVisible();
  await page.locator('#ctxLight').click();
  await expect(page.locator('#lightEditor input:checked')).toHaveCount(2);
  // Interior space sizes and an accessory that fits.
  await expect(page.locator('#spaceTable tbody tr').first()).toBeVisible();
  await page.locator('#accessoryType').selectOption('shoeRack');
  await page.locator('#addAccessory').click();
  await expect(page.locator('#accessoryList .accessory-row')).toHaveCount(1);
  await page.locator('[data-mode="manufacturing"]').click();
  const bom = page.locator('#hardwareBom');
  await expect(bom).toContainText('Knob');
  await expect(bom).toContainText('LED strip');
  await expect(bom).toContainText('Pull-out shoe rack');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#hardwareBomCsv').click()]);
  expect(await readFile(await download.path(), 'utf8')).toContain('Concealed hinge');
  expect(errors).toEqual([]);
});

test('1.6 kitchen run, openings, material photo and room stats survive a reload', async ({page}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#roomWidth').fill('5000'); await page.locator('#roomWidth').press('Tab');
  for (const id of ['base600', 'sink800', 'wall600']) await page.locator(`[data-kitchen="${id}"]`).click();
  await expect(page.locator('#tree button')).toHaveCount(4);
  await page.locator('#openingType').selectOption('window');
  await page.locator('#openingOffset').fill('600');
  await page.locator('#addOpening').click();
  await expect(page.locator('#openingList .accessory-row')).toHaveCount(1);
  await page.locator('[data-mode="materials"]').click();
  await page.locator('#matName').fill('Oak test');
  await page.locator('#matPhoto').setInputFiles({name: 'oak.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')});
  await expect(page.locator('#matPhotoPreview img')).toBeVisible();
  await page.locator('#matSave').click();
  await expect(page.locator('.material-card')).toHaveCount(1);
  await page.locator('[data-mode="design"]').click();
  await page.locator('#applyFronts').click();
  await expect(page.locator('#materialLinks')).toContainText('Oak test');
  await page.locator('[data-mode="plan"]').click();
  await expect(page.locator('#roomStats')).toContainText('m²');
  await page.reload();
  await expect(page.locator('#tree button')).toHaveCount(4);
  await page.locator('[data-mode="materials"]').click();
  await expect(page.locator('.material-card')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('1.6 panels switch to Arabic', async ({page}) => {
  await page.goto('/');
  await page.locator('#lang').click();
  await expect(page.locator('#kitchenTemplates')).toContainText('وحدة');
  await expect(page.locator('body')).toContainText('الأبواب والزجاج والمقابض');
  await page.locator('[data-mode="manufacturing"]').click();
  await expect(page.locator('#hardwareBom')).toContainText('حامل رف');
});
