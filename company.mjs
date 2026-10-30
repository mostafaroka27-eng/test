/**
 * Workshop identity printed on drawings, labels and client presentations.
 * Empty by default: no company name, logo, contact details or terms ship with the app.
 * Stored on this device only; never sent anywhere.
 */
export const COMPANY_STORAGE_KEY='rokadex-studio.company.v1';
export const MAX_LOGO_BYTES=400*1024;
export const EMPTY_COMPANY=Object.freeze({name:'',nameAr:'',phone:'',email:'',website:'',address:'',tagline:'',logo:''});
const LIMITS={name:120,nameAr:120,phone:60,email:120,website:160,address:240,tagline:160};
const LOGO=/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/;

const clean=(value,key)=>{
 if(value===undefined||value===null)return '';
 if(typeof value!=='string')throw Error(`Invalid company ${key}`);
 const text=value.replace(/\s+/g,' ').trim();
 if(text.length>LIMITS[key])throw Error(`Company ${key} must be at most ${LIMITS[key]} characters`);
 if(/[\u0000-\u001f\u007f<>]/.test(text))throw Error(`Company ${key} contains unsupported characters`);
 return text;
};

/** Bytes of a base64 data URL payload. */
export function dataUrlBytes(url){const payload=url.slice(url.indexOf(',')+1);return Math.floor(payload.length*3/4)-(payload.endsWith('==')?2:payload.endsWith('=')?1:0)}

export function validateLogo(logo){
 if(!logo)return '';
 if(typeof logo!=='string'||!LOGO.test(logo))throw Error('Logo must be a PNG, JPEG, WebP or SVG image');
 if(dataUrlBytes(logo)>MAX_LOGO_BYTES)throw Error(`Logo must be at most ${MAX_LOGO_BYTES/1024} KB`);
 return logo;
}

export function validateCompany(input){
 if(input===undefined||input===null)return {...EMPTY_COMPANY};
 if(typeof input!=='object'||Array.isArray(input))throw Error('Invalid company settings');
 const out={...EMPTY_COMPANY};
 for(const key of Object.keys(LIMITS))out[key]=clean(input[key],key);
 if(out.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email))throw Error('Invalid company email');
 if(out.website&&!/^(https?:\/\/)?[^\s/$.?#].[^\s]*$/i.test(out.website))throw Error('Invalid company website');
 out.logo=validateLogo(input.logo);
 return out;
}

export const hasCompany=company=>Boolean(company&&(company.name||company.nameAr||company.logo));
/** Name to print for the active language, falling back to the other language. */
export const companyName=(company,lang='en')=>lang==='ar'?company?.nameAr||company?.name||'':company?.name||company?.nameAr||'';
export const companyContact=company=>[company?.phone,company?.email,company?.website].filter(Boolean).join(' · ');

export function loadCompany(storage){
 try{const raw=storage?.getItem(COMPANY_STORAGE_KEY);return raw?validateCompany(JSON.parse(raw)):{...EMPTY_COMPANY}}
 catch{return {...EMPTY_COMPANY}}
}
export function saveCompany(storage,company){
 const valid=validateCompany(company);
 storage.setItem(COMPANY_STORAGE_KEY,JSON.stringify(valid));
 return valid;
}
