/* Real isolated task API; only the two connector-confirmed display fixtures
 * are injected. Connector promotion and permissions run against DB in pytest. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

async function verifyTaskDeliveries(browser, { API, WEB, output, viewport }) {
  async function request(route, token, method = 'GET', data) {
    const r = await fetch(API + '/api/v1' + route, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    assert.ok(r.ok, `${route}: ${r.status} ${r.ok ? '' : await r.text()}`);
    return r.status === 204 ? null : r.json();
  }
  assert.equal((await (await fetch(API + '/health')).json()).environment, 'isolated-chat-test');
  const { access_token: token } = await request('/auth/register', null, 'POST', {
    email: `deliveries-${viewport.width}-${Date.now()}@example.com`, password: 'DeliveryTest123', full_name: 'Prueba de entregas',
  });
  const user = await request('/auth/me', token);
  const late = await request('/tasks', token, 'POST', { title: 'Entrega vencida', due_at: '2020-01-01T12:00:00Z' });
  const paper = await request('/tasks', token, 'POST', { title: 'Documento externo', due_at: '2040-05-20T12:00:00Z' });
  const done = await request('/tasks', token, 'POST', { title: 'Completada sin entregar', due_at: '2041-05-20T12:00:00Z' });
  const noDate = await request('/tasks', token, 'POST', { title: 'Tarea sin fecha' });
  const screenshots = [];
  // Este recorrido comprueba Entregas; el emergente se prueba por separado.
  await request('/tasks/overdue-prompts', token, 'POST');

  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
    await context.addInitScript(({ token, user, theme }) => {
      localStorage.setItem('autopilot_token', token);
      localStorage.setItem('autopilot_user', JSON.stringify(user));
      localStorage.setItem('hasCompletedOnboarding_v1', 'true');
      localStorage.setItem('academic-autopilot-theme-v18', theme);
      localStorage.setItem('academic-autopilot-preferences', JSON.stringify({ animationLevel: 'reduced', glassStyle: theme === 'dark' ? 'pure' : 'standard' }));
    }, { token, user, theme });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const confirmationFixtures = ['moodle', 'google_classroom'].map((source, index) => ({
      ...paper, id: `confirmed-display-${index}`, title: `Confirmada ${source}`, source,
      status: 'completed', delivery_status: 'confirmed', delivered_at: new Date().toISOString(),
    }));
    await page.route('**/api/v1/tasks', async route => {
      if (route.request().method() !== 'GET') return route.continue();
      const response = await route.fetch();
      return route.fulfill({ response, json: [...await response.json(), ...confirmationFixtures] });
    });
    try {
      await page.goto(WEB + '/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
      if (theme === 'light') {
        await page.getByRole('button', { name: 'Completar Completada sin entregar', exact: true }).click();
        await page.getByRole('button', { name: 'Completar Completada sin entregar', exact: true }).waitFor({ state: 'hidden' });
      }
      const tab = page.getByRole('tab', { name: 'Entregas', exact: true });
      await tab.click();
      const pending = page.getByRole('region', { name: 'Por entregar', exact: true });
      await pending.getByRole('article', { name: paper.title, exact: true }).waitFor();
      const titles = await pending.locator('h4').allTextContents();
      assert.deepEqual(titles, [late.title, paper.title, done.title, noDate.title]);
      assert.match(await pending.getByRole('article', { name: late.title }).innerText(), /Vencida/);
      const doneCard = pending.getByRole('article', { name: done.title });
      await doneCard.getByText('Completada en Atlantium; sin entrega registrada.', { exact: true }).waitFor();

      for (const [index, platform] of ['Moodle', 'Classroom'].entries()) {
        const card = page.getByRole('article', { name: confirmationFixtures[index].title, exact: true });
        await card.getByText(`Entrega confirmada por ${platform}`, { exact: true }).waitFor();
        assert.equal(await card.getByRole('button', { name: /Deshacer|Marcar/ }).count(), 0);
      }

      const card = page.getByRole('article', { name: paper.title, exact: true });
      await card.getByRole('button', { name: 'Marcar como entregada', exact: true }).click();
      await card.getByLabel('Nota (opcional)', { exact: true }).fill('Entregada en papel. ' + 'Anotación extensa para comprobar el ancho móvil. '.repeat(4));
      await card.getByLabel('Enlace al documento (opcional)', { exact: true }).fill('https://drive.google.com/file/d/documento-externo/view');
      await card.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
      const delivered = page.getByRole('region', { name: 'Entregadas', exact: true });
      await delivered.getByRole('article', { name: paper.title, exact: true }).getByText('Entregada (marcada por ti)', { exact: true }).waitFor();
      const saved = await request('/tasks/' + paper.id, token);
      assert.equal(saved.delivery_status, 'declared');
      assert.equal(saved.status, 'completed');
      assert.equal(saved.due_at, paper.due_at);
      assert.match(saved.delivery_note, /^Entregada en papel/);
      assert.equal(saved.delivery_url, 'https://drive.google.com/file/d/documento-externo/view');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await tab.click();
      await card.getByText('Entregada (marcada por ti)', { exact: true }).waitFor();
      await card.scrollIntoViewIfNeeded();
      const geometry = await page.evaluate(() => {
        const panel = document.getElementById('tasks-panel');
        const boxes = [...panel.querySelectorAll('article, input, button, a')].map(node => node.getBoundingClientRect());
        return { window: innerWidth, document: document.documentElement.scrollWidth, left: Math.min(...boxes.map(b => b.left)), right: Math.max(...boxes.map(b => b.right)) };
      });
      assert.ok(geometry.document <= geometry.window + 1 && geometry.left >= -1 && geometry.right <= geometry.window + 1, JSON.stringify(geometry));
      const screenshot = `entregas-${viewport.width}-${theme}.png`;
      await page.screenshot({ path: path.join(output, screenshot), fullPage: true });
      screenshots.push(screenshot);
      await card.getByRole('button', { name: 'Deshacer entrega', exact: true }).click();
      await pending.getByRole('article', { name: paper.title, exact: true }).waitFor();
      const undone = await request('/tasks/' + paper.id, token);
      assert.equal(undone.delivery_status, 'none');
      assert.equal(undone.status, 'pending');
      assert.equal(undone.due_at, paper.due_at);
      // Una tarea completada y excluida localmente sigue disponible en Entregas.
      await doneCard.getByRole('button', { name: 'Marcar como entregada', exact: true }).click();
      await doneCard.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
      await delivered.getByRole('article', { name: done.title }).getByText('Entregada (marcada por ti)', { exact: true }).waitFor();
      await delivered.getByRole('article', { name: done.title }).getByRole('button', { name: 'Deshacer entrega', exact: true }).click();
      await pending.getByRole('article', { name: done.title }).waitFor();
      assert.equal((await request('/tasks/' + done.id, token)).status, 'completed');
      const pendingTab = page.getByRole('tab', { name: 'Pendientes', exact: true });
      await pendingTab.click();
      await page.keyboard.press('ArrowRight');
      await page.locator('[role="tab"][aria-selected="true"]', { hasText: 'Entregas' }).waitFor();
      assert.equal(await tab.getAttribute('aria-selected'), 'true');
      assert.deepEqual(pageErrors, []);
      console.log(`PASS ${viewport.width} ${theme}: entregas, persistencia, deshacer, confirmadas y ancho`);
    } catch (error) {
      await page.screenshot({ path: path.join(output, `delivery-failure-${viewport.width}-${theme}.png`), fullPage: true }).catch(() => {});
      await fs.writeFile(path.join(output, `delivery-failure-${viewport.width}-${theme}.txt`), `${error.stack}\n${await page.locator('body').innerText()}`);
      throw error;
    } finally {
      // Las lecturas diferidas del dashboard pueden seguir en vuelo al cerrar.
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await context.close();
    }
  }
  return { viewport: viewport.width, themes: ['light', 'dark'], screenshots, confirmedDisplayFixtures: true };
}

module.exports = { verifyTaskDeliveries };
