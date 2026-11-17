/* R2: real isolated API, persisted layouts, responsive navigation and keyboard. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright-core');
const API = process.env.SMOKE_API || 'http://127.0.0.1:8000', WEB = process.env.SMOKE_WEB || 'http://localhost:3000';
const baseline = process.argv.includes('--baseline');
const output = process.env.REDESIGN_OUTPUT;
async function main() {
  assert.ok(output, 'Set REDESIGN_OUTPUT outside the repository');
  assert.ok([API, WEB].every(url => ['localhost', '127.0.0.1'].includes(new URL(url).hostname)), 'Only isolated local servers');
  assert.equal((await (await fetch(API + '/health')).json()).environment, 'isolated-chat-test');
  const auth = await fetch(API + '/api/v1/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `sidebar-${Date.now()}@example.com`, password: 'SidebarTest123', full_name: 'Prueba de navegación' }) });
  assert.ok(auth.ok);
  const { access_token: token } = await auth.json();
  const user = await (await fetch(API + '/api/v1/auth/me', { headers: { Authorization: 'Bearer ' + token } })).json();
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.SMOKE_BROWSER_CHANNEL || 'chrome', headless: true });
  try {
    for (const width of [390, 768, 1280]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
      await context.addInitScript(({ token, user, theme }) => {
        if (sessionStorage.getItem('r2-initialized')) return;
        localStorage.setItem('autopilot_token', token);
        localStorage.setItem('autopilot_user', JSON.stringify(user));
        localStorage.setItem('hasCompletedOnboarding_v1', 'true');
        localStorage.setItem('academic-autopilot-theme-v18', theme);
        localStorage.setItem('layout_sidebar', JSON.stringify({ side: 'left', collapsed: false }));
        sessionStorage.setItem('r2-initialized', 'true');
      }, { token, user, theme });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(WEB, { waitUntil: 'networkidle' });
      await page.locator('main h1').first().waitFor();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(output, `${width}-${theme}-expanded.png`), animations: 'disabled' });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow');
      if (!baseline && width >= 768) {
        const sidebar = page.getByRole('complementary', { name: 'Barra lateral' });
        const toggle = sidebar.getByRole('button', { name: 'Ocultar nombres de la barra' });
        await toggle.click();
        assert.equal(await sidebar.getAttribute('data-collapsed'), 'true');
        await page.reload({ waitUntil: 'networkidle' });
        assert.equal(await sidebar.getAttribute('data-collapsed'), 'true', 'Persists collapse');
        const planner = sidebar.getByRole('link', { name: 'Planificador', exact: true });
        await planner.focus();
        await page.getByRole('tooltip', { name: 'Planificador', exact: true }).waitFor();
        await page.keyboard.press('Escape');
        await page.getByRole('tooltip').waitFor({ state: 'hidden' });
        await page.keyboard.press('Enter');
        await page.waitForURL('**/planner');
        await page.locator('main h1').first().waitFor();
        await page.waitForTimeout(600);
        assert.equal(await planner.getAttribute('aria-current'), 'page');
        await page.screenshot({ path: path.join(output, `${width}-${theme}-compact.png`), animations: 'disabled' });
        await sidebar.getByRole('link', { name: 'Ajustes', exact: true }).click();
        const names = page.getByRole('switch', { name: 'Mostrar nombres en la barra', exact: true });
        await names.click();
        assert.equal(await sidebar.getAttribute('data-collapsed'), 'false');
        await page.getByRole('button', { name: 'Derecha', exact: true }).click();
        await page.reload({ waitUntil: 'networkidle' });
        assert.equal(await sidebar.getAttribute('data-side'), 'right');
        assert.equal(await sidebar.getAttribute('data-collapsed'), 'false');
        await sidebar.getByRole('link', { name: 'Chat', exact: true }).click();
        await page.waitForURL('**/chat');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS sidebar ${baseline ? 'before' : 'after'} ${width} ${theme}`);
    }
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
