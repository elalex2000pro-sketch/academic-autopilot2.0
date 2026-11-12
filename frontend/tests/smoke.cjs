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
    const apiServer = start(python, ['-m', 'uvicorn', 'chat_test_server:app', '--app-dir', 'tests', '--host', '0.0.0.0', '--port', new URL(API).port], path.join(ROOT, 'backend'), { AUTOPILOT_TEST_DIR: path.join(output, 'database') });
    await until(async () => { if (apiServer.child.exitCode !== null) throw new Error(apiServer.log); try { return (await fetch(API + '/health')).ok; } catch { return false; } }, 'API startup');
    const mode = process.env.SMOKE_WEB_MODE || 'dev';
    assert.ok(['start', 'dev'].includes(mode));
    start(process.execPath, [require.resolve('next/dist/bin/next'), mode, '-p', new URL(WEB).port], FRONTEND, { NEXT_PUBLIC_API_URL: API, NEXT_TELEMETRY_DISABLED: '1' });
    await until(async () => { try { return (await fetch(WEB + '/login')).ok; } catch { return false; } }, 'web startup', 180000);
  }
  assert.equal((await (await fetch(API + '/health')).json()).environment, 'isolated-chat-test', 'Never run against production');
  const { access_token: token } = await request('/auth/register', null, 'POST', { email: `smoke-${Date.now()}@example.com`, password: 'SmokeRouteTest123', full_name: 'Usuario de humo' });
  const user = await request('/auth/me', token);
  const group = await request('/classes', token, 'POST', { name: 'Clase de humo' });
  const office = await request('/office/documents', token, 'POST', { title: 'Documento de humo', content: '<h1>Documento de humo</h1><p>Contenido persistente.</p>' });
  await request('/notebooks', token, 'POST', { title: 'Cuaderno de humo' });
  const channel = process.env.SMOKE_BROWSER_CHANNEL || 'chrome';
  browser = await chromium.launch({ headless: true, ...(channel === 'chromium' ? {} : { channel }) });
  const reports = [];
  for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
    await context.addInitScript(({ token, user }) => { localStorage.setItem('autopilot_token', token); localStorage.setItem('autopilot_user', JSON.stringify(user)); localStorage.setItem('hasCompletedOnboarding_v1', 'true'); }, { token, user });
    const page = await context.newPage(); const errors = []; let current = 'startup';
    page.on('console', message => { if (message.type() === 'error') errors.push(`${current}: console ${message.text()}`); });
    page.on('pageerror', error => errors.push(`${current}: ${error.message}`));
    async function visit(route, expected = route) {
      current = route; const before = errors.length;
      const response = await page.goto(WEB + route, { waitUntil: 'domcontentloaded', timeout: 90000 });
      assert.ok(response && response.ok(), `${route}: HTTP ${response?.status()}`);
      await page.waitForURL(url => url.pathname + url.search === expected, { timeout: 30000 });
      await page.waitForFunction(() => {
        const main = document.querySelector('.pdf-reader') || document.querySelector('main');
        if (!main) return false; const text = main.textContent.trim(); const box = main.getBoundingClientRect();
        return box.width > 100 && box.height > 50 && text.length > 35 && main.querySelector('button,input,a,[contenteditable="true"]') && !/^Cargando[^.]*[.¡…]*$/.test(text);
      }, undefined, { timeout: 60000 });
      if (route.startsWith('/office/')) await page.locator('.ck-editor__editable_root').waitFor({ timeout: 60000 });
      await page.waitForTimeout(800);
      const content = await page.locator('.pdf-reader, main').first().innerText();
      assert.ok(!/Algo ha fallado|Algo salió mal|Application error|No se pudo mostrar|Este PDF no está guardado/.test(content), route + ': error fallback');
      assert.deepEqual(errors.slice(before), [], route + ': browser errors');
      reports.push({ viewport: viewport.width, route, ok: true }); console.log(`PASS ${viewport.width} ${route}`);
    }
    try {
      for (const route of ['/', '/planner', '/calendar', '/schedule', '/academics', '/classes', `/classes/${group.id}`, '/chat', '/review', '/notebooks', '/documents', '/office', `/office/${office.id}`, '/focus', '/settings', '/files', '/studio', '/studio?mode=audio', '/studio?mode=document', '/library']) await visit(route);
      // The reader is local IndexedDB, not /books. Import an actual PDF through its UI.
      await page.locator('input[type=file]').setInputFiles({ name: 'smoke-reader.pdf', mimeType: 'application/pdf', buffer: pdfFixture() });
      const link = page.locator('a[href^="/library/"]:visible').first(); await link.waitFor({ timeout: 30000 });
      const reader = await link.getAttribute('href'); await visit(reader);
      await page.locator('.pdf-reader canvas').first().waitFor({ timeout: 30000 });
      for (const [route, target] of [['/assistant', '/studio?mode=chat'], ['/transcribe', '/studio?mode=audio'], ['/subjects', '/academics'], ['/exams', '/academics']]) await visit(route, target);
      assert.deepEqual(errors, [], 'Late errors must also fail');
    } catch (error) {
      await page.screenshot({ path: path.join(output, `failure-${viewport.width}.png`), fullPage: true }).catch(() => {});
      await fs.writeFile(path.join(output, `failure-${viewport.width}.txt`), `${error.stack}\n${errors.join('\n')}\n${await page.locator('body').innerText()}`);
      throw error;
    } finally { await context.close(); }
  }
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(reports, null, 2));
  console.log(`Smoke passed: ${reports.length} route/viewport checks. Artifacts: ${output}`);
}
main().catch(error => { console.error(error); for (const server of servers) console.error(server.log.replace(/([?&]token=)[^\s"'<>]+/g, '$1[REDACTED]')); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  for (const { child } of servers.reverse()) {
    if (child.exitCode !== null) continue;
    if (process.platform === 'win32') child.kill(); else { try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill(); } }
  }
});
