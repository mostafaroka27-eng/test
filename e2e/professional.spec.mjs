import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('room plan generates a U-shaped kitchen, rotates/selects units and persists placement',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await expect(page.locator('[data-mode="plan"]')).toBeVisible();
 await page.locator('[data-mode="plan"]').click();
 await page.locator('#kitchenShape').selectOption('u');
 await page.locator('#kitchenCount').fill('5');
 page.once('dialog',d=>d.accept());await page.locator('#generateKitchen').click();
 await expect(page.locator('#tree button')).toHaveCount(5);
 await expect(page.locator('#roomWarnings')).toContainText('No rectangular');
 await expect(page.locator('#planDrawing [data-unit]')).toHaveCount(5);
 await page.locator('#planDrawing [data-unit]').nth(3).click();
 await expect(page.locator('#rotation')).not.toHaveValue('0');
 await page.reload();
 await expect(page.locator('#tree button')).toHaveCount(5);
 await page.locator('#tree button').nth(3).click();
 await expect(page.locator('#rotation')).not.toHaveValue('0');
 await page.locator('#rotation').selectOption('180');
 await page.locator('#undo').click();
 await expect(page.locator('#rotation')).not.toHaveValue('180');
 expect(errors).toEqual([]);
});

test('estimate refuses missing prices, recalculates and retains prices through reload',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await expect(page.locator('[data-mode="costing"]')).toBeVisible();
 await page.locator('[data-mode="costing"]').click();
 await expect(page.locator('#costStatus')).toContainText('incomplete');
 await expect(page.locator('[data-total="selling"]')).toHaveText('—');
 const prices=page.locator('[data-material-rate]');
 await expect(prices).toHaveCount(2);
 for(let i=0;i<await prices.count();i++){await prices.nth(i).fill('20');await prices.nth(i).press('Tab')}
 await page.locator('#costEdgeRate').fill('1.5');await page.locator('#costEdgeRate').press('Tab');
 await page.locator('#costProfitMarginPercent').fill('20');await page.locator('#costProfitMarginPercent').press('Tab');
 await expect(page.locator('#costStatus')).toContainText('complete');
 await expect(page.locator('[data-total="selling"]')).not.toHaveText('—');
 await page.locator('#costCurrency').fill('OMR');await page.locator('#costCurrency').press('Tab');
 await expect(page.locator('[data-total="selling"]')).toHaveText(/^\d+\.\d{3} OMR$/);
 await page.locator('#costCurrency').fill('JPY');await page.locator('#costCurrency').press('Tab');
 await expect(page.locator('[data-total="selling"]')).toHaveText(/^\d+ JPY$/);
 const selling=await page.locator('[data-total="selling"]').innerText();
 await page.reload();await page.locator('[data-mode="costing"]').click();
 await expect(page.locator('#costEdgeRate')).toHaveValue('1.5');
 await expect(page.locator('[data-total="selling"]')).toHaveText(selling);
 const downloaded=page.waitForEvent('download');await page.locator('#costExport').click();
 const csv=await readFile(await(await downloaded).path(),'utf8');expect(csv).toContain('ESTIMATE');
 expect(errors).toEqual([]);
});

test('saved design revisions restore geometry, placement and prices and remain undoable',async({page})=>{
 await page.goto('/');await page.locator('[data-mode="review"]').click();
 await page.locator('#revisionLabel').fill('Client approval draft');await page.locator('#saveRevision').click();
 await expect(page.locator('#revisionList option')).toHaveCount(2);
 await page.locator('#width').fill('1200');await page.locator('#width').press('Tab');
 await page.locator('#revisionList').selectOption(await page.locator('#revisionList option').nth(1).getAttribute('value'));
 await page.locator('#loadRevision').click();await expect(page.locator('#width')).toHaveValue('900');
 await page.locator('#undo').click();await expect(page.locator('#width')).toHaveValue('1200');
 await page.reload();await page.locator('[data-mode="review"]').click();
 await expect(page.locator('#revisionList option')).toHaveCount(2);
});

