// electron --user-data-dir=<empty temporary directory> desktop/robustness-e2e.cjs <directory>
const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = process.argv.at(-1);
assert.ok(path.isAbsolute(root) && root.includes('robustness-test-'));
app.setPath('userData', root);
app.setPath('sessionData', root);
app.on('before-quit', event => event.preventDefault()); // keep the harness alive between windows
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const source = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
const context = vm.createContext({ URL, Set, path, __dirname, SMOKE: false, APP_URL: 'https://academicautopilot.vercel.app', TRUSTED_ORIGINS: new Set(['https://academicautopilot.vercel.app', 'https://atlantium.vercel.app']) });
vm.runInContext(source.slice(source.indexOf('function isAppUrl('), source.indexOf('function openExternal(')), context);
vm.runInContext(source.slice(source.indexOf('function attachLoadFailureHandlers('), source.indexOf('function createWindow(')), context);
app.whenReady().then(async () => {
  const ses = session.fromPartition('persist:robustness-test');
  await ses.protocol.handle('https', () => new Response('Simulated HTTP 404', { status: 404 }));
  for (const kind of ['404', 'ERR_FAILED', 'offline-failure']) {
    const win = new BrowserWindow({ show: false, webPreferences: { partition: 'persist:robustness-test', sandbox: true } });
    let files = 0, minimal = 0;
    const loadFile = win.loadFile.bind(win), loadURL = win.loadURL.bind(win);
    win.loadFile = (...args) => { files++; return loadFile(...args); };
    win.loadURL = (...args) => { if (args[0].startsWith('data:')) minimal++; return loadURL(...args); };
    context.attachLoadFailureHandlers(win);
    if (kind === '404') await win.loadURL(context.APP_URL).catch(() => {});
    else win.webContents.emit('did-fail-load', {}, -2, 'ERR_FAILED', context.APP_URL, true);
    await pause(1500);
    assert.equal(files, 1);
    assert.ok(win.webContents.getURL().startsWith('file:'));
    if (kind === 'offline-failure') {
      for (let i = 0; i < 3; i++) win.webContents.emit('did-fail-load', {}, -6, 'ERR_FILE_NOT_FOUND', 'file:///missing/offline.html', true);
      await pause(1500);
      assert.equal(minimal, 1);
      assert.equal(files, 1);
    }
    console.log(`PASS real Electron ${kind}: offline=${files}, minimal=${minimal}, no retry loop`);
    win.destroy();
  }
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
