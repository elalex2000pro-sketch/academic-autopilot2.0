const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const config = require('./package.json');
const source = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');

test('el perfil legado se fija antes del actualizador, nombre y sesiones', () => {
  const paths = {}, events = [];
  const app = {
    getPath(name) { assert.equal(name, 'appData'); return '/isolated/app-data'; },
    setPath(name, value) { paths[name] = value; events.push(name); },
    setName(name) { assert.equal(name, 'Atlantium'); events.push('name'); },
  };
  vm.runInNewContext(source.slice(0, source.indexOf('// electron-updater')), {
    require(name) {
      if (name === 'electron') return { app };
      if (name === 'node:path') return path;
      if (name === 'node:fs') return { mkdirSync(value) { assert.equal(value, path.join('/isolated/app-data', 'academic-autopilot-desktop')); } };
      throw Error(name);
    },
  });
  assert.equal(paths.userData, path.join('/isolated/app-data', 'academic-autopilot-desktop'));
  assert.equal(paths.sessionData, paths.userData);
  assert.deepEqual(events, ['userData', 'sessionData', 'name']);
  assert.match(source, /const PARTITION = "persist:academic-autopilot"/);
  assert.match(source, /partition: PARTITION/);
  assert.match(source, /setAppUserModelId\("com\.academicautopilot\.desktop\.iconfix1"\)/);
});

test('la marca cambia sin cambiar identidad, instaladores o feed', () => {
  assert.equal(config.name, 'academic-autopilot-desktop');
  assert.equal(config.version, '1.4.0');
  assert.equal(config.build.productName, 'Atlantium');
  assert.equal(config.build.appId, 'com.academicautopilot.desktop.iconfix1');
  assert.equal(config.build.win.executableName, 'Academic Autopilot 1310');
  assert.equal(config.build.win.artifactName, 'Academic-Autopilot-Setup.exe');
  assert.equal(config.build.mac.artifactName, 'Academic-Autopilot-${version}-mac.${ext}');
  assert.equal(config.build.nsis.guid, '7D4A2C91-3B6E-4F8A-9C1D-2E5B7A9F4C60');
  assert.equal(config.build.nsis.shortcutName, 'Atlantium');
  assert.equal(config.build.nsis.deleteAppDataOnUninstall, false);
  assert.deepEqual(config.build.publish, [{ provider: 'github', owner: 'elalex2000pro-sketch', repo: 'academic-autopilot2.0', releaseType: 'release' }]);
});
