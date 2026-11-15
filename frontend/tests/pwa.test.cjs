const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const PUBLIC = path.join(__dirname, '../public');

test('el manifiesto conserva SVG y declara PNG reales de 192, 512 y maskable', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'manifest.webmanifest')));
  assert.ok(manifest.name && manifest.short_name);
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.prefer_related_applications, false);
  assert.ok(manifest.icons.some(icon => icon.type === 'image/svg+xml'));
  for (const [size, purpose] of [[192, 'any'], [512, 'any'], [512, 'maskable']]) {
    const icon = manifest.icons.find(icon => icon.sizes === `${size}x${size}` && icon.purpose === purpose);
    assert.ok(icon, `${size} ${purpose}`);
    assert.equal(icon.type, 'image/png');
    const png = fs.readFileSync(path.join(PUBLIC, icon.src));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
});

function workerHarness(sharedStores = new Map(), source = fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8')) {
  const listeners = {}, fetched = [];
  const state = { offline: false, body: 'current worker', skipped: 0, claimed: 0 };
  const key = value => new URL(typeof value === 'string' ? value : value.url, 'https://app.test').href;
  const fetch = async request => {
    fetched.push(key(request));
    if (state.offline) throw new Error('offline');
    return new Response(state.body);
  };
  const caches = {
    async open(name) {
      if (!sharedStores.has(name)) sharedStores.set(name, new Map());
      const store = sharedStores.get(name);
      return {
        async put(request, response) { store.set(key(request), response.clone()); },
        async match(request) { return store.get(key(request))?.clone(); },
        async add(request) { store.set(key(request), await fetch(request)); },
      };
    },
    async match(request) {
      for (const store of sharedStores.values()) if (store.has(key(request))) return store.get(key(request)).clone();
    },
    async keys() { return [...sharedStores.keys()]; },
    async delete(name) { return sharedStores.delete(name); },
  };
  const self = {
    location: { origin: 'https://app.test' },
    addEventListener(name, handler) { listeners[name] = handler; },
    async skipWaiting() { state.skipped++; },
    clients: { async claim() { state.claimed++; } },
  };
  vm.runInNewContext(source, { self, caches, fetch, URL, Set });
  return {
    state, stores: sharedStores, fetched, self,
    async dispatch(name, properties = {}) {
      let pending;
      listeners[name]({ ...properties, waitUntil(promise) { pending = promise; } });
      await pending;
    },
    async request(url, options = {}) {
      let response;
      listeners.fetch({ request: { url: new URL(url, self.location.origin).href, method: 'GET', mode: 'cors', headers: new Headers(), ...options }, respondWith(promise) { response = promise; } });
      return response;
    },
  };
}

test('el worker PDF se precachea, abre offline y se renueva al volver la red', async () => {
  const worker = workerHarness();
  await worker.dispatch('install');
  assert.ok(worker.fetched.includes('https://app.test/pdf.worker.min.mjs'));
  worker.state.offline = true;
  assert.equal(await (await worker.request('/pdf.worker.min.mjs')).text(), 'current worker');
  worker.state.offline = false;
  worker.state.body = 'updated PDF.js worker';
  assert.equal(await (await worker.request('/pdf.worker.min.mjs')).text(), worker.state.body);
  worker.state.offline = true;
  assert.equal(await (await worker.request('/pdf.worker.min.mjs')).text(), worker.state.body);
});

test('no intercepta API, escrituras de Office, WebSocket ni archivos privados', async () => {
  const worker = workerHarness();
  for (const [url, options] of [
    ['/api', {}], ['/api/v1/office/documents/1', {}], ['/api/v1/chat/messages', {}],
    ['/api/v1/office/documents/1', { method: 'PUT' }], ['/api/v1/files', { method: 'POST' }],
    ['wss://app.test/api/v1/ws', {}], ['https://other.test/private.pdf', {}],
    ['/documento-privado.pdf', {}], ['blob:https://app.test/private', {}],
  ]) assert.equal(await worker.request(url, options), undefined, url);
  assert.equal(worker.fetched.length, 0);
  assert.equal(worker.stores.size, 0);
});

test('un worker nuevo se activa y la navegación obtiene la página nueva de la red', async () => {
  const old = workerHarness();
  old.state.body = 'old page';
  await old.dispatch('install');
  await old.request('/', { mode: 'navigate' });
  const source = fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8').replace('2026-11-16-1', 'test-next-deploy');
  const next = workerHarness(old.stores, source);
  next.state.body = 'new page';
  await next.dispatch('install');
  await next.dispatch('activate');
  await next.dispatch('message', { data: { type: 'SKIP_WAITING' } });
  assert.equal(next.state.skipped, 2);
  assert.equal(next.state.claimed, 1);
  assert.ok([...next.stores.keys()].every(name => name.endsWith('test-next-deploy')));
  assert.equal(await (await next.request('/', { mode: 'navigate' })).text(), 'new page');
});
