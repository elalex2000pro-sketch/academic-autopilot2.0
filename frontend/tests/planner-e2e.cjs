/* Route safety net. Real browser + isolated REST/WS; no external credentials.
 * npm run test:smoke starts owned servers (never reuses a running API).
 * --no-start uses explicitly started isolated servers; API health must match.
 * SMOKE_WEB_MODE=start needs a prior build with NEXT_PUBLIC_API_URL=the test API.
 */
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const API = process.env.SMOKE_API || 'http://127.0.0.1:8000';
const WEB = process.env.SMOKE_WEB || 'http://localhost:3000';
const FRONTEND = path.resolve(__dirname, '..');
const ROOT = path.resolve(FRONTEND, '..');
const servers = [];
let browser;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, timeout = 90000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await check()) return; await sleep(200); }
  throw new Error('Timeout: ' + label);
}
async function freePort(url) {
  const port = Number(new URL(url).port || 80);
  await new Promise((resolve, reject) => {
    const probe = net.createServer(); probe.once('error', () => reject(new Error(`Port ${port} occupied; smoke refuses to use or stop another server. Use --no-start only with the isolated API.`)));
    probe.listen(port, () => probe.close(resolve));
  });
}
function start(command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  const entry = { child, log: '' }; servers.push(entry);
  const collect = data => { entry.log = (entry.log + data).slice(-12000); };
  child.stdout.on('data', collect); child.stderr.on('data', collect);
  child.on('error', error => collect(error.message));
  return entry;
}
async function request(route, token, method = 'GET', data) {
  const result = await fetch(API + '/api/v1' + route, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) });
  assert.ok(result.ok, `${route}: ${result.status} ${result.ok ? '' : await result.text()}`);
  return result.status === 204 ? null : result.json();
}
function pdfFixture() {
  const stream = 'BT /F1 18 Tf 40 140 Td (Smoke reader fixture) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let value = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(value)); value += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(value); value += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(value);
}
async function main() {
  const output = process.env.SMOKE_OUTPUT || await fs.mkdtemp(path.join(os.tmpdir(), 'academic-smoke-'));
  await fs.mkdir(output, { recursive: true });
  console.log('Smoke artifacts: ' + output);
  if (!process.argv.includes('--no-start')) {
    assert.ok(['localhost', '127.0.0.1'].includes(new URL(API).hostname) && ['localhost', '127.0.0.1'].includes(new URL(WEB).hostname), 'Owned servers must be local');
    await freePort(API); await freePort(WEB);
    const localPython = path.join(ROOT, '.venv311', 'Scripts', 'python.exe');
    const python = process.env.SMOKE_PYTHON || (process.platform === 'win32' ? localPython : 'python3');
    const apiServer = start(python, ['-m', 'uvicorn', 'chat_test_server:app', '--app-dir', 'tests', '--host', '0.0.0.0', '--port', new URL(API).port], path.join(ROOT, 'backend'), { AUTOPILOT_TEST_DIR: path.join(output, 'database'), AI_ENABLED: 'false' });
    await until(async () => { if (apiServer.child.exitCode !== null) throw new Error(apiServer.log); try { return (await fetch(API + '/health')).ok; } catch { return false; } }, 'API startup');
    const mode = process.env.SMOKE_WEB_MODE || 'dev';
    assert.ok(['start', 'dev'].includes(mode));
    start(process.execPath, [require.resolve('next/dist/bin/next'), mode, '-p', new URL(WEB).port], FRONTEND, { NEXT_PUBLIC_API_URL: API, NEXT_TELEMETRY_DISABLED: '1' });
    await until(async () => { try { return (await fetch(WEB + '/login')).ok; } catch { return false; } }, 'web startup', 180000);
  }
  assert.equal((await (await fetch(API + '/health')).json()).environment, 'isolated-chat-test', 'Never run against production');

  browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER_CHANNEL === 'chromium' ? undefined : 'chrome' });
  const reports = [];
  for (const viewport of [{width:1440,height:960},{width:390,height:844}]) {
    const {access_token:token}=await request('/auth/register',null,'POST',{email:`planner-${viewport.width}-${Date.now()}@example.com`,password:'PlannerBrowser123',full_name:'Prueba Planificador'});
    const user=await request('/auth/me',token);
    const course=await request('/courses',token,'POST',{name:'Redes de prueba'});
    const context=await browser.newContext({viewport,serviceWorkers:'block'});
    await context.addInitScript(({token,user})=>{localStorage.setItem('autopilot_token',token);localStorage.setItem('autopilot_user',JSON.stringify(user));localStorage.setItem('hasCompletedOnboarding_v1','true');},{token,user});
    const page=await context.newPage();const errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    const day=new Date();const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const today=key(day);const tomorrowDate=new Date(day);tomorrowDate.setDate(day.getDate()+1);const tomorrow=key(tomorrowDate);
    async function go(route){await page.goto(WEB+route,{waitUntil:'domcontentloaded'});await page.locator('#quick-event-title').waitFor();await page.waitForLoadState('networkidle');await page.getByRole('button',{name:'Nuevo Evento',exact:false}).count();}
    async function check(name,fn){try{await fn();reports.push({viewport:viewport.width,name,status:'passed'});console.log('PASS',viewport.width,name)}catch(error){reports.push({viewport:viewport.width,name,status:'pending',reason:error.message});console.log('PENDING',viewport.width,name,error.message.split('\n')[0]);await page.screenshot({path:path.join(output,`${viewport.width}-${reports.length}.png`),fullPage:true}).catch(()=>{});}finally{await fs.writeFile(path.join(output,'report.json'),JSON.stringify(reports,null,2));}}
    try {
      await check('P1 rutas, aviso y acceso rápido',async()=>{await go('/calendar');await page.getByRole('button',{name:'Añadir evento al calendario',exact:true}).click();assert.equal(await page.locator('#quick-event-title').evaluate(e=>e===document.activeElement),true);await go('/planner');});
      for(const [tab,title,submit,endpoint] of [['Tarea','Tarea de prueba','Añadir tarea','/tasks'],['Examen','Examen de prueba','Añadir examen','/grades'],['Fecha importante','Fecha de prueba','Guardar fecha','/important-dates']]) {
        await check('P3 alta y persistencia '+tab,async()=>{await go('/planner');const section=page.locator('section').filter({has:page.locator('#quick-event-title')});await section.getByRole('button',{name:tab,exact:true}).click();await page.locator('#quick-event-title').fill(title);await page.locator('#quick-event-date').fill(today);if(tab!=='Fecha importante')await page.locator('#quick-event-course').selectOption(course.id);await section.getByRole('button',{name:submit,exact:true}).click();await until(async()=>(await request(endpoint,token)).some(x=>x.title===title),'persist '+tab);await page.getByLabel('Cerrar aviso',{exact:true}).click();await page.reload();await page.getByRole('button',{name:'Día',exact:true}).click();await page.getByText(title,{exact:true}).first().waitFor();});
      }
      await check('P2 resumen y agenda seleccionada',async()=>{await go('/planner');await page.getByRole('button',{name:'Ver agenda',exact:true}).click();await page.getByRole('button',{name:'Día',exact:true}).waitFor();await page.getByText('Examen de prueba',{exact:true}).first().waitFor();});
      await check('P4 editar y mover tarea',async()=>{await go('/planner');await page.getByRole('button',{name:'Día',exact:true}).click();await page.getByRole('button',{name:'Editar Tarea de prueba',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Nombre de la tarea',{exact:true}).fill('Tarea editada');await dialog.getByLabel('Fecha de entrega',{exact:true}).fill(tomorrow);await dialog.getByRole('button',{name:'Guardar cambios',exact:true}).click();await until(async()=>(await request('/tasks',token)).some(x=>x.title==='Tarea editada'&&x.due_at.startsWith(tomorrow)),'edited task');await page.reload();assert.equal(await page.getByRole('button',{name:'Editar Tarea editada',exact:true}).count(),0);});
      await check('P5 crear horario local y recargar',async()=>{await go('/schedule');await page.locator('#planner-class-course').selectOption('');await page.locator('#planner-class-title').fill('Franja local de prueba');const form=page.locator('form').filter({has:page.locator('#planner-class-title')});await form.getByRole('button',{name:'Añadir Asignatura al Horario',exact:true}).click();await page.getByText('Franja local de prueba',{exact:true}).first().waitFor();await page.reload();await page.getByText('Franja local de prueba',{exact:true}).first().waitFor();});
      await check('P6-P8 periodo, mes, semana, día y Hoy',async()=>{await go('/planner');for(const view of ['Semana','Día','Mes']){await page.getByRole('button',{name:view,exact:true}).click();assert.equal(await page.getByRole('button',{name:view,exact:true}).getAttribute('aria-pressed'),'true');await page.getByLabel('Periodo siguiente',{exact:true}).click();await page.getByLabel('Periodo anterior',{exact:true}).click();await page.getByRole('button',{name:'Hoy',exact:true}).first().click();}await page.getByText('Fecha de prueba',{exact:true}).first().waitFor();});
      await check('P4 completar y borrar con confirmación',async()=>{for(const title of ['Completar prueba','Borrar prueba']){await request('/tasks',token,'POST',{title,due_at:new Date(today+'T23:59:00').toISOString(),estimated_minutes:30});}await go('/planner');await page.getByRole('button',{name:'Día',exact:true}).click();await page.getByRole('button',{name:'Completar Completar prueba',exact:true}).click();await until(async()=>(await request('/tasks',token)).some(x=>x.title==='Completar prueba'&&x.status==='completed'),'completion');await page.getByRole('button',{name:'Quitar Borrar prueba',exact:true}).click();await page.getByRole('button',{name:'Cancelar',exact:true}).click();assert.ok((await request('/tasks',token)).some(x=>x.title==='Borrar prueba'));await page.getByRole('button',{name:'Quitar Borrar prueba',exact:true}).click();await page.getByRole('button',{name:'Quitar',exact:true}).click();await until(async()=>!(await request('/tasks',token)).some(x=>x.title==='Borrar prueba'),'deletion');});
      await check('P5 editar, cancelar e importar horario',async()=>{await go('/schedule');await page.getByRole('button',{name:/Editar Franja local de prueba de/}).click();await page.locator('#planner-class-title').fill('Cambio cancelado');await page.getByRole('button',{name:'Cancelar',exact:true}).click();await page.getByText('Franja local de prueba',{exact:true}).first().waitFor();await page.getByRole('button',{name:/Editar Franja local de prueba de/}).click();await page.locator('#planner-class-title').fill('Franja editada');await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();await page.reload();await page.getByText('Franja editada',{exact:true}).first().waitFor();await page.locator('input[type=file]').setInputFiles({name:'horario.txt',mimeType:'text/plain',buffer:Buffer.from('lunes 10:00 - 11:00 Franja importada')});await page.getByRole('button',{name:'Importar',exact:true}).click();await page.getByRole('status').filter({hasText:'clases importadas'}).waitFor();assert.ok((await request('/timetable',token)).length>0);});
      await check('P6 celdas contiguas y P4 tarea en su fecha nueva',async()=>{await go('/planner');const cells=page.getByRole('button').filter({has:page.locator('span')});const label=tomorrowDate.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});const capital=label.charAt(0).toUpperCase()+label.slice(1);await page.getByRole('button',{name:new RegExp('^'+capital+':')}).click();await page.getByRole('button',{name:'Ver agenda',exact:true}).click();await page.getByRole('button',{name:'Editar Tarea editada',exact:true}).waitFor();});
      await check('Ausencia de errores de consola y render',async()=>assert.deepEqual(errors,[],'browser errors'));
    } finally {await context.close();}
  }
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(reports,null,2));
  console.log(JSON.stringify({passed:reports.filter(x=>x.status==='passed').length,pending:reports.filter(x=>x.status==='pending').length,output}));
  if(reports.some(x=>x.status==='pending'))process.exitCode=1;
}
main().catch(error => { console.error(error); for (const server of servers) console.error(server.log.replace(/([?&]token=)[^\s"'<>]+/g, '$1[REDACTED]')); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  for (const { child } of servers.reverse()) {
    if (child.exitCode !== null) continue;
    if (process.platform === 'win32') child.kill(); else { try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill(); } }
  }
});
