import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('cnc & beam saw: kitchen sample → toolpath preview passes the check, G-code and saw files download',async({page})=>{
 page.on('dialog',d=>d.accept());
 await page.goto('/');
 await page.setInputFiles('#file','samples/kitchen-concept.json');
 await page.locator('text=Engineering review').first().click();
 await page.selectOption('#cnc_tabs','2');
 await page.click('#cncPreviewBtn');
 await expect(page.locator('#cncStatus')).toContainText('no move leaves the sheet');
 await expect(page.locator('#cncPreview svg')).toBeVisible();
 expect(await page.locator('#cncSheet option').count()).toBeGreaterThan(1);
 const g=page.waitForEvent('download');await page.click('#cncGcode');
 const dl=await g;expect(dl.suggestedFilename()).toMatch(/sheet1-UNVERIFIED\.nc$/);
 const text=await readFile(await dl.path(),'utf8');
 expect(text).toContain('(RokaDex Studio - UNVERIFIED');expect(text).toContain('M3 S18000');expect(text.trimEnd().endsWith('M30')).toBe(true);
 // Machine settings persist in this browser.
 await page.fill('#cnc_toolDiameter','8');await page.click('#cncPreviewBtn');
 await page.reload();await page.locator('text=Engineering review').first().click();
 await expect(page.locator('#cnc_toolDiameter')).toHaveValue('8');
 const c=page.waitForEvent('download');await page.click('#sawCsvSemi');
 const csv=await readFile(await (await c).path(),'utf8');expect(csv).toMatch(/^﻿Row;Material;Thickness;Length/);
 const q=page.waitForEvent('download');await page.click('#sawSeqCsv');
 expect(await readFile(await (await q).path(),'utf8')).toContain('rip');
 const pop=page.waitForEvent('popup');await page.click('#sawPlan');
 const w=await pop;await expect(w.locator('h1')).toContainText('Beam saw cutting plan');
});
