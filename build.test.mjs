import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from 'vite';

test('deployable output has a root entry, local dependencies and deployment headers',async()=>{
 const output=await mkdtemp(join(tmpdir(),'rokadex-build-'));
 try{
  await build({logLevel:'silent',build:{outDir:output}});
  const html=await readFile(join(output,'index.html'),'utf8');
  assert.match(html,/<script[^>]+type="module"[^>]+src="\/assets\//);
  assert.doesNotMatch(html,/esm\.sh/);
  const names=await readdir(join(output,'assets'));
  assert.ok(names.some(name=>name.endsWith('.css')));
  for(const name of names.filter(name=>name.endsWith('.js'))){
   const script=await readFile(join(output,'assets',name),'utf8');
   assert.doesNotMatch(script,/(?:from\s*|import\s*\()\s*["']https?:\/\//);
  }
  assert.match(await readFile(join(output,'_headers'),'utf8'),/X-Content-Type-Options: nosniff/);
  assert.match(await readFile(join(output,'THIRD_PARTY_NOTICES.txt'),'utf8'),/MIT License/);
 }finally{await rm(output,{recursive:true,force:true})}
});
