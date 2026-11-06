import {test,expect} from '@playwright/test';

/*
 * Company cloud inside Rokadex (Studio served at app.rokadex.com/studio/).
 * The container cannot reach Supabase, so the real supabase-js in Studio talks to a fake HTTP backend
 * (page.route) that keeps the database update 016 rules: version +1 on every save, unique (company, studio id),
 * only owner/admin/manager with the Design add-on and an active subscription may write, members may read.
 * The real rules are proven on Postgres by supabase/tests/rls_tests_016.sql in the management source.
 */
const SB='https://fakeproj.supabase.co',WS='11111111-aaaa-4aaa-8aaa-111111111111',P1='22222222-bbbb-4bbb-8bbb-222222222222';

function backend({role='manager',design=true,active=true}={}){
 const db={studio:[],files:new Map(),seq:0,log:[]};
 const write=()=>design&&active&&['owner','admin','manager'].includes(role);
 const json=(route,status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 const filters=url=>[...url.searchParams].filter(([k])=>!['select','order','limit'].includes(k)).map(([k,v])=>r=>String(r[k])===v.replace(/^eq\./,''));
 async function handle(route){
  const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
  db.log.push(method+' '+path);
  if(path==='/rest/v1/memberships')return json(route,200,[{role,workshop_id:WS,workshops:{id:WS,name:'Al Noor Joinery',plan:'pro'}}]);
  if(path==='/rest/v1/workshop_modules')return json(route,200,[{module:'design',enabled:design}]);
  if(path==='/rest/v1/projects')return json(route,200,[{id:P1,name:'Villa wardrobe',client:'Mr Salim',legacy_code:'P-01'}]);
  if(path.startsWith('/rest/v1/rpc/')){
   const fn=path.slice(13),a=req.postDataJSON()??{};
   if(fn==='workshop_active')return json(route,200,active);
   if(fn==='storage_reserve'){if(!a.p_name.startsWith(a.p_ws+'/'))return json(route,400,{message:'The file path must start with the company folder'});return json(route,200,{id:'res'+(++db.seq)})}
   if(fn==='storage_commit')return json(route,200,{ok:true});
   return json(route,200,null);
  }
  if(path==='/rest/v1/studio_projects'){
   const f=filters(url);
   if(!design)return json(route,200,method==='GET'?[]:[]);
   if(method==='GET')return json(route,200,db.studio.filter(r=>f.every(fn=>fn(r))).sort((x,y)=>x.updated_at<y.updated_at?1:-1));
   if(!write())return json(route,403,{code:'42501',message:'new row violates row-level security policy for table "studio_projects"'});
   if(method==='POST'){const v=req.postDataJSON();const row=Array.isArray(v)?v[0]:v;
    if(db.studio.some(r=>r.workshop_id===row.workshop_id&&r.studio_id===row.studio_id))return json(route,409,{code:'23505',message:'duplicate key value violates unique constraint "studio_projects_workshop_id_studio_id_key"'});
    const r={id:'sp'+(++db.seq),version:1,updated_at:new Date().toISOString(),...row};db.studio.push(r);return json(route,201,[r])}
   if(method==='PATCH'){const hit=db.studio.filter(r=>f.every(fn=>fn(r)));const v=req.postDataJSON();hit.forEach(r=>{Object.assign(r,v);r.version++;r.updated_at=new Date().toISOString()});return json(route,200,hit)}
   if(method==='DELETE'){db.studio=db.studio.filter(r=>!f.every(fn=>fn(r)));return json(route,204,null)}
  }
  if(path.startsWith('/storage/v1/object/files')){
   if(method==='DELETE'){const {prefixes}=req.postDataJSON();prefixes.forEach(p=>db.files.delete(p));return json(route,200,prefixes.map(name=>({name})))}
   const name=decodeURIComponent(path.replace(/^\/storage\/v1\/object\/(authenticated\/)?files\//,''));
   if(method==='POST'||method==='PUT'){if(!write()&&role!=='worker')return json(route,403,{message:'denied'});const raw=req.postData()??'';db.files.set(name,raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1)); /* supabase-js sends a Blob as multipart form data */return json(route,200,{Key:'files/'+name})}
   if(method==='GET')return db.files.has(name)?route.fulfill({status:200,contentType:'application/json',body:db.files.get(name)}):json(route,404,{message:'Object not found'});
  }
  return json(route,404,{message:'not faked: '+method+' '+path});
 }
 return {db,handle};
}

async function inRokadex(page,opts={},{signedIn=true}={}){
 const be=backend(opts);
 await page.route('**/rokadex-config.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({supabaseUrl:SB,supabaseKey:'sb_publishable_test',appUrl:'../'})}));
 await page.route(SB+'/**',be.handle);
 await page.addInitScript(({signedIn,ws})=>{
  if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');
  localStorage.setItem('warsha-ws',ws);
  if(signedIn)localStorage.setItem('sb-fakeproj-auth-token',JSON.stringify({access_token:'test-token',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'r',user:{id:'u-m',email:'manager@noor.test',aud:'authenticated',role:'authenticated'}}));
 },{signedIn,ws:WS});
 return be;
}
const answers=page=>{const q=[];page.on('dialog',d=>{const a=q.shift();a===false?d.dismiss():d.accept()});return q};

test('standalone Studio (no Rokadex config) stays local: no cloud button, no network to Supabase',async({page})=>{
 const calls=[];page.on('request',r=>{if(/supabase/.test(r.url()))calls.push(r.url())});
 await page.goto('/');await page.waitForTimeout(800);
 await expect(page.locator('#cloudBtn')).toBeHidden();
 await expect(page.locator('#workspaceBadge')).toHaveText('LOCAL WORKSPACE');
 await expect(page.locator('[data-release-send]')).toHaveCount(0);
 expect(calls).toEqual([]);
});

test('signed out inside Rokadex: the panel says so and links to the sign-in',async({page})=>{
 await inRokadex(page,{},{signedIn:false});
 await page.goto('/');await page.click('#cloudBtn');
 await expect(page.locator('#cloudBody')).toContainText('not signed in to Rokadex');
 await expect(page.locator('#cloudBody a.primary-link')).toHaveAttribute('href','../');
});

test('manager saves, edits, saves again (version 2), reopens by link, and a stale save is refused',async({page,context})=>{
 const q=answers(page);
 const be=await inRokadex(page);
 await page.goto('/');
 await page.click('#cloudBtn');
 await expect(page.locator('#cloudBody')).toContainText('manager@noor.test');
 await expect(page.locator('#cloudBody')).toContainText('Al Noor Joinery');
 await expect(page.locator('#cloudBody')).toContainText('No Studio projects in the cloud yet');
 await page.selectOption('#cloudLinkProject',P1);
 await page.click('#cloudSave');
 await expect(page.locator('.cloud-ok')).toContainText('version 1');
 expect(be.db.studio).toHaveLength(1);
 const row=be.db.studio[0];
 expect(row.workshop_id).toBe(WS);expect(row.project_id).toBe(P1);expect(row.object_name.startsWith(WS+'/studio-projects/'+row.studio_id+'/')).toBe(true);
 expect(be.db.files.has(row.object_name)).toBe(true);
 expect(be.db.log.filter(l=>/rpc\/storage_(reserve|commit)/.test(l))).toHaveLength(2);
 await page.click('#cloudDialog button[value=cancel]');
 await expect(page.locator('#workspaceBadge')).toHaveText('COMPANY CLOUD · v1');
 // edit → badge says unsaved → save again
 await page.fill('#width','700');await page.press('#width','Tab');
 await expect(page.locator('#workspaceBadge')).toContainText('unsaved changes');
 await page.click('#cloudBtn');await page.click('#cloudSave');
 await expect(page.locator('.cloud-ok')).toContainText('version 2');
 expect(be.db.studio[0].version).toBe(2);expect(be.db.files.size).toBe(1);
 expect(JSON.parse(be.db.files.get(be.db.studio[0].object_name)).units[0].config.width).toBe(700);
 await page.click('#cloudDialog button[value=cancel]');
 // open by link (?cloud=<id>) in a fresh tab of the same browser
 const p2=await context.newPage();await p2.route('**/rokadex-config.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({supabaseUrl:SB,supabaseKey:'k'})}));await p2.route(SB+'/**',be.handle);
 p2.on('dialog',d=>d.accept());
 await p2.goto('/?cloud='+encodeURIComponent(row.studio_id));
 await expect(p2.locator('#workspaceBadge')).toHaveText('COMPANY CLOUD · v2');
 await expect(p2.locator('#width')).toHaveValue('700');
 expect(new URL(p2.url()).search).toBe('');
 // someone else saves (version 3) → this tab's save is refused; "Cancel" twice = keep mine, no copy
 be.db.studio[0].version=3;
 await page.fill('#width','650');await page.press('#width','Tab');
 q.push(false,false);
 await page.click('#cloudBtn');await page.click('#cloudSave');
 await expect(page.locator('.cloud-error')).toContainText('Someone else saved this project');
 expect(be.db.studio).toHaveLength(1);expect(be.db.studio[0].version).toBe(3);expect(be.db.files.size).toBe(1);
 // try again, choose "save as a separate copy"
 q.push(false,true);
 await page.click('#cloudSave');
 await expect(page.locator('.cloud-ok')).toContainText('version 1');
 expect(be.db.studio).toHaveLength(2);
 expect(be.db.studio[1].studio_id).toMatch(new RegExp('^'+row.studio_id+'-C'));
 expect(be.db.studio[0].version).toBe(3);
});

test('worker can open but not save; Design add-on off and ended subscription are explained',async({browser})=>{
 for(const [opts,text,canSave] of [[{role:'worker'},'Only managers, admins and the owner',false],[{design:false},'part of the Design add-on',false],[{active:false},'subscription has ended',false]]){
  const ctx=await browser.newContext();const page=await ctx.newPage();
  await inRokadex(page,opts);await page.goto('/');await page.click('#cloudBtn');
  await expect(page.locator('.cloud-warn')).toContainText(text);
  if(opts.design===false)await expect(page.locator('#cloudSave')).toHaveCount(0);
  else await expect(page.locator('#cloudSave')).toBeDisabled();
  expect(canSave).toBe(false);
  await ctx.close();
 }
});

test('issued revision: "Send to project in Rokadex" hands the package to the management import page',async({page,context})=>{
 page.on('dialog',d=>d.accept());
 await inRokadex(page);await page.goto('/');
 await page.click('#cloudBtn');await page.selectOption('#cloudLinkProject',P1);await page.click('#cloudSave');await expect(page.locator('.cloud-ok')).toContainText('version 1');
 await page.click('#cloudDialog button[value=cancel]');
 await page.locator('text=Engineering review').first().click();
 await page.fill('#releaseNote','Approved');await page.click('#issueRelease');
 await expect(page.locator('[data-release-send="1"]')).toBeVisible();
 const popup=context.waitForEvent('page');
 await page.click('[data-release-send="1"]');
 const mgmt=await popup;
 expect(new URL(mgmt.url()).pathname).toBe('/');expect(new URL(mgmt.url()).hash).toBe('#studio');
 const h=JSON.parse(await page.evaluate(()=>localStorage.getItem('rokadex-studio-handoff')));
 expect(h.ws).toBe(WS);expect(h.projectLink).toBe(P1);expect(h.pkg.format).toBe('rokadex-studio-package');expect(h.pkg.project.revision).toBe(1);
 expect(Date.now()-h.at).toBeLessThan(60000);
});
