const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function loadTs(relative, requireModule) {
  const file = path.join(__dirname, '..', relative);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: requireModule, process: { env: {} } }, { filename: file });
  return exports;
}

const versions = loadTs('src/lib/app-update.ts', id => {
  assert.equal(id, '../../package.json');
  return require('../package.json');
});
const { getDesktopUpdateStatus } = loadTs('src/lib/desktop-updater.ts', id => {
  assert.equal(id, '@/lib/app-update');
  return versions;
});

function snapshot(status, version) {
  return Object.freeze({ status, version, progress: 100, transferred: 1024, total: 1024,
    bytesPerSecond: 0, releaseNotes: 'Novedades', releaseDate: null, error: null });
}

test('una 1.3.46 ya instalada no anuncia descarga, progreso ni reinicio pendientes', () => {
  for (const status of ['available', 'downloading', 'ready']) {
    assert.equal(getDesktopUpdateStatus(snapshot(status, '1.3.46'), '1.3.46'), 'current');
    assert.equal(getDesktopUpdateStatus(snapshot(status, 'v1.3.46'), '1.3.46'), 'current');
  }
});

test('una versión anterior tampoco se ofrece como actualización', () => {
  for (const status of ['available', 'downloading', 'ready']) {
    assert.equal(getDesktopUpdateStatus(snapshot(status, '1.3.45'), '1.3.46'), 'current');
    assert.equal(getDesktopUpdateStatus(snapshot(status, '1.3.9'), '1.3.10'), 'current');
  }
});

test('una versión superior conserva los tres estados y sigue disponible', () => {
  for (const status of ['available', 'downloading', 'ready']) {
    assert.equal(getDesktopUpdateStatus(snapshot(status, '1.3.47'), '1.3.46'), status);
    assert.equal(getDesktopUpdateStatus(snapshot(status, '1.3.100'), '1.3.99'), status);
  }
});

test('no oculta errores, comprobaciones ni estados deshabilitados', () => {
  for (const status of ['idle', 'checking', 'current', 'error', 'disabled']) {
    assert.equal(getDesktopUpdateStatus(snapshot(status, '1.3.46'), '1.3.46'), status);
  }
});

test('no inventa una comparación si el puente no proporciona versión', () => {
  assert.equal(getDesktopUpdateStatus(snapshot('ready', null), '1.3.46'), 'ready');
});

test('la validación no modifica ni persiste el estado recibido de Electron', () => {
  const state = snapshot('ready', '1.3.46');
  assert.equal(getDesktopUpdateStatus(state, '1.3.46'), 'current');
  assert.equal(state.status, 'ready');
  assert.equal(state.progress, 100);
  assert.equal(state.version, '1.3.46');
});
