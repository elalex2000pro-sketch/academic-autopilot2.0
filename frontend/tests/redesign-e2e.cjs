/* R1 visual contract. Run against owned isolated API + a production web build.
 * R1_OUTPUT must persist between --baseline and comparison runs. No production.
 * Test account/API records and local cosmetic progress are temporary fixtures.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { spawnSync } = require('node:child_process');
const API = 'http://127.0.0.1:8000', WEB = 'http://localhost:3000';
const output = process.env.R1_OUTPUT;
const baseline = process.argv.includes('--baseline');
const selectorsOnly = process.argv.includes('--aurora-selectors');
const stage = baseline ? 'before' : (process.env.R1_STAGE || 'after');
async function request(route, token, data) {
  const r = await fetch(API + '/api/v1' + route, {
    method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  assert.ok(r.ok, route + ': ' + r.status);
  return r.json();
}
async function main() {
  assert.ok(output, 'Set R1_OUTPUT to the persistent temporary artifact directory');
  assert.equal((await (await fetch(API + '/health')).json()).environment, 'isolated-chat-test');
  await fs.mkdir(path.join(output, stage), { recursive: true });
  const fixtureFile = path.join(output, 'fixtures.json');
  let fixture;
  try { fixture = JSON.parse(await fs.readFile(fixtureFile)); } catch {
    assert.ok(baseline, 'Create baseline fixtures first');
    const account = await request('/auth/register', null, { email: `r1-${Date.now()}@example.com`, password: 'VisualRegression123', full_name: 'Alumno R1' });
    const token = account.access_token, user = await request('/auth/me', token);
    const group = await request('/classes', token, { name: 'Clase R1' });
    const office = await request('/office/documents', token, { title: 'Documento R1', content: '<h1>Documento R1</h1><p>Referencia visual persistida en la API de pruebas.</p>' });
    fixture = { token, user, group, office };
    await fs.writeFile(fixtureFile, JSON.stringify(fixture));
  }
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  try {
    for (const width of [1440, 390]) for (const theme of ['light', 'dark']) for (const glass of ['standard', 'pure']) for (const aurora of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 960 : 844 }, serviceWorkers: 'block', colorScheme: theme });
      await context.addInitScript(({ fixture, theme, glass, aurora }) => {
        // Freeze displayed calendar dates, but keep Date.now/performance running:
        // Framer uses the live animation clock to finish its spring transitions.
        const NativeDate = window.Date;
        window.Date = class extends NativeDate {
          constructor(...args) { super(...(args.length ? args : ['2026-11-15T12:00:00Z'])); }
          static now() { return NativeDate.now(); }
        };
        localStorage.setItem('autopilot_token', fixture.token);
        localStorage.setItem('autopilot_user', JSON.stringify(fixture.user));
        localStorage.setItem('hasCompletedOnboarding_v1', 'true');
        localStorage.setItem('academic-autopilot-theme-v18', theme);
        localStorage.setItem('academic-autopilot-preferences', JSON.stringify({ glassStyle: glass, performanceProfile: 'quality', animationLevel: 'standard' }));
        // Level 5 fixture: the real reward validation must accept the equipped theme.
        localStorage.setItem('autopilot:gamification:' + fixture.user.id, JSON.stringify({ xp: 1000, awardedTasks: [], equippedBadge: null, equippedTheme: aurora ? 'theme-aurora' : null }));
      }, { fixture, theme, glass, aurora });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const routes = [['home', '/'], ['planner', '/planner'], ['academics', '/academics'], ['settings', '/settings'], ['chat', '/chat'], ['classes', '/classes/' + fixture.group.id], ['documents', '/documents'], ['office', '/office/' + fixture.office.id], ['library', '/library'], ['studio', '/studio']];
      for (const [name, route] of routes) {
        if (selectorsOnly && (name !== 'home' || !aurora)) continue;
        if (process.env.R1_QUICK && name !== 'home') continue;
        await page.goto(WEB + route, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => document.querySelector('main')?.textContent.trim().length > 35);
        if (name === 'office') await page.locator('.ck-editor__editable_root').waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1300);
        if (name === 'home') {
          await page.waitForFunction(() => {
            const counters = [...document.querySelectorAll('section[aria-label^="Nivel 5,"] span.inline-block.tabular-nums')];
            return counters.map(e => e.textContent).join('|') === '5|1000|5|500' && counters.every(e => getComputedStyle(e).transform === 'none');
          }, undefined, { timeout: 20000 });
        }
        await page.waitForFunction(() => [...document.querySelectorAll('span.inline-block.tabular-nums')].filter(e => {
          const r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0;
        }).every(e => getComputedStyle(e).opacity === '1' && getComputedStyle(e).transform === 'none'));
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        assert.equal(await page.locator('html').getAttribute('data-glass'), glass);
        // Existing reward emits theme-aurora; CSS currently selects aurora.
        // Preserve and expose this mismatch instead of fixing product behavior.
        assert.equal(await page.locator('html').getAttribute('data-cosmetic-theme'), aurora ? 'theme-aurora' : '');
        let key = `${width}-${theme}-${glass}-${aurora ? 'aurora' : 'default'}-${name}`;
        if (selectorsOnly) {
          // Explicit CSS-state coverage, distinct from the real equipped-reward path.
          await page.evaluate(() => { document.documentElement.dataset.cosmeticTheme = 'aurora'; });
          await page.waitForTimeout(400);
          key += '-css-selector';
        }
        await page.mouse.move(0, 0);
        let shot = await page.screenshot({ animations: 'disabled', caret: 'hide' });
        let stable = false;
        for (let attempt = 0; attempt < 20; attempt++) {
          await page.waitForTimeout(200);
          const next = await page.screenshot({ animations: 'disabled', caret: 'hide' });
          if (shot.equals(next)) { stable = true; break; }
          shot = next;
        }
        assert.ok(stable, 'Screenshot must stabilize: ' + key);
        await fs.writeFile(path.join(output, stage, key + '.png'), shot);
        results.push(key);
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally { await browser.close(); }
  await fs.writeFile(path.join(output, stage, 'results.json'), JSON.stringify(results, null, 2));
  if (!baseline) {
    const python = process.env.SMOKE_PYTHON || path.resolve(__dirname, '../../.venv311/Scripts/python.exe');
    const comparison = spawnSync(python, ['-c', `
from PIL import Image, ImageChops
from pathlib import Path
import json,sys
root=Path(sys.argv[1]); stage=sys.argv[2]; failures=[]; noise=[]
for key in json.loads((root/stage/'results.json').read_text()):
 a=Image.open(root/'before'/(key+'.png')).convert('RGB'); b=Image.open(root/stage/(key+'.png')).convert('RGB')
 diff=ImageChops.difference(a,b); box=diff.getbbox()
 if box:
  diff.save(root/stage/(key+'-diff.png'))
  count=sum(p!=(0,0,0) for p in diff.get_flattened_data()); maximum=max(v[1] for v in diff.getextrema())
  item={'case':key,'bounds':box,'pixels':count,'max_channel_difference':maximum}
  # Calibration exposed text-raster differences of 1-2/255 channel units.
  # Alias-only CSS was also checked by exact declaration expansion. Keep all
  # differences in the report; reject visible color/layout/content differences.
  # Keep those differences visible in the report; reject larger differences.
  (noise if maximum<=2 and count<=5000 else failures).append(item)
(root/stage/'comparison.json').write_text(json.dumps({'cases':len(json.loads((root/stage/'results.json').read_text())),'failures':failures,'raster_noise':noise},indent=2))
print(json.dumps({'failures':failures,'raster_noise':noise}))
sys.exit(bool(failures))
`, output, stage], { encoding: 'utf8', windowsHide: true });
    console.log(comparison.stdout);
    assert.equal(comparison.status, 0, comparison.stderr || 'Visual differences; inspect comparison.json and diff PNGs');
  }
  console.log(`PASS R1 ${stage}: ${results.length} screenshots; artifacts ${output}`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