test('unsafe monetary totals keep a valid imported design usable and repairable',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
 const project={format:'rokadex-standalone',version:2,room:{width:20000,depth:20000,height:20000},units:[{id:'LARGE',name:'Large valid design',finish:'oak',x:0,z:0,config:{width:10000,height:10000,depth:10000,partitions:0,shelves:0}}],costing:{currency:'USD',materials:[{material:'MDF 18 mm',thickness:18,pricePerM2:1e9},{material:'HDF 6 mm',thickness:6,pricePerM2:1e9}],edgeRate:0,wastePercent:1000,overheadPercent:1000,profitMarginPercent:99.99}};
 await page.locator('#file').setInputFiles({name:'large.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
 await expect(page.locator('#width')).toHaveValue('10000');await page.locator('[data-mode="costing"]').click();
 await expect(page.locator('#costMissing')).toContainText('safe monetary');
 await expect(page.locator('[data-total="selling"]')).toHaveText('—');
 await page.locator('#costProfitMarginPercent').fill('0');await page.locator('#costProfitMarginPercent').press('Tab');
 await expect(page.locator('#costStatus')).toContainText('complete');
 await page.locator('#width').fill('9000');await page.locator('#width').press('Tab');
 await expect(page.locator('#undo')).toBeEnabled();expect(errors).toEqual([]);
});

test('semantic panel edge edits survive another bay gaining a shelf',async({page})=>{
 await page.goto('/');
 await page.locator('[data-bay="0"]').fill('1');await page.locator('[data-bay="0"]').press('Tab');
 await page.locator('[data-bay="1"]').fill('2');await page.locator('[data-bay="1"]').press('Tab');
 await page.locator('#parts tr').filter({has:page.locator('td',{hasText:/^shelf$/})}).nth(1).click();
 await page.locator('[data-edge="0"]').evaluate(n=>{n.closest('details').open=true});await page.locator('[data-edge="1"]').check();
 await page.locator('[data-bay="0"]').fill('2');await page.locator('[data-bay="0"]').press('Tab');
 await page.locator('#parts tr').filter({has:page.locator('td',{hasText:/^shelf$/})}).nth(2).click();
 await expect(page.locator('[data-edge="1"]')).toBeChecked();
 await page.locator('#parts tr').filter({has:page.locator('td',{hasText:/^shelf$/})}).nth(1).click();
 await expect(page.locator('[data-edge="1"]')).not.toBeChecked();
});

test('reference data builds wardrobe templates, finishes and room templates without a raw data view',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
 await expect(page.locator('[data-mode="references"]')).toHaveCount(0);await expect(page.locator('#referencesPanel')).toHaveCount(0);
 await expect(page.locator('#referenceTemplates .library-item')).toHaveCount(7);
 await expect(page.locator('#referenceSkipped')).toContainText('Double hanging');
 await page.locator('[data-template="ncd-drawHang"]').click();
 await expect(page.locator('#tree button')).toHaveCount(2);
 await expect(page.locator('#width')).toHaveValue('600');await expect(page.locator('#height')).toHaveValue('2400');
 await expect(page.locator('#finish')).toHaveValue('#f1f0eb');
 await expect(page.locator('#parts')).toContainText('drawerFace');
 await page.locator('#undo').click();await expect(page.locator('#tree button')).toHaveCount(1);
 await page.locator('#redo').click();await expect(page.locator('#tree button')).toHaveCount(2);
 await page.locator('#tree button').nth(1).click();await page.locator('#finish').selectOption('#6a4731');await expect(page.locator('#finish')).toHaveValue('#6a4731');
 const saved=page.waitForEvent('download');await page.locator('#save').click();
 const project=JSON.parse(await readFile(await(await saved).path(),'utf8'));
 expect(project.units[1].finish).toBe('#6a4731');expect(project.units[1].config.bayDrawers).toEqual([3]);
 await page.locator('#referenceRoomPreset').selectOption('kitchen');
 page.once('dialog',dialog=>dialog.accept());await page.locator('#applyReferenceRoom').click();
 await expect(page.locator('#roomWidth')).toHaveValue('3000');await expect(page.locator('#roomDepth')).toHaveValue('4000');
 await page.locator('#undo').click();await expect(page.locator('#roomWidth')).toHaveValue('4200');
 await page.locator('#lang').click();await expect(page.locator('[data-template="ncd-hang"] b')).toHaveText('تعليق طويل');
 expect(errors).toEqual([]);
});
