import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {readPackage} from '../package.mjs';

test('approve & issue: R1 frozen, edit opens R2 draft, undo keeps the issue, issued files download, reload keeps it',async({page})=>{
 page.on('dialog',d=>d.accept());
 await page.goto('/');
 const badge=page.locator('#releaseBadge');
 await expect(badge).toHaveText('Draft R1 · not issued');
 await page.locator('text=Engineering review').first().click();
 await page.fill('#releaseNote','Approved by client');await page.click('#issueRelease');
 await expect(badge).toHaveText('Issued R1');await expect(page.locator('#issueRelease')).toBeDisabled();
 await page.locator('text=3D design').first().click();
 await page.fill('#width','700');await page.press('#width','Tab');
 await expect(badge).toHaveText('Draft R2 · changed since R1');await expect(page.locator('#designRevision')).toHaveValue('2');
 await page.click('#undo');await page.click('#undo');
 await expect(badge).toHaveText('Issued R1');
 await page.click('#redo');await page.click('#redo');
 await expect(badge).toHaveText('Draft R2 · changed since R1');
 await page.locator('text=Engineering review').first().click();
 const csv=page.waitForEvent('download');await page.click('[data-release-csv="1"]');
 const text=await readFile(await (await csv).path(),'utf8');
 expect(text.split('\n')[3]).toContain('"1"');expect(text).toContain('"864"');expect(text).not.toContain('"664"');
 const pk=page.waitForEvent('download');await page.click('[data-release-package="1"]');
 const pd=await pk;expect(pd.suggestedFilename()).toMatch(/-R1\.rokadex-package\.json$/);
 const pkg=readPackage(await readFile(await pd.path(),'utf8'));expect(pkg.project.revision).toBe(1);expect(pkg.design.units[0].config.width).not.toBe(700);
 await page.reload();
 await expect(badge).toHaveText('Draft R2 · changed since R1');await expect(page.locator('.release-row')).toHaveCount(1);
});
