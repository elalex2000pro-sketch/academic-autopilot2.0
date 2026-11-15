const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function loadTs(relative, requireModule, globals = {}) {
  const file = path.join(__dirname, '..', relative);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: requireModule, process: { env: {} }, ...globals }, { filename: file });
  return exports;
}

const versions = loadTs('src/lib/app-update.ts', id => {
  assert.equal(id, '../../package.json');
  return require('../package.json');
});

async function checkMetadata(payload,desktop=false) {
  const client=loadTs('src/lib/app-update.ts',()=>require('../package.json'),{
    Headers,AbortController,URL,setTimeout,clearTimeout,
    navigator:{userAgent:desktop?'AcademicAutopilotDesktop/1.3.46':''},
    fetch:async()=>({ok:true,json:async()=>payload}),
  });
  return (await client.checkForUpdates()).update;
}
const asset={name:'Academic-Autopilot-Setup.exe',size:12345,browser_download_url:'https://github.com/elalex2000pro-sketch/academic-autopilot2.0/releases/download/v1.4.0/Academic-Autopilot-Setup.exe'};
test('ignora borradores y preliminares incluso si falta su bandera',async()=>{
  for(const release of [{tag_name:'v1.4.0',draft:true},{tag_name:'v1.4.0',prerelease:true},{tag_name:'v1.4.0-beta.1'}])assert.equal(await checkMetadata([{...release,assets:[asset]}],true),null);
  assert.equal(await checkMetadata({version:'1.4.0-beta.1'}),null);
});
test('no inventa instaladores si faltan metadatos o la URL no es válida',async()=>{
  for(const assets of [undefined,null,[],[{name:asset.name}],[{...asset,browser_download_url:'http://github.com/file'}],[{...asset,name:'otro.exe'}]])assert.equal(await checkMetadata([{tag_name:'v1.4.0',assets}],true),null);
  for(const manifest of [null,{}, {version:42}])assert.equal(await checkMetadata(manifest),null);
});
test('el tamaño es real o desconocido, nunca simulado',async()=>{
  assert.equal((await checkMetadata([{tag_name:'v1.4.0',assets:[asset]}],true)).sizeBytes,12345);
  for(const size of [undefined,null,-1,0,Infinity,1.5]){
    assert.equal((await checkMetadata([{tag_name:'v1.4.0',assets:[{...asset,size}]}],true)).sizeBytes,null);
    assert.equal((await checkMetadata({version:'1.4.0',sizeBytes:size})).sizeBytes,null);
  }
});
test('notas opcionales ausentes no impiden una actualización válida',async()=>{
  assert.equal((await checkMetadata({version:'1.4.0'})).notes.length,0);
  assert.equal((await checkMetadata([{tag_name:'v1.4.0',assets:[asset]}],true)).version,'1.4.0');
  assert.equal((await checkMetadata([{tag_name:'desktop-v1.4.0',assets:[asset]}],true)).version,'1.4.0');
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

test('metadatos incompletos o preliminares del puente no ofrecen reiniciar', () => {
  for(const version of [null,'','desconocida','1.4.0-beta.1'])for(const status of ['available','downloading','ready'])assert.equal(getDesktopUpdateStatus(snapshot(status,version),'1.3.46'),'error');
});

test('la validación no modifica ni persiste el estado recibido de Electron', () => {
  const state = snapshot('ready', '1.3.46');
  assert.equal(getDesktopUpdateStatus(state, '1.3.46'), 'current');
  assert.equal(state.status, 'ready');
  assert.equal(state.progress, 100);
  assert.equal(state.version, '1.3.46');
});
