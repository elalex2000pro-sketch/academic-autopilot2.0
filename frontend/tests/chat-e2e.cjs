/* Real browser -> REST/WebSocket -> isolated database verification.
 * Start backend/tests/chat_test_server.py and the frontend before running.
 * Uses installed Chrome; creates only temporary test accounts and files.
 */
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const API = process.env.CHAT_TEST_API || 'http://127.0.0.1:8000';
const WEB = process.env.CHAT_TEST_WEB || 'http://localhost:3000';

async function request(route, token, method = 'GET', body) {
  const response = await fetch(API + '/api/v1' + route, { method,
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.ok(response.ok, route + ': ' + response.status + ' ' + (response.ok ? '' : await response.text()));
  return response.status === 204 ? null : response.json();
}
async function until(check, label) {
  const end = Date.now() + 15000;
  while (Date.now() < end) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 120)); }
  throw new Error('Timed out: ' + label);
}
async function main() {
  assert.equal((await (await fetch(API + '/health')).json()).environment, 'isolated-chat-test', 'Use only the isolated test API');
  const suffix = Date.now().toString(36);
  async function account(name, handle) {
    const { access_token: token } = await request('/auth/register', null, 'POST', {
      email: handle + suffix + '@example.com', password: 'ChatBrowserTest123', full_name: name,
    });
    const user = await request('/auth/username', token, 'PUT', { username: handle + suffix });
    return { token, user };
  }
  const alice = await account('Alejandro · Prueba', 'alejandro_');
  const bob = await account('Lucía · Prueba', 'lucia_');
  const output = process.env.CHAT_TEST_OUTPUT || await fs.mkdtemp(path.join(os.tmpdir(), 'autopilot-chat-browser-'));
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  const errors = [];
  async function session(account, route) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: 'block', acceptDownloads: true });
    await context.addInitScript(({ token, user }) => {
      localStorage.setItem('autopilot_token', token);
      localStorage.setItem('autopilot_user', JSON.stringify(user));
      localStorage.setItem('hasCompletedOnboarding_v1', 'true');
      localStorage.setItem('academic-autopilot-theme-v18', 'dark');
    }, account);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(WEB + route);
    return { context, page };
  }
  try {
    const a = await session(alice, '/chat');
    await a.page.getByRole('button', { name: 'Cambiar tu @usuario', exact: true }).click();
    const personalHandle = 'alex_' + suffix;
    await a.page.getByRole('textbox', { name: 'Tu nuevo @usuario', exact: true }).fill(personalHandle);
    await a.page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await until(async () => (await request('/auth/me', alice.token)).username === personalHandle, 'custom handle saved through UI');
    await a.page.getByRole('textbox', { name: 'Tu nuevo @usuario', exact: true }).waitFor({ state: 'hidden' });
    await a.page.getByRole('button', { name: 'Nuevo chat / Añadir contacto', exact: true }).click();
    await a.page.getByLabel('Añadir contacto por @usuario', { exact: true }).fill('@' + bob.user.username);
    await a.page.getByRole('dialog').getByRole('button').filter({ hasText: bob.user.full_name }).click();
    await a.page.getByRole('button', { name: 'Abrir chat', exact: true }).click();
    await a.page.getByRole('textbox', { name: 'Mensaje', exact: true }).waitFor();
    const conversations = await request('/chat/conversations', alice.token);
    assert.equal(conversations.length, 1);
    const id = conversations[0].id;
    const messages = () => request('/chat/conversations/' + id + '/messages', alice.token);
    await a.page.getByRole('textbox', { name: 'Mensaje', exact: true }).fill('Hola Lucía, ¿repasamos redes esta tarde?');
    await a.page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
    await until(async () => (await messages())[0]?.status === 'sent', 'single sent tick while recipient is offline');
    await a.page.getByLabel('Enviado', { exact: true }).last().waitFor();

    const b = await session(bob, '/settings');
    await until(async () => (await messages())[0]?.status === 'delivered', 'global delivery outside chat route');
    await a.page.getByLabel('Entregado', { exact: true }).last().waitFor();
    await b.page.goto(WEB + '/chat');
    await b.page.bringToFront();
    await b.page.locator('.chat-conversation').filter({ hasText: alice.user.full_name }).click();
    await until(async () => (await messages())[0]?.status === 'read', 'read receipt from focused recipient');
    await b.page.getByRole('textbox', { name: 'Mensaje', exact: true }).fill('¡Sí! Te envío los apuntes y una imagen.');
    await b.page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
    await until(async () => (await messages()).length === 2, 'reply persisted');
    await a.page.bringToFront();
    await until(async () => (await messages())[1]?.status === 'read', 'reply read receipt');
    assert.ok((await request('/chat/conversations/' + id + '/presence', alice.token))[0].online);

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=', 'base64');
    await a.page.locator('input[type=file]').setInputFiles({ name: 'esquema-redes.png', mimeType: 'image/png', buffer: png });
    await a.page.getByAltText('Vista previa de esquema-redes.png').waitFor();
    await a.page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
    await a.page.getByAltText('esquema-redes.png', { exact: true }).waitFor();
    assert.ok(await a.page.getByAltText('esquema-redes.png', { exact: true }).evaluate(image => image.complete && image.naturalWidth > 0));

    const pdf = Buffer.from('%PDF-1.4\nAcademic Autopilot attachment verification\n%%EOF');
    await a.page.locator('input[type=file]').setInputFiles({ name: 'Apuntes de redes.pdf', mimeType: 'application/pdf', buffer: pdf });
    await a.page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
    const card = a.page.locator('.chat-bubble').filter({ hasText: 'Apuntes de redes.pdf' });
    await card.getByRole('button', { name: 'Guardar', exact: true }).waitFor();
    const downloadEvent = a.page.waitForEvent('download');
    await card.getByRole('button', { name: 'Guardar', exact: true }).click();
    const download = await downloadEvent;
    assert.equal(download.suggestedFilename(), 'Apuntes de redes.pdf');
    assert.deepEqual(await fs.readFile(await download.path()), pdf);
    const stored = await messages();
    assert.equal(stored.at(-2).attachment.name, 'esquema-redes.png');
    assert.equal(stored.at(-1).attachment.size_bytes, pdf.length);
    await a.page.screenshot({ path: path.join(output, 'chat-desktop-dark.png'), fullPage: true });
    await a.page.evaluate(() => { document.documentElement.classList.remove('dark'); document.documentElement.dataset.theme = 'light'; });
    await a.page.screenshot({ path: path.join(output, 'chat-desktop-light.png'), fullPage: true });

    // A rejected upload and an offline send must retain the draft and never
    // produce a fake success from GET history cached under the same URL.
    await a.page.locator('input[type=file]').setInputFiles({ name: 'programa.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('test') });
    assert.ok(await a.page.getByRole('alert').count() > 0);
    await a.context.setOffline(true);
    await a.page.getByRole('textbox', { name: 'Mensaje', exact: true }).fill('Borrador sin conexión');
    await a.page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
    await until(async () => await a.page.getByRole('textbox', { name: 'Mensaje', exact: true }).inputValue() === 'Borrador sin conexión', 'failed send restores draft');
    assert.equal((await messages()).length, stored.length);
    await a.context.setOffline(false);

    await a.page.setViewportSize({ width: 390, height: 844 });
    await a.page.getByRole('button', { name: 'Volver a los chats', exact: true }).click();
    await a.page.locator('.chat-conversation').filter({ hasText: bob.user.full_name }).click();
    await a.page.locator('.chat-messages[aria-busy="false"]').waitFor();
    await until(async () => await a.page.locator('.chat-bubble').count() === stored.length, 'mobile history loaded');
    assert.ok(await a.page.getByRole('textbox', { name: 'Mensaje', exact: true }).isVisible());
    assert.ok(await a.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const composerBox = await a.page.locator('.chat-composer').boundingBox();
    const navBox = await a.page.locator('[data-mobile-nav]').boundingBox();
    assert.ok(composerBox.y + composerBox.height < navBox.y, 'Composer must stay above floating mobile navigation');
    await a.page.screenshot({ path: path.join(output, 'chat-mobile.png'), fullPage: true });
    await b.context.close();
    await until(async () => !(await request('/chat/conversations/' + id + '/presence', alice.token))[0].online, 'disconnect presence');
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(JSON.stringify({ result: 'passed', checks: ['custom handle saved in UI', 'handle search + direct creation', 'sent/delivered/read via real WS', 'delivery outside chat', 'presence/disconnect', 'image preview', 'PDF download bytes', 'upload validation', 'offline failure draft', 'desktop dark/light + mobile layout'], output }, null, 2));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
