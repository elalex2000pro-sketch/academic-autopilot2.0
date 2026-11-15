// Exercise the real API client without changing ChatView or starting timers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function client(fetch, token = 'test-token') {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/api.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, fetch, Headers, FormData, AbortSignal, URLSearchParams,
    window: {
      location: { protocol: 'http:', hostname: '127.0.0.1', port: '3000' },
      localStorage: { getItem: () => token },
    },
    require(name) {
      assert.ok(['@/lib/class-cache', '@/lib/filename', '@/lib/local-cache'].includes(name));
      return new Proxy({}, { get: (_, key) => () => {
        throw new Error('Unexpected dependency call: ' + name + '.' + String(key));
      } });
    },
  });
  return exports.chatApi;
}

async function main() {
  const calls = [];
  const pending = Array.from({ length: 451 }, (_, i) => ({ id: 'message-' + (i + 1) }));
  const api = client(async (url, options) => {
    const u = new URL(url);
    calls.push(u);
    assert.equal(options.headers.get('Authorization'), 'Bearer test-token');
    assert.equal(u.searchParams.get('limit'), '200');
    assert.equal(u.searchParams.has('before'), false);
    const cursor = u.searchParams.get('after');
    const offset = cursor === 'known' ? 0 : pending.findIndex(m => m.id === cursor) + 1;
    assert.ok(offset >= 0);
    return Response.json(pending.slice(offset, offset + 200));
  });
  const recovered = await api.messagesSince('conversation', 'known');
  assert.deepEqual(Array.from(recovered, m => m.id), pending.map(m => m.id));
  assert.equal(new Set(recovered.map(m => m.id)).size, 451);
  assert.equal(calls.length, 3);
  assert.equal(calls[1].searchParams.get('after'), 'message-200');
  assert.equal(calls[2].searchParams.get('after'), 'message-400');

  let emptyCalls = 0;
  assert.equal((await client(async () => { emptyCalls++; return Response.json([]); }).messagesSince('c', 'known')).length, 0);
  assert.equal(emptyCalls, 1);

  let exactCalls = 0;
  assert.equal((await client(async () => {
    exactCalls++;
    return Response.json(exactCalls === 1 ? pending.slice(0, 200) : []);
  }).messagesSince('c', 'known')).length, 200);
  assert.equal(exactCalls, 2);
  await assert.rejects(client(async () => Response.json([{ id: 'known' }])).messagesSince('c', 'known'),
    error => error.status === 502);

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(client(async () => { throw new Error('Must not fetch after cancellation'); }).messagesSince('c', 'known', controller.signal));
  const during = new AbortController();
  let duringCalls = 0;
  await assert.rejects(client(async (_, options) => {
    duringCalls++;
    assert.equal(options.signal, during.signal);
    during.abort();
    return Response.json(pending.slice(0, 200));
  }).messagesSince('c', 'known', during.signal));
  assert.equal(duringCalls, 1);

  let failedCalls = 0;
  await assert.rejects(client(async () => {
    failedCalls++;
    if (failedCalls === 1) return Response.json(pending.slice(0, 200));
    return Response.json({ detail: 'Sin permiso' }, { status: 403 });
  }).messagesSince('c', 'known'), error => error.status === 403);
  assert.equal(failedCalls, 2);

  // Historical reads keep their existing contract and URL.
  await client(async url => {
    const u = new URL(url);
    assert.equal(u.searchParams.get('before'), '2026-01-01T00:00:00Z');
    assert.equal(u.searchParams.has('after'), false);
    return Response.json([]);
  }).messages('c', '2026-01-01T00:00:00Z');
  console.log('PASS incremental Chat client: 451 messages, pagination, empty result, cancellation, permission error, legacy history');
  if (process.argv.includes('--live')) await live();
}

async function live() {
  const base = 'http://127.0.0.1:8000';
  assert.equal((await (await fetch(base + '/health')).json()).environment, 'isolated-chat-test');
  async function request(route, token, data) {
    const response = await fetch(base + '/api/v1' + route, {
      method: data ? 'POST' : 'GET',
      headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(data instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
      ...(data ? { body: data instanceof FormData ? data : JSON.stringify(data) } : {}),
    });
    assert.ok(response.ok, await response.clone().text());
    return response.json();
  }
  const suffix = Date.now();
  const alice = await request('/auth/register', null, { email: `incremental-a-${suffix}@example.com`, password: 'IncrementalTest123', full_name: 'Incremental A' });
  const bob = await request('/auth/register', null, { email: `incremental-b-${suffix}@example.com`, password: 'IncrementalTest123', full_name: 'Incremental B' });
  const profile = await request('/auth/me', bob.access_token);
  const conversation = await request('/chat/conversations', alice.access_token, { kind: 'direct', usernames: [profile.username] });
  const route = '/chat/conversations/' + conversation.id + '/messages';
  const ids = [];
  for (let i = 0; i < 206; i++) {
    const form = new FormData();
    form.set('content', 'Incremental ' + i);
    ids.push((await request(route, alice.access_token, form)).id);
  }
  const calls = [];
  const api = client(async (url, options) => { calls.push(new URL(url)); return fetch(url, options); }, bob.access_token);
  const recovered = await api.messagesSince(conversation.id, ids[0]);
  assert.deepEqual(Array.from(recovered, item => item.id), ids.slice(1));
  assert.equal(calls.length, 2);
  assert.equal((await api.messagesSince(conversation.id, ids.at(-1))).length, 0);
  assert.equal((await api.messages(conversation.id)).length, 50);
  console.log('PASS real isolated API + client: 205 pending messages in 2 pages, no duplicates, empty catch-up, legacy last 50');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
