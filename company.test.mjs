import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCompany,validateLogo,loadCompany,saveCompany,companyName,companyContact,hasCompany,EMPTY_COMPANY,COMPANY_STORAGE_KEY,MAX_LOGO_BYTES} from './company.mjs';

const png='data:image/png;base64,'+Buffer.from('fake-png-bytes').toString('base64');
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),map}};

test('company settings are empty by default; nothing is pre-filled',()=>{
 assert.deepEqual(validateCompany(undefined),{...EMPTY_COMPANY});
 assert.equal(hasCompany(validateCompany({})),false);
 assert.deepEqual(loadCompany(memory()),{...EMPTY_COMPANY});
});

test('fields are trimmed, bounded and reject markup or bad formats',()=>{
 const c=validateCompany({name:'  Example   Joinery ',nameAr:'ورشة',phone:'+968 1',email:'a@b.co',website:'example.com',logo:png});
 assert.equal(c.name,'Example Joinery');assert.equal(companyName(c,'ar'),'ورشة');assert.equal(companyName(c,'en'),'Example Joinery');
 assert.equal(companyContact(c),'+968 1 · a@b.co · example.com');
 assert.throws(()=>validateCompany({name:'<script>'}),/unsupported/);
 assert.throws(()=>validateCompany({name:'x'.repeat(121)}),/at most 120/);
 assert.throws(()=>validateCompany({email:'not-an-email'}),/email/);
 assert.throws(()=>validateCompany([]),/Invalid company/);
});

test('logos must be small image data URLs',()=>{
 assert.equal(validateLogo(png),png);
 assert.throws(()=>validateLogo('data:text/html;base64,PGgxPg=='),/PNG, JPEG/);
 assert.throws(()=>validateLogo('https://example.com/logo.png'),/PNG, JPEG/);
 const big='data:image/png;base64,'+'A'.repeat(Math.ceil(MAX_LOGO_BYTES*4/3)+8);
 assert.throws(()=>validateLogo(big),/at most/);
});

test('settings round-trip through storage and corrupt storage falls back to empty',()=>{
 const storage=memory();
 saveCompany(storage,{name:'Example',logo:png});
 assert.equal(loadCompany(storage).name,'Example');assert.equal(loadCompany(storage).logo,png);
 storage.setItem(COMPANY_STORAGE_KEY,'{broken');
 assert.deepEqual(loadCompany(storage),{...EMPTY_COMPANY});
});
