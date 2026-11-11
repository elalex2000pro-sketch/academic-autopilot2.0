const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const API='http://127.0.0.1:8000/api/v1';
async function main(){
  assert.equal((await (await fetch('http://127.0.0.1:8000/health')).json()).environment,'isolated-chat-test');
  const r=await fetch(API+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:`office${Date.now()}@example.com`,password:'OfficeBrowser123',full_name:'Prueba Office'})});
  const {access_token:token}=await r.json(); assert.ok(token);
  const user=await (await fetch(API+'/auth/me',{headers:{Authorization:'Bearer '+token}})).json();
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
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
  const chooser=page.waitForEvent('filechooser');await page.getByText('Abrir desde el PC...',{exact:true}).click();await (await chooser).setFiles(html);
  await editor.waitFor();await page.waitForTimeout(2000);assert.ok((await editor.innerText()).includes('Texto recuperado'));
  // Offline draft survives, then retries against the real API.
  await page.route('**/api/v1/office/documents**', route => route.abort());
  await editor.fill('Borrador sin conexión');
  await page.getByRole('status').filter({hasText:'Sin conexión'}).waitFor();
  assert.ok(await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('academic-office-draft:') && localStorage[k].includes('Borrador sin conexión'))));
  await page.unroute('**/api/v1/office/documents**');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.getByRole('status').filter({hasText:'Guardado'}).waitFor();
  // A second client writes first; this editor must retain its own draft.
  const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  const docs=await (await fetch(API+'/office/documents',{headers})).json();
  const current=await (await fetch(API+'/office/documents/'+docs[0].id,{headers})).json();
  const payload=Object.fromEntries(['title','kind','content','schema_version','settings','folder','revision'].map(k=>[k,current[k]]));
  const remote=await fetch(API+'/office/documents/'+current.id,{method:'PUT',headers,body:JSON.stringify({...payload,content:'<p>Cambio remoto</p>'})}); assert.ok(remote.ok);
  await editor.fill('Mi cambio en conflicto');
  await page.getByRole('status').filter({hasText:'Conflicto de versión'}).waitFor();
  assert.ok(await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('academic-office-draft:') && localStorage[k].includes('Mi cambio en conflicto'))));
  await page.getByRole('button',{name:'Guardar como copia',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Guardado'}).waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Volver a Office',exact:true}).click();
  await page.getByRole('textbox',{name:'Buscar documentos'}).fill('Borrador');
  await page.locator('article').first().waitFor();
  assert.deepEqual(errors,[]); console.log('PASS migration, create, autosave, close/reopen, copy, restore, HTML download/open, offline retry, conflict recovery and mobile library');
  await browser.close();
}
main().catch(e=>{console.error(e);process.exit(1)});
