import {test,expect} from '@playwright/test';

test('focus workspace expands the canvas and Escape restores panels without changing the design',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await expect(page.locator('#width')).toHaveValue('900');
 await page.locator('#width').fill('1040');await page.locator('#width').press('Tab');
 const original=await page.locator('#viewport canvas').boundingBox();
 const rows=await page.locator('#parts').innerText();
 await page.locator('#focusWorkspace').click();
 await expect(page.locator('#focusWorkspace')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#properties')).toBeHidden();await expect(page.locator('#library')).toBeHidden();
 await expect.poll(async()=> (await page.locator('#viewport canvas').boundingBox()).width).toBeGreaterThan(original.width+400);
 await page.locator('[data-mode="drawings"]').click();await expect(page.locator('#drawingContent svg')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('#properties')).toBeVisible();await expect(page.locator('#library')).toBeVisible();
 await expect(page.locator('#focusWorkspace')).toBeFocused();await expect(page.locator('#width')).toHaveValue('1040');
 expect(await page.locator('#parts').innerText()).toBe(rows);expect(errors).toEqual([]);
});

test('Arabic layout fits phone and tablet, with direct access to properties and library',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await page.locator('#lang').click();
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await expect(page.locator('#focusWorkspace')).toHaveText('توسيع مساحة العمل');
 for(const width of [1440,1024,768,390]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const toolbar=await page.locator('.viewport-toolbar').boundingBox();
  const focus=await page.locator('#focusWorkspace').boundingBox();
  expect(focus.x).toBeGreaterThanOrEqual(toolbar.x);expect(focus.x+focus.width).toBeLessThanOrEqual(toolbar.x+toolbar.width+1);
 }
 await page.locator('.mobile-panel-links a[href="#properties"]').click();
 await expect(page.locator('#width')).toBeInViewport();await page.locator('#width').fill('1100');await page.locator('#width').press('Tab');
 await expect(page.locator('#width')).toHaveValue('1100');
 await page.locator('.mobile-panel-links a[href="#library"]').click();
 await expect(page.locator('#addCab')).toBeInViewport();await page.locator('#addBase').click();await expect(page.locator('#tree button')).toHaveCount(2);
 await page.locator('[data-mode="references"]').click();await expect(page.locator('#referenceSource')).toBeVisible();
 await page.locator('[data-mode="design"]').click();await page.locator('#focusWorkspace').click();
 await expect(page.locator('#focusWorkspace')).toHaveText('إظهار اللوحات');await page.keyboard.press('Escape');
 expect(errors).toEqual([]);
});
