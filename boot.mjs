import {version} from './package.json';

// Loading, parsing and application errors are not proof of a graphics limitation.
import('./app.mjs').catch(error => {
 console.error('RokaDex startup failed:',error);
 const section=document.createElement('section');section.id='startupError';section.className='startup-error';section.setAttribute('role','alert');
 const heading=document.createElement('h2');heading.textContent='تعذّر بدء التطبيق / Application could not start';
 const help=document.createElement('p');help.textContent='أعد تحميل الصفحة. إذا استمر الخطأ، نزّل تقرير التشخيص وأرسله للمراجعة. / Reload the page. If it still fails, download the diagnostic report for review.';
 const detail=document.createElement('pre');detail.textContent=String(error?.message||error).slice(0,600);
 const release=document.createElement('p');release.textContent='RokaDex '+version;
 const retry=document.createElement('button');retry.id='retryStartup';retry.textContent='إعادة التحميل / Reload';retry.onclick=()=>location.reload();
 const diagnostics=document.createElement('button');diagnostics.id='downloadDiagnostics';diagnostics.textContent='تنزيل التشخيص / Download diagnostics';diagnostics.onclick=()=>{
  // No saved projects, storage contents or credentials are collected.
  const report={version,error:String(error?.message||error).slice(0,600),name:String(error?.name||'Error'),browser:navigator.userAgent};
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='rokadex-startup-diagnostics.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 section.append(heading,help,release,detail,retry,diagnostics);document.getElementById('viewport').replaceChildren(section);
});
