const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const source = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
const origins = ['https://academicautopilot.vercel.app', 'https://atlantium.vercel.app'];
const context = vm.createContext({ URL, Set, path, __dirname, APP_URL: origins[0], SMOKE: false, TRUSTED_ORIGINS: new Set(origins) });
vm.runInContext(source.slice(source.indexOf('function isAppUrl('), source.indexOf('function openExternal(')), context);
vm.runInContext(source.slice(source.indexOf('function attachLoadFailureHandlers('), source.indexOf('function createWindow(')), context);

function windowFixture() {
  const files = [], urls = [], webContents = new EventEmitter();
  const win = { webContents, isDestroyed: () => false, loadFile: async (...args) => files.push(args), loadURL: async url => urls.push(url) };
  context.attachLoadFailureHandlers(win);
  return { files, urls, webContents };
}
test('HTTP 404 o ERR_FAILED muestran offline una sola vez y permiten reintento manual', () => {
  for (const kind of ['http', 'network']) {
    const w = windowFixture();
    const fail = () => kind === 'http' ? w.webContents.emit('did-navigate', {}, origins[0], 404) : w.webContents.emit('did-fail-load', {}, -2, 'ERR_FAILED', origins[0], true);
    fail(); fail(); fail();
    assert.equal(w.files.length, 1);
    w.webContents.emit('did-start-navigation', {}, origins[0], false, true);
    fail();
    assert.equal(w.files.length, 2);
  }
});
test('si falla offline, el mensaje mínimo se intenta una sola vez, incluso si también falla', () => {
  const w = windowFixture();
  w.webContents.emit('did-fail-load', {}, -2, 'ERR_FAILED', origins[0], true);
  for (let i = 0; i < 5; i++) w.webContents.emit('did-fail-load', {}, -6, 'ERR_FILE_NOT_FOUND', 'file:///app/offline.html', true);
  assert.equal(w.files.length, 1);
  assert.equal(w.urls.length, 1);
  w.webContents.emit('did-fail-load', {}, -2, 'ERR_FAILED', w.urls[0], true);
  assert.equal(w.urls.length, 1);
});
test('aborto de navegación y fallos de subrecursos no activan offline', () => {
  const w = windowFixture();
  w.webContents.emit('did-fail-load', {}, -3, 'ERR_ABORTED', origins[0], true);
  w.webContents.emit('did-fail-load', {}, -2, 'ERR_FAILED', origins[0], false);
  assert.equal(w.files.length, 0);
});
test('will-navigate confía en ambos orígenes HTTPS y bloquea otros', () => {
  const start = source.indexOf('win.webContents.on("will-navigate"');
  const handler = source.slice(start, source.indexOf('win.webContents.setWindowOpenHandler', start));
  let navigate;
  const external = [];
  context.win = { webContents: { on: (_name, fn) => { navigate = fn; } } };
  context.openExternal = url => external.push(url);
  vm.runInContext(handler, context);
  for (const origin of origins) {
    let blocked = false;
    navigate({ preventDefault() { blocked = true; } }, origin + '/login');
    assert.equal(blocked, false);
    assert.equal(context.isAppOrigin(origin), true);
  }
  for (const url of ['https://evil.test/', 'https://atlantium.vercel.app.evil.test/', 'http://atlantium.vercel.app/']) {
    let blocked = false;
    navigate({ preventDefault() { blocked = true; } }, url);
    assert.equal(blocked, true);
  }
  assert.equal(external.length, 3);
});
