const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const API='http://127.0.0.1:8000/api/v1';
async function main(){
  const output=process.env.OFFICE_TRACE_OUTPUT || await fs.mkdtemp(path.join(os.tmpdir(),'office-revisions-'));
  await fs.mkdir(output,{recursive:true});
  const trace=[], cleanup=[]; let phase='inicio';
  assert.equal((await (await fetch('http://127.0.0.1:8000/health')).json()).environment,'isolated-chat-test');
  const r=await fetch(API+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:`office${Date.now()}@example.com`,password:'OfficeBrowser123',full_name:'Prueba Office'})});
  const {access_token:token}=await r.json(); assert.ok(token);
  const user=await (await fetch(API+'/auth/me',{headers:{Authorization:'Bearer '+token}})).json();
  const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  const read=async id=>{
    const response=await fetch(API+'/office/documents/'+id,{headers});assert.ok(response.ok);return response.json();
  };
  async function eventually(check,label){
    const end=Date.now()+30000;
    while(Date.now()<end){if(await check())return;await new Promise(resolve=>setTimeout(resolve,100));}
    assert.fail(label);
  }
  async function bounded(promise,label){
    let timer;
    try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label)),15000);})]);}
    finally{clearTimeout(timer);}
  }
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  await context.exposeBinding('officeTrace',(_source,event)=>{trace.push({phase,...event});});
  await context.addInitScript(()=>{
    const instance=crypto.randomUUID(), original=window.fetch;
    const record=event=>void window.officeTrace({instance,at:Date.now(),page:location.pathname,...event}).catch(()=>{});
    window.addEventListener('pagehide',()=>record({event:'pagehide'}));
    window.fetch=function(input,options){
      const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
      if(!url.includes('/api/v1/office/documents'))return original.call(this,input,options);
      const id=crypto.randomUUID(), method=options?.method || 'GET';
      let body;try{body=JSON.parse(options?.body)}catch{}
      record({event:'request',id,url:new URL(url,location.href).pathname,method,keepalive:options?.keepalive || false,revision:body?.revision,content:body?.content,title:body?.title});
      return original.call(this,input,options).then(response=>{
        void response.clone().json().then(body=>record({event:'response',id,status:response.status,revision:body?.revision,document:body?.id,detail:body?.detail})).catch(()=>{});
        return response;
      },error=>{record({event:'network-error',id,message:error.message});throw error;});
    };
  });
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try {
  await context.addInitScript(({token,user})=>{localStorage.setItem('autopilot_token',token);localStorage.setItem('autopilot_user',JSON.stringify(user));localStorage.setItem('hasCompletedOnboarding_v1','true');}, {token,user});
  await page.goto('http://localhost:3000/office');
  await page.evaluate(()=>localStorage.setItem('academic-office-document-v1',JSON.stringify({name:'Borrador auditado',html:'<h1>Álgebra</h1><p><strong>Texto recuperado</strong></p>'})));
  await page.reload();
  await page.getByRole('button',{name:'Guardar en la app',exact:true}).click();
  await page.waitForURL(/office\/[a-f0-9-]+$/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('academic-office-document-v1')),null);

  const editor=page.locator('.ck-editor__editable[contenteditable=true]');await editor.waitFor({timeout:60000});
  assert.ok((await editor.innerHTML()).includes('<strong>Texto recuperado</strong>'));
  await editor.fill('Versión nueva para estudiar');
  await page.getByRole('status').filter({hasText:'Guardado'}).first().waitFor();
  await page.waitForTimeout(1800);
  await page.getByRole('button',{name:'Volver a Office',exact:true}).click();
  await page.locator('article').first().locator('summary').click();
  await page.getByRole('button',{name:'Duplicar',exact:true}).click();
  await page.getByRole('button').filter({hasText:'Borrador auditado (copia)'}).first().waitFor();
  const original = page.locator('article').filter({has: page.locator('strong').filter({hasText:/^Borrador auditado$/})});
  if (!await original.locator('details').evaluate(e => e.open)) await original.locator('summary').click();
  await original.getByRole('button',{name:'Historial',exact:true}).click();
  await page.getByRole('button',{name:'Restaurar',exact:true}).last().click();

  phase='restauración y recarga';
  await editor.waitFor(); assert.ok((await editor.innerText()).includes('Texto recuperado'));
  await page.reload();

  await editor.waitFor();assert.ok((await editor.innerText()).includes('Texto recuperado'));
  await page.getByRole('button',{name:'Archivo',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');
  await page.getByText('Guardar en el PC (.html)',{exact:true}).click();
  const download=await downloadPromise;
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'office-browser-'));const html=path.join(dir,download.suggestedFilename());await download.saveAs(html);
  assert.ok((await fs.readFile(html,'utf8')).includes('Texto recuperado'));
  await page.getByRole('button',{name:'Archivo',exact:true}).click();
  phase='importación HTML';
  const chooser=page.waitForEvent('filechooser');await page.getByText('Abrir desde el PC...',{exact:true}).click();await (await chooser).setFiles(html);
  await editor.waitFor();await page.waitForTimeout(2000);assert.ok((await editor.innerText()).includes('Texto recuperado'));
  assert.equal(trace.filter(e=>e.phase==='importación HTML'&&e.status===409).length,0,'La apertura del importado debe esperar al guardado saliente, sin PUT desfasados');
  // Offline draft survives, then retries against the real API.
  phase='desconexión';
  await page.route('**/api/v1/office/documents**', route => route.abort());
  await editor.fill('Borrador sin conexión');
  await page.getByRole('status').filter({hasText:'Sin conexión'}).waitFor();
  assert.ok(await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('academic-office-draft:') && localStorage[k].includes('Borrador sin conexión'))));
  await page.unroute('**/api/v1/office/documents**');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.getByRole('status').filter({hasText:'Guardado'}).waitFor();
  // A second client writes first; this editor must retain its own draft.
  const docs=await (await fetch(API+'/office/documents',{headers})).json();
  const current=await (await fetch(API+'/office/documents/'+docs[0].id,{headers})).json();
  const payload=Object.fromEntries(['title','kind','content','schema_version','settings','folder','revision'].map(k=>[k,current[k]]));
  const remote=await fetch(API+'/office/documents/'+current.id,{method:'PUT',headers,body:JSON.stringify({...payload,content:'<p>Cambio remoto</p>'})}); assert.ok(remote.ok);
  await editor.fill('Mi cambio en conflicto');
  await page.getByRole('status').filter({hasText:'Conflicto de versión'}).waitFor();
  assert.ok(await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('academic-office-draft:') && localStorage[k].includes('Mi cambio en conflicto'))));
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.getByRole('status').filter({hasText:'Conflicto de versión'}).waitFor();
  assert.ok((await read(current.id)).content.includes('Cambio remoto'),'Reconectar no debe sobrescribir un conflicto real');
  await page.getByRole('button',{name:'Guardar como copia',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Guardado'}).waitFor();
  await eventually(()=>!page.url().endsWith(current.id),'La copia debe abrir su propia ruta');
  assert.ok((await read(current.id)).content.includes('Cambio remoto'),'El conflicto real no debe sobrescribir el servidor');

  phase='respuesta perdida y recuperación';
  const copyId=page.url().split('/').pop(), copyUrl='**/api/v1/office/documents/'+copyId;
  let lost=false,offline=true;
  await page.route(copyUrl,async route=>{
    if(route.request().method()!=='PUT')return route.continue();
    if(lost)return offline?route.abort():route.continue();
    lost=true;const response=await route.fetch();assert.ok(response.ok());
    await route.abort(); // El servidor confirmó el guardado, pero el editor no recibió la respuesta.
  });
  await editor.fill('Contenido confirmado con respuesta perdida');
  await page.getByRole('status').filter({hasText:'Sin conexión'}).waitFor();
  assert.ok((await read(copyId)).content.includes('respuesta perdida'));
  offline=false;
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.getByRole('status').filter({hasText:'Guardado'}).waitFor();
  assert.equal(await page.getByRole('status').filter({hasText:'Conflicto de versión'}).count(),0);
  // La respuesta perdida no debe bloquear tampoco las ediciones posteriores.
  lost=false;offline=true;
  await editor.fill('Primer envío confirmado sin respuesta');
  await page.getByRole('status').filter({hasText:'Sin conexión'}).waitFor();
  await editor.fill('Edición posterior a la respuesta perdida');
  await eventually(()=>page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('academic-office-draft:')&&localStorage[k].includes('Edición posterior'))),'Conservar la edición posterior en el borrador');
  offline=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.getByRole('status').filter({hasText:'Guardado'}).waitFor();
  assert.ok((await read(copyId)).content.includes('Edición posterior'));
  await page.unroute(copyUrl);

  phase='importación con PUT pendiente';
  let entered,release,delivered,deliveryError;
  const pendingPut=new Promise(resolve=>{entered=resolve}),gate=new Promise(resolve=>{release=resolve});
  const delivery=new Promise(resolve=>{delivered=resolve});
  cleanup.push(release);
  let held=false;
  await page.route(copyUrl,async route=>{
    if(route.request().method()!=='PUT'||held)return route.continue();
    held=true;const response=await route.fetch();entered();await gate;
    try{await route.fulfill({response});}catch(error){deliveryError=error;}finally{delivered();}
  });
  await editor.fill('Último contenido antes de importar, debe conservarse');
  await bounded(pendingPut,'Debe comenzar el PUT retenido antes de importar');
  const postCount=trace.filter(e=>e.event==='request'&&e.method==='POST'&&e.url==='/api/v1/office/documents').length;
  await page.getByRole('button',{name:'Archivo',exact:true}).click();
  const pendingChooser=page.waitForEvent('filechooser');await page.getByText('Abrir desde el PC...',{exact:true}).click();await(await pendingChooser).setFiles(html);
  assert.equal(trace.filter(e=>e.event==='request'&&e.method==='POST'&&e.url==='/api/v1/office/documents').length,postCount,'Importar debe esperar al PUT anterior');
  assert.ok(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('academic-office-draft:')&&localStorage[k].includes('Último contenido antes de importar'))));
  release();await bounded(delivery,'Debe entregarse la respuesta del PUT retenido');assert.equal(deliveryError,undefined);await page.unroute(copyUrl);
  await eventually(()=>page.url().split('/').pop()!==copyId,'La importación debe abrir otro documento');
  await editor.waitFor();
  assert.ok((await read(copyId)).content.includes('Último contenido antes de importar'));
  assert.ok((await editor.innerText()).includes('Texto recuperado'));
  const importedId=page.url().split('/').pop();
  await eventually(async()=>!(await page.getByRole('status').innerText()).includes('Guardando'),'La importación debe terminar de guardar');
  assert.equal(await page.getByRole('status').filter({hasText:'Conflicto de versión'}).count(),0);

  phase='cambio rápido mientras abre otro documento';
  await page.getByRole('button',{name:'Volver a Office',exact:true}).click();await page.waitForURL('**/office');
  let opening,finishOpen;
  const opened=new Promise(resolve=>{opening=resolve}),openGate=new Promise(resolve=>{finishOpen=resolve});
  cleanup.push(finishOpen);
  await page.route(copyUrl,async route=>{
    if(route.request().method()!=='GET')return route.continue();
    const response=await route.fetch();opening();await openGate;
    await route.fulfill({response}).catch(()=>{}); // La navegación puede cancelar esta lectura.
  });
  const copyTitle=(await read(copyId)).title;
  await page.locator('article button').filter({has:page.getByText(copyTitle,{exact:true})}).first().click();await bounded(opened,'Debe comenzar la apertura retenida');
  await page.goBack();await page.waitForURL('**/office');
  const importedTitle=(await read(importedId)).title;
  await page.locator('article button').filter({has:page.getByText(importedTitle,{exact:true})}).first().click();
  await page.waitForURL('**/office/'+importedId);await editor.waitFor();
  finishOpen();await page.unroute(copyUrl);
  assert.ok((await editor.innerText()).includes('Texto recuperado'),'Una lectura antigua no debe reemplazar el documento actual');
  assert.ok((await read(copyId)).content.includes('Último contenido antes de importar'));
  assert.equal(trace.filter(e=>e.phase==='importación con PUT pendiente'&&e.status===409).length,0,'La importación con guardado pendiente tampoco debe enviar revisiones antiguas');
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Volver a Office',exact:true}).click();
  await page.getByRole('textbox',{name:'Buscar documentos'}).fill('Borrador');
  await page.locator('article').first().waitFor();
  assert.deepEqual(errors,[]); console.log('PASS migration, autosave, restore, import with pending PUT, offline retry, lost response, real conflict/copy, rapid navigation, content preservation and mobile library');
  } finally {
    cleanup.forEach(release=>release());
    await fs.writeFile(path.join(output,'revisions.json'),JSON.stringify(trace,null,2));
    console.log('Office revision trace: '+output);
    await browser.close();
  }
}
main().catch(e=>{console.error(e);process.exit(1)});
