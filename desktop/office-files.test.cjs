const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'office-ipc-'));
  const handlers = {};
  const source = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  const section = source.slice(source.indexOf('const MAX_FILE_PAYLOAD_BYTES'), source.indexOf('function registerSpotifyAuth'));
  let selected = path.join(directory, 'entrada.html');
  fs.writeFileSync(selected, '<h1>Álgebra</h1>');
  const output = path.join(directory, 'salida.html');
  const context = vm.createContext({ Buffer, ArrayBuffer, Date, Math, console, path, fs,
    isTrustedRenderer: event => event.trusted,
    safeFilename: name => path.basename(name),
    BrowserWindow: { fromWebContents: () => null },
    app: { getPath: () => directory },
    ipcMain: { handle: (name, fn) => { handlers[name] = fn; } },
    dialog: { showSaveDialog: async () => ({ filePath: output }), showOpenDialog: async () => ({ canceled: false, filePaths: [selected] }) },
    shell: { openPath: async () => '' },
  });
  vm.runInContext(section + '\nregisterFileControls();', context);
  const event = { trusted: true, sender: {} };
  const opened = await handlers['files:open'](event, { mode: 'pick-office' });
  assert.ok(opened.ok && opened.text.includes('Álgebra'));
  assert.ok((await handlers['files:save'](event, { name: 'salida.html', data: Buffer.from(opened.text) })).ok);
  assert.equal(fs.readFileSync(output, 'utf8'), opened.text);
  selected = path.join(directory, 'entrada.txt'); fs.writeFileSync(selected, 'Texto plano');
  assert.equal((await handlers['files:open'](event, { mode: 'pick-office' })).text, 'Texto plano');
  selected = path.join(directory, 'entrada.docx'); fs.writeFileSync(selected, Buffer.from('PK-test'));
  assert.equal(Buffer.from((await handlers['files:open'](event, { mode: 'pick-office' })).data).toString(), 'PK-test');
  assert.ok((await handlers['files:open'](event, { name: 'adjunto.pdf', data: Buffer.from('%PDF-test') })).ok);
  assert.equal((await handlers['files:open']({ trusted: false }, { mode: 'pick-office' })).ok, false);
  selected = path.join(directory, 'rechazado.exe'); fs.writeFileSync(selected, 'x');
  assert.equal((await handlers['files:open'](event, { mode: 'pick-office' })).ok, false);
  fs.rmSync(directory, { recursive: true, force: true });
  console.log('PASS Office IPC: real temporary files, simulated dialogs, existing chat flow');
})().catch(error => { console.error(error); process.exit(1); });
