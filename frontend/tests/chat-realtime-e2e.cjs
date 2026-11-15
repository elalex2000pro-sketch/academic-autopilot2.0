/* Real browser + isolated API. Run with the same servers as chat-e2e.cjs.
 * Browser clocks and WebSocket/network controls simulate outages and returning
 * from a hidden mobile page; they do not claim an OS-level phone suspend test.
 */
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const API = process.env.CHAT_TEST_API || 'http://127.0.0.1:8000';
const WEB = process.env.CHAT_TEST_WEB || 'http://localhost:3000';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await check()) return; await wait(100); }
  throw new Error('Timeout: ' + label);
}
async function main() {
  assert.equal((await (await fetch(API + '/health')).json()).environment, 'isolated-chat-test');
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-realtime-'));
  const results = [];
  const pass = name => { results.push(name); console.log('PASS ' + name); };
  async function req(route, token, body) {
    const r = await fetch(API + '/api/v1' + route, {
      method: body ? 'POST' : 'GET',
      headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
      ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    });
    assert.ok(r.ok, route + ': ' + r.status + ' ' + await r.clone().text());
    return r.json();
  }
  const stamp = Date.now();
  async function account(name) {
    const { access_token: token } = await req('/auth/register', null,
      { email: `${name}-${stamp}@example.com`, password: 'RealtimeTest123', full_name: name });
    return { token, user: await req('/auth/me', token) };
  }
  const alice = await account('Receptor');
  const bob = await account('Emisor');
  const outsider = await account('Ajeno');
  async function group(title) {
    return req('/chat/conversations', alice.token, { kind: 'group', title, member_ids: [bob.user.id] });
  }
  const a = await group('Prueba A'), b = await group('Prueba B'), empty = await group('Prueba vacía');
  async function send(id, content) {
    const form = new FormData(); form.set('content', content);
    return req('/chat/conversations/' + id + '/messages', bob.token, form);
  }
  await send(a.id, 'Inicio A'); await send(b.id, 'Inicio B');
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  const errors = [];
  let releaseHeld = () => {};
  async function session(account, controlled = false) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: 'block' });
    await context.addInitScript(({ token, user }) => {
      localStorage.setItem('autopilot_token', token);
      localStorage.setItem('autopilot_user', JSON.stringify(user));
      localStorage.setItem('hasCompletedOnboarding_v1', 'true');
      window.testHidden = false;
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.testHidden ? 'hidden' : 'visible' });
    }, account);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    if (controlled) await page.clock.install();
    return { context, page };
  }
  const receiver = await session(alice, true), sender = await session(bob);
  const page = receiver.page;
  let blocked = false, silence = false;
  const sockets = [];
  await page.routeWebSocket('**/api/v1/ws*', socket => {
    if (blocked) { socket.close({ code: 1008, reason: 'test blocked' }); return; }
    const server = socket.connectToServer();
    sockets.push({ socket, server });
    server.onMessage(message => { if (!silence) socket.send(message); });
  });
  const reads = [];
  page.on('request', r => { if (r.url().includes('/messages?after=')) reads.push(r.url()); });
  async function open(view, title) {
    await view.locator('.chat-conversation').filter({ hasText: title }).click();
    await view.locator('.chat-messages[aria-busy="false"]').waitFor();
    await wait(200);
  }
  async function hidden(value) {
    await page.evaluate(value => { window.testHidden = value; document.dispatchEvent(new Event('visibilitychange')); }, value);
    await wait(200);
  }
  async function advance(ms) { await page.clock.runFor(ms); await wait(350); }
  async function visible(text) { await page.locator('.chat-messages').getByText(text, { exact: true }).waitFor(); }
  function count(text) { return page.locator('.chat-bubble').filter({ hasText: text }).count(); }
  function disconnect() {
    for (const { socket, server } of sockets.splice(0)) { socket.close({ code: 1001 }); server.close({ code: 1001 }); }
  }
  try {
    await page.goto(WEB + '/chat'); await sender.page.goto(WEB + '/chat');
    await open(page, 'Prueba A'); await open(sender.page, 'Prueba A');
    await until(() => reads.length > 0, 'initial incremental read');
    await wait(300);
    let before = reads.length;
    await advance(5100);
    assert.equal(reads.length, before, 'healthy WS uses spaced polling');
    await advance(26000);
    await until(() => reads.length > before, '30-second healthy backup');
    pass('respaldo espaciado con WebSocket sano');
    let navigations = 0;
    page.on('framenavigated', f => { if (f === page.mainFrame()) navigations++; });
    await sender.page.getByRole('textbox', { name: 'Mensaje', exact: true }).fill('Mensaje por WebSocket');
    await sender.page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
    await visible('Mensaje por WebSocket'); assert.equal(await count('Mensaje por WebSocket'), 1);
    assert.equal(navigations, 0);
    pass('dos alumnos reciben sin recargar y sin duplicados');

    blocked = true; disconnect(); await wait(400);
    await send(a.id, 'Mensaje de respaldo'); await advance(5200);
    await visible('Mensaje de respaldo'); assert.equal(await count('Mensaje de respaldo'), 1);
    pass('WebSocket bloqueado: recepción por respaldo de 5 segundos');

    let sentHeld = false, sendCompleted = false, sendError;
    const sentGate = new Promise(resolve => { releaseHeld = resolve; });
    const sendPattern = '**/api/v1/chat/conversations/' + a.id + '/messages';
    await page.route(sendPattern, async route => {
      if (route.request().method() !== 'POST') return route.continue();
      const response = await route.fetch(); sentHeld = true;
      await sentGate;
      await route.fulfill({ response }).catch(error => { sendError = error; });
      sendCompleted = true;
    });
    await page.getByRole('textbox', { name: 'Mensaje', exact: true }).fill('Optimista con respaldo');
    await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
    await until(() => sentHeld, 'held send response'); await advance(5200);
    assert.equal(await count('Optimista con respaldo'), 1);
    releaseHeld(); await until(() => sendCompleted, 'released send response');
    assert.equal(sendError, undefined);
    await page.unroute(sendPattern); await wait(200);
    await page.getByRole('textbox', { name: 'Mensaje', exact: true }).fill('Borrador siguiente');
    assert.equal(await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).isEnabled(), true);
    assert.equal(await count('Optimista con respaldo'), 1);
    pass('envío optimista reconciliado una sola vez aunque REST reciba antes que el POST');

    let failures = 0;
    const pattern = '**/api/v1/chat/conversations/*/messages?after=*';
    await page.route(pattern, route => { failures++; return route.fulfill({ status: 503, json: { detail: 'Fallo temporal de prueba' } }); });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await until(() => failures === 1, 'first error'); await wait(250);
    await advance(5100); assert.equal(failures, 1);
    await advance(5100); await until(() => failures === 2, '10-second error retry');
    await advance(10500); assert.equal(failures, 2);
    await advance(10000); await until(() => failures === 3, '20-second error retry');
    await page.unroute(pattern);
    await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await wait(400);
    pass('errores reducen la frecuencia y la recuperación la restaura');

    await hidden(true); before = reads.length;
    for (let i = 0; i < 61; i++) await send(a.id, 'Pendiente A ' + i);
    await advance(60000); assert.equal(reads.length, before);
    await page.setViewportSize({ width: 390, height: 844 });
    await hidden(false); await visible('Pendiente A 60');
    assert.equal(await count('Pendiente A '), 61);
    pass('vuelta móvil simulada: pausa oculta y recuperación inmediata de 61 pendientes');

    await receiver.context.setOffline(true); await wait(200);
    assert.equal(await page.evaluate(() => navigator.onLine), false);
    before = reads.length; await send(a.id, 'Durante modo sin conexión');
    await advance(60000); assert.equal(reads.length, before);
    await receiver.context.setOffline(false); await visible('Durante modo sin conexión');
    pass('sin internet se pausa; al recuperar red se consulta inmediatamente');

    await page.setViewportSize({ width: 1440, height: 960 });
    await open(page, 'Prueba vacía'); await hidden(true);
    for (let i = 0; i < 205; i++) await send(empty.id, 'Vacío pendiente ' + i);
    await hidden(false); await visible('Vacío pendiente 204');
    assert.equal(await count('Vacío pendiente '), 205);
    pass('hilo inicialmente vacío: 205 pendientes paginados y sin duplicados');

    // Hold an old response while changing threads. Abort and generation guards
    // must prevent it from overwriting the current thread.
    let held = false;
    const gate = new Promise(resolve => { releaseHeld = resolve; });
    await page.route(pattern, async route => {
      const response = await route.fetch(); held = true;
      await gate;
      await route.fulfill({ response }).catch(() => {}); // browser may have aborted
    });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await until(() => held, 'held incremental response');
    await open(page, 'Prueba B'); await open(page, 'Prueba A');
    releaseHeld(); await page.unroute(pattern); await wait(350);
    await visible('Durante modo sin conexión'); assert.equal(await count('Vacío pendiente '), 0);
    pass('cambio rápido de conversación cancela e ignora respuestas tardías');

    // Reconnect first, then receive a fresh WS event before the REST catch-up:
    // the independent cursor must still recover all older missed messages.
    await hidden(true);
    for (let i = 0; i < 61; i++) await send(a.id, 'Reconexión ' + i);
    blocked = false; await advance(6500);
    await until(async () => (await req('/chat/conversations/' + a.id + '/presence', bob.token)).some(u => u.id === alice.user.id && u.online), 'WS reconnect');
    await send(a.id, 'Evento nuevo tras reconectar');
    await visible('Evento nuevo tras reconectar');
    await hidden(false); await visible('Reconexión 60');
    assert.equal(await count('Reconexión '), 61);
    assert.equal(await count('Evento nuevo tras reconectar'), 1);
    pass('reconexión reconcilia más de 50 pendientes aunque llegue antes un evento nuevo');

    silence = true;
    const connections = sockets.length;
    await advance(61000);
    await until(() => sockets.length > connections, 'watchdog reconnects a silent socket');
    await send(a.id, 'Conexión muda'); await advance(31000); await visible('Conexión muda');
    silence = false;
    pass('conexión muda detectada por falta de ping y recuperada');

    await page.locator('a[href="/settings"]:visible').first().click();
    await page.waitForURL('**/settings'); await wait(250); before = reads.length;
    await advance(60000); assert.equal(reads.length, before);
    pass('salir de Chat limpia consultas y temporizadores de mensajes');
    const forbidden = await fetch(API + '/api/v1/chat/conversations/' + a.id + '/messages?after=start',
      { headers: { Authorization: 'Bearer ' + outsider.token } });
    assert.equal(forbidden.status, 403);
    assert.equal(errors.length, 0, errors.join('\n'));
    pass('permisos: alumno ajeno recibe 403; cero errores de ejecución');
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ results, errors }, null, 2));
    console.log(JSON.stringify({ result: 'passed', results, output }, null, 2));
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ message: error.message, results, errors, reads }, null, 2));
    console.error('Artifacts: ' + output); throw error;
  } finally { releaseHeld(); await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
