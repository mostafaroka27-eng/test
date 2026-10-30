import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const rows = (page, kind) => page.locator('#parts tr').filter({has: page.locator('td', {hasText: new RegExp(`^${kind}$`)})});
async function set(page, id, value) {
  const el = page.locator('#' + id);
  if (await el.evaluate(node => node.tagName) === 'SELECT') await el.selectOption(value);
  else { await el.fill(String(value)); await el.press('Tab'); }
}
async function text(download) { return readFile(await download.path(), 'utf8'); }

test('cab-2.0 wardrobe: separate boxes, plinth, drawers below shelves, rail, glass doors and outputs from one model', async ({page}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await set(page, 'width', 2400); await set(page, 'height', 2400); await set(page, 'depth', 600);
  await set(page, 'partitions', 2);
  await set(page, 'bayMode', 'separate');
  // 2400 / 3 boxes − 2 × 18 = 764 mm inside each box.
  await expect(rows(page, 'top')).toHaveCount(3);
  await expect(rows(page, 'top').first().locator('td').nth(2)).toHaveText('764');
  await set(page, 'bayMode', 'shared');
  await expect(rows(page, 'top').first().locator('td').nth(2)).toHaveText('2364');
  await set(page, 'plinthHeight', 100);
  await expect(rows(page, 'plinth')).toHaveCount(1);
  await expect(rows(page, 'partition').first().locator('td').nth(2)).toHaveText('2264');
  await page.locator('[data-drawer="0"]').fill('2'); await page.locator('[data-drawer="0"]').press('Tab');
  await expect(rows(page, 'drawerFront')).toHaveCount(2);
  await expect(rows(page, 'fixedShelf')).toHaveCount(1);
  await expect(page.locator('#modelWarnings')).toContainText('slide 550 mm');
  await page.locator('[data-levels="1"]').fill('900, 1500'); await page.locator('[data-levels="1"]').press('Tab');
  await page.locator('[data-rail="2"]').fill('1600'); await page.locator('[data-rail="2"]').press('Tab');
  await expect(page.locator('#modelWarnings')).toContainText('hanging rail 776 mm at 1600 mm');
  // Impossible slide gives a visible error and keeps the last valid design.
  await set(page, 'drawerSlideMode', 'fixed'); await set(page, 'drawerSlideLength', 600);
  await expect(page.locator('#warning')).toContainText('exceeds available depth');
  await expect(page.locator('#drawerSlideLength')).not.toHaveValue('600');
  await set(page, 'drawerSlideMode', 'auto');
  // External drawers cannot sit behind full-height doors; internal drawers can.
  await set(page, 'doors', 2);
  await expect(page.locator('#warning')).toContainText('overlap full-height doors');
  await set(page, 'drawerStyle', 'internal'); await set(page, 'doors', 2);
  await expect(rows(page, 'door')).toHaveCount(2);
  await expect(rows(page, 'drawerFront')).toHaveCount(0);
  await set(page, 'doorType', 'glass');
  await expect(rows(page, 'door').first().locator('td').nth(5)).toHaveText('Glass 5 mm');
  await expect(rows(page, 'door').first().locator('td').nth(7)).toHaveText('supplier');
  await page.locator('[data-mode="review"]').click();
  await set(page, 'designRevision', 3);
  await page.locator('[data-mode="design"]').click();
  const projectId = await page.locator('#projectIdLabel').textContent();
  expect(projectId).toMatch(/^PRJ-/);

  const csvDownload = page.waitForEvent('download');
  await page.locator('#mfgCsv').click();
  const csv = await text(await csvDownload);
  expect(csv).toContain(`project ${projectId} · revision 3`);
  const csvRows = csv.split('\r\n').slice(3);
  const tableRows = await page.locator('#parts tr').count();
  expect(csvRows).toHaveLength(tableRows);
  const labelDownload = page.waitForEvent('download');
  await page.locator('#partLabels').click();
  const labels = await text(await labelDownload);
  expect((labels.match(/<svg /g) || []).length).toBe(tableRows);
  expect(labels).toContain('CAB-001/drawerFace:0:1');

  const saved = page.waitForEvent('download');
  await page.locator('#save').click();
  const project = JSON.parse(await text(await saved));
  expect(project.version).toBe(3);
  expect(project.projectId).toBe(projectId);
  expect(project.designRevision).toBe(3);
  const config = project.units[0].config;
  expect([config.bayMode, config.plinthHeight, config.drawerStyle, config.doorType]).toEqual(['shared', 100, 'internal', 'glass']);
  expect(config.bayShelfLevels[1]).toEqual([900, 1500]);
  expect(config.bayRails).toEqual([0, 0, 1600]);
  await page.reload();
  await expect(page.locator('#projectIdLabel')).toHaveText(projectId);
  await expect(page.locator('[data-levels="1"]')).toHaveValue('900, 1500');
  await expect(rows(page, 'door')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('legacy v2 file opens with legacy rules, keeps geometry and is labelled as migrated on save', async ({page}) => {
  await page.goto('/');
  const legacy = {format:'rokadex-standalone',version:2,room:{width:6000,depth:4000,height:2800},units:[{id:'OLD-1',name:'Old wardrobe',x:0,z:0,finish:'oak',config:{width:1200,height:2000,depth:580,thickness:18,backThickness:6,backInset:0,partitions:1,shelves:2,material:'MDF 18 mm',backMaterial:'HDF 6 mm',edgeThickness:1,edgeType:'PVC',sheetWidth:1220,sheetHeight:2440,kerf:3.2,trim:10,construction:'between',grain:'vertical',doors:0,doorGap:3,doorOverlay:0,bayDrawers:[2,0]}}]};
  await page.locator('#file').setInputFiles({name:'old.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
  await expect(page.locator('#tree button')).toHaveCount(1);
  await expect(page.locator('#drawerLayout')).toHaveValue('legacy');
  await expect(page.locator('#modelWarnings')).toContainText('rokadex-alpha-1.3.2');
  await expect(page.locator('#modelWarnings')).toContainText('overlaps its shelves');
  await expect(rows(page, 'top').first().locator('td').nth(2)).toHaveText('1164');
  const saved = page.waitForEvent('download');
  await page.locator('#save').click();
  const project = JSON.parse(await text(await saved));
  expect([project.version, project.migratedFrom, project.units[0].config.drawerLayout]).toEqual([3, 2, 'legacy']);
});

test('new engineering controls are translated in Arabic', async ({page}) => {
  await page.goto('/');
  await page.locator('#lang').click();
  await expect(page.locator('#properties')).toContainText('تركيب الحجرات');
  await expect(page.locator('#properties')).toContainText('ارتفاع القاعدة');
  await expect(page.locator('#properties')).toContainText('مناسيب الرفوف');
  await expect(page.locator('.bottom-head')).toContainText('ملصقات القطع');
  await expect(page.locator('#width')).toHaveValue('900');
});
