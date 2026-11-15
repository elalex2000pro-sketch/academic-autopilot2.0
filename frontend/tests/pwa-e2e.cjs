// Runs only against the production build and the isolated smoke API.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');

async function verifyPwa(browser, { WEB, API, token, user, office, output, pdfFixture }) {
  const reports = [];
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const channel = process.env.SMOKE_BROWSER_CHANNEL || 'chrome';
    const profile = await fs.mkdtemp(path.join(output, `pwa-profile-${viewport.width}-`));
    const context = await browser.browserType().launchPersistentContext(profile, {
      headless: true, viewport, serviceWorkers: 'allow', permissions: ['notifications'],
      ...(channel === 'chromium' ? {} : { channel }),
    });
    await context.addInitScript(({ token, user }) => {
      localStorage.setItem('autopilot_token', token);
      localStorage.setItem('autopilot_user', JSON.stringify(user));
      localStorage.setItem('hasCompletedOnboarding_v1', 'true');
    }, { token, user });
    const page = await context.newPage();
    try {
      await page.goto(WEB + '/library');
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
      const cdp = await context.newCDPSession(page);
      const manifest = await cdp.send('Page.getAppManifest');
      assert.deepEqual(manifest.errors, []);
      assert.equal(JSON.parse(manifest.data).display, 'standalone');
      const installability = await cdp.send('Page.getInstallabilityErrors');
      assert.deepEqual(installability.installabilityErrors, [], 'Chrome installability');
      const workerCached = await page.evaluate(async () => Boolean(await caches.match('/pdf.worker.min.mjs')));
      assert.equal(workerCached, true);

      const transport = await page.evaluate(async ({ API, token, id }) => {
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
        const endpoint = `/api/v1/office/documents/${id}`;
        const before = await (await fetch(endpoint, { headers })).json();
        const payload = Object.fromEntries(['title', 'kind', 'content', 'schema_version', 'settings', 'folder', 'revision'].map(key => [key, before[key]]));
        const saved = await fetch(endpoint, { method: 'PUT', headers, body: JSON.stringify(payload) });
        const after = await saved.json();
        const socket = await new Promise((resolve, reject) => {
          const ws = new WebSocket(`${API.replace(/^http/, 'ws')}/api/v1/ws?token=${encodeURIComponent(token)}`);
          const timer = setTimeout(() => { ws.close(); reject(new Error('WebSocket timeout')); }, 10000);
          ws.onopen = () => { clearTimeout(timer); ws.close(); resolve(true); };
          ws.onerror = () => { clearTimeout(timer); reject(new Error('WebSocket failed')); };
        });
        return { status: saved.status, revisionAdvanced: after.revision === before.revision + 1, contentPreserved: after.content === before.content, socket };
      }, { API, token, id: office.id });
      assert.deepEqual(transport, { status: 200, revisionAdvanced: true, contentPreserved: true, socket: true });

      // Execute the real notification module, not a second implementation.
      const ts = require('typescript');
      const notificationSource = await fs.readFile(path.join(__dirname, '../src/lib/system-notifications.ts'), 'utf8');
      const code = ts.transpileModule(notificationSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
      const notified = await page.evaluate(async code => {
        const exports = {};
        new Function('exports', code)(exports);
        const shown = await exports.showSystemNotification({ title: 'Prueba PWA', body: 'Aviso local', tag: 'pwa-test', url: '/library' });
        const registration = await navigator.serviceWorker.getRegistration();
        const notifications = await registration.getNotifications({ tag: 'pwa-test' });
        const result = { shown, count: notifications.length, url: notifications[0]?.data.url };
        notifications.forEach(notification => notification.close());
        return result;
      }, code);
      assert.deepEqual(notified, { shown: true, count: 1, url: '/library' });

      await page.locator('input[type=file]').setInputFiles({ name: 'pwa-local.pdf', mimeType: 'application/pdf', buffer: pdfFixture() });
      const link = page.locator('a[href^="/library/"]:visible').first();
      await link.waitFor();
      const reader = await link.getAttribute('href');
      await Promise.all([page.waitForURL(url => url.pathname === reader), link.click()]);
      await page.locator('.pdf-reader canvas').first().waitFor();
      // Warm the direct navigation too; then remove HTTP cache from the equation.
      await page.goto(WEB + reader);
      await page.waitForFunction(() => [...document.querySelectorAll('.pdf-reader canvas')].some(canvas => canvas.width > 10 && canvas.height > 10));
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await context.setOffline(true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => [...document.querySelectorAll('.pdf-reader canvas')].some(canvas => canvas.width > 10 && canvas.height > 10), undefined, { timeout: 45000 });
      assert.equal(await page.locator('.pdf-reader').count(), 1);
      await page.screenshot({ path: path.join(output, `pwa-offline-${viewport.width}.png`) });
      await context.setOffline(false);
      const cachedUrls = await page.evaluate(async () => {
        const urls = [];
        for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
        return urls;
      });
      assert.ok(cachedUrls.every(url => !new URL(url).pathname.startsWith('/api/') && !url.includes('pwa-local.pdf')));
      reports.push({ viewport: viewport.width, chromeInstallabilityErrors: [], transport, notification: notified, offlinePdf: true, noApiOrPdfContentInCache: true });
      console.log(`PASS PWA ${viewport.width}: Chrome installability, notification, offline IndexedDB PDF`);
    } catch (error) {
      await page.screenshot({ path: path.join(output, `pwa-failure-${viewport.width}.png`) }).catch(() => {});
      await fs.writeFile(path.join(output, `pwa-failure-${viewport.width}.txt`), `${error.stack}\n${await page.locator('body').innerText()}`);
      throw error;
    } finally { await context.close(); }
  }
  // Two worker revisions from an owned ephemeral origin; production files are never changed.
  const original = await fs.readFile(path.join(__dirname, '../public/sw.js'), 'utf8');
  let source = original;
  const server = http.createServer(async (request, response) => {
    try {
      if (request.url === '/sw.js') {
        response.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' });
        response.end(source);
      } else if (request.url === '/probe') {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end('<!doctype html><title>PWA update probe</title><p>Isolated update test</p>');
      } else {
        const upstream = await fetch(WEB + request.url);
        response.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream' });
        response.end(Buffer.from(await upstream.arrayBuffer()));
      }
    } catch { response.writeHead(502); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const page = await context.newPage();
    await page.goto(origin + '/probe');
    await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }); await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.waitForFunction(() => navigator.serviceWorker.controller.state === 'activated');
    await page.evaluate(() => {
      window.previousController = navigator.serviceWorker.controller;
      window.unsavedDraft = 'keep this text';
      localStorage.setItem('draft', 'keep this text');
    });
    source = original.replace('2026-11-16-1', 'pwa-next-deploy');
    await page.evaluate(async () => {
      navigator.serviceWorker.addEventListener('controllerchange', () => { window.workerChanged = true; }, { once: true });
      await (await navigator.serviceWorker.getRegistration()).update();
    });
    await page.waitForFunction(() => window.workerChanged === true);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== window.previousController && navigator.serviceWorker.controller.state === 'activated');
    assert.equal(await page.evaluate(() => window.unsavedDraft), 'keep this text', 'no forced reload');
    assert.equal(await page.evaluate(() => localStorage.getItem('draft')), 'keep this text');
    const names = await page.evaluate(() => caches.keys());
    assert.ok(names.some(name => name.endsWith('pwa-next-deploy')));
    assert.ok(names.every(name => !name.endsWith('2026-11-16-1')));
    reports.push({ realServiceWorkerUpdate: true, draftsPreserved: true, oldCachesRemoved: true });
    console.log('PASS PWA: real worker update, old caches removed, no reload or lost draft');
  } finally {
    await context.close();
    await new Promise(resolve => server.close(resolve));
  }
  await fs.writeFile(path.join(output, 'pwa-report.json'), JSON.stringify(reports, null, 2));
}
module.exports = { verifyPwa };
