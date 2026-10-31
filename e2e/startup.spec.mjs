import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('WebGL unavailable: 2D drawings, editing, undo, backup and project exports remain usable',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  const getContext=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(kind,...args){return /webgl/i.test(kind)?null:getContext.call(this,kind,...args)};
 });
 await page.goto('/');
 await expect(page.locator('#parts tr')).not.toHaveCount(0);
 await expect(page.locator('#fallbackDrawing svg')).toBeVisible();
 await expect(page.locator('#renderStatus')).toContainText('2D');
 await expect(page.locator('#viewTag')).toHaveText('2D DESIGN VIEW');
 await expect(page.locator('[data-mode="render"]')).toBeDisabled();
 await expect(page.locator('#present')).toBeDisabled();await expect(page.locator('#screenshot')).toBeDisabled();
 await page.locator('#width').fill('1000');await page.locator('#width').press('Tab');
 await expect(page.locator('#fallbackDrawing svg')).toContainText('1000 mm');
 await page.locator('#undo').click();await expect(page.locator('#width')).toHaveValue('900');
 await page.locator('#redo').click();await expect(page.locator('#width')).toHaveValue('1000');
 const saved=page.waitForEvent('download');await page.locator('#save').click();
 const project=JSON.parse(await readFile(await (await saved).path(),'utf8'));expect(project.units[0].config.width).toBe(1000);
 await page.reload();await expect(page.locator('#width')).toHaveValue('1000');
 await page.locator('#lang').click();await expect(page.locator('#renderStatus')).toContainText('ثنائي الأبعاد');
 await page.locator('[data-mode="manufacturing"]').click();await expect(page.locator('#sheetInfo')).toContainText('sheets');
 await page.locator('[data-mode="plan"]').click();await expect(page.locator('#planDrawing svg')).toBeVisible();
 await expect(page.locator('#referenceTemplates .library-item').first()).toBeVisible();
 expect(errors).toEqual([]);
});

test('module errors show accurate text and downloadable diagnostics without claiming a WebGL failure',async({page})=>{
 await page.route('**/assets/app-*.js',route=>route.fulfill({contentType:'application/javascript',body:'throw new Error("Simulated module failure <img src=x onerror=alert(1)>")'}));
 await page.goto('/');
 await expect(page.locator('#startupError')).toBeVisible();
 await expect(page.locator('#startupError')).toContainText('Simulated module failure');
 await expect(page.locator('#startupError')).not.toContainText('Enable WebGL');
 await expect(page.locator('#startupError img')).toHaveCount(0);
 const download=page.waitForEvent('download');await page.locator('#downloadDiagnostics').click();
 const report=JSON.parse(await readFile(await (await download).path(),'utf8'));
 expect(report.version).toBe('1.6.0-alpha.0');expect(report.error).toContain('Simulated module failure');expect(report).not.toHaveProperty('units');
 await expect(page.locator('#retryStartup')).toBeEnabled();
});

test('graphics context loss during presentation preserves the project and switches to 2D',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await expect(page.locator('#parts tr')).not.toHaveCount(0);
 await page.locator('#width').fill('1050');await page.locator('#width').press('Tab');
 await page.locator('#present').click();
 await page.locator('#presentationCanvas canvas').evaluate(canvas=>canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
 await expect(page.locator('#presentation')).toBeHidden();await expect(page.locator('#fallbackDrawing svg')).toBeVisible();
 await expect(page.locator('#width')).toHaveValue('1050');await page.locator('#undo').click();await expect(page.locator('#width')).toHaveValue('900');
 await page.locator('#width').fill('1100');await page.locator('#width').press('Tab');await expect(page.locator('#fallbackDrawing')).toContainText('1100 mm');
 expect(errors).toEqual([]);
});
