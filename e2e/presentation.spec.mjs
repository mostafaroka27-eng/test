import {test,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');

test('company settings, A3 shop drawings, client showroom and client PDF',async({page,context})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 await page.locator('[data-template="ncd-drawHang"]').click();
 // Nothing company-specific ships by default.
 await page.locator('[data-mode="drawings"]').click();
 await expect(page.locator('#drawingContent svg')).toContainText('Set company name and logo in Settings');
 await page.locator('#openSettings').click();
 await page.fill('#projectName','Villa A');await page.fill('#clientName','Mr. B');
 await page.fill('#companyName','Example Joinery');await page.fill('#companyPhone','+968 1');
 const logo=join(tmpdir(),'rdx-logo.png');await writeFile(logo,PNG);await page.setInputFiles('#companyLogo',logo);
 await expect(page.locator('#companyLogoPreview img')).toHaveCount(1);
 await page.fill('#companyEmail','bad');await page.locator('#settingsSave').click();
 await expect(page.locator('#settingsError')).toContainText('email');
 await page.fill('#companyEmail','info@example.com');await page.locator('#settingsSave').click();
 await expect(page.locator('#settingsDialog')).not.toBeVisible();
 const sheet=page.locator('#drawingContent svg');
 await expect(sheet).toHaveAttribute('data-scale','15');
 await expect(sheet).toContainText('Example Joinery');await expect(sheet).toContainText('Villa A');await expect(sheet).toContainText('Mr. B');
 await expect(sheet.locator('image')).toHaveCount(1);
 // Company identity survives a reload (this browser); project names travel in the project file.
 const saved=page.waitForEvent('download');await page.locator('#save').click();
 const project=JSON.parse(await readFile(await(await saved).path(),'utf8'));
 expect(project.projectName).toBe('Villa A');expect(project.clientName).toBe('Mr. B');expect(JSON.stringify(project)).not.toContain('Example Joinery');
 await page.reload();await page.locator('[data-mode="drawings"]').click();await expect(page.locator('#drawingContent svg')).toContainText('Example Joinery');
 const [set]=await Promise.all([context.waitForEvent('page'),page.locator('#printDrawingSet').click()]);
 await set.waitForLoadState();await expect(set.locator('section.sheet')).toHaveCount(2);await set.close();
 // Showroom: dollhouse stage, cards, switches, night mode and the client proposal.
 await page.locator('#present').click();
 await expect(page.locator('#presentation')).toBeVisible();await expect(page.locator('#presentationCanvas canvas')).toBeVisible();
 await expect(page.locator('#showCompany')).toHaveText('Example Joinery');await expect(page.locator('#presentationTitle')).toHaveText('Villa A');
 await expect(page.locator('.show-card')).toHaveCount(2);
 await page.locator('.show-card').nth(1).locator('[data-toggle="open"]').check();
 await page.locator('.show-card').nth(1).locator('[data-toggle="led"]').check();
 await page.locator('#showNight').click();await expect(page.locator('#showNight')).toHaveText('Day');
 await page.locator('.show-card').nth(1).click();await expect(page.locator('.show-card').nth(1)).toHaveClass(/active/);
 const [proposal]=await Promise.all([context.waitForEvent('page'),page.locator('#clientPdf').click()]);
 await proposal.waitForLoadState();
 await expect(proposal.locator('section.page')).toHaveCount(3);
 await expect(proposal.locator('body')).toContainText('Example Joinery');await expect(proposal.locator('body')).toContainText('Mr. B');
 await expect(proposal.locator('img.hero')).toHaveAttribute('src',/^data:image\/jpeg;base64,/);
 await expect(proposal.locator('img.open')).toHaveCount(1);
 await proposal.close();
 await page.locator('#closePresentation').click();await expect(page.locator('#presentation')).toBeHidden();
 await expect(page.locator('#viewport canvas')).toBeVisible();
 expect(errors).toEqual([]);
});
