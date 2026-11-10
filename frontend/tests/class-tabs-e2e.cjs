const { chromium } = require("playwright-core");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
async function main() {
  const API = "http://127.0.0.1:8000";
  assert.equal(
    (await (await fetch(API + "/health")).json()).environment,
    "isolated-chat-test",
  );
  const suffix = Date.now();
  async function req(url, token, method = "GET", body) {
    const r = await fetch(API + "/api/v1" + url, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.ok(r.ok, await r.clone().text());
    return r.status === 204 ? null : r.json();
  }
  async function account(n) {
    const t = await req("/auth/register", "", "POST", {
      email: n + suffix + "@example.com",
      password: "Classwork123",
      full_name: n,
    });
    return {
      token: t.access_token,
      user: await req("/auth/me", t.access_token),
    };
  }
  const a = await account("Alejandro");
  const b = await account("Lucia");
  const group = await req("/classes", a.token, "POST", {
    name: "Estudio entre compañeros",
  });
  await req("/classes/join", b.token, "POST", { code: group.code });
  const topic = await req("/classes/" + group.id + "/topics", b.token, "POST", {
    title: "Redes",
    order: 0,
  });
  const tomorrow = new Date(Date.now() + 86400000).toISOString();
  await req("/classes/" + group.id + "/assignments", b.token, "POST", {
    title: "Repaso para mañana",
    topic_id: topic.id,
    due_at: tomorrow,
  });
  await req("/classes/" + group.id + "/events", a.token, "POST", {
    title: "Redes próximo",
    start_at: tomorrow,
    is_exam: true,
  });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  async function pageFor(u) {
    const c = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      serviceWorkers: "block",
    });
    await c.addInitScript((u) => {
      localStorage.setItem("autopilot_token", u.token);
      localStorage.setItem("autopilot_user", JSON.stringify(u.user));
      localStorage.setItem("hasCompletedOnboarding_v1", "true");
    }, u);
    const p = await c.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://localhost:3000/classes/" + group.id);
    await p.getByRole("tab", { name: "Novedades", exact: true }).click();
    return p;
  }
  try {
    const p = await pageFor(b);
    const q = await pageFor(a);
    await p
      .locator("aside")
      .getByText("Repaso para mañana", { exact: true })
      .waitFor();
    await p
      .locator("aside")
      .getByText("Examen: Redes próximo", { exact: true })
      .waitFor();
    await p
      .getByLabel("Compartir algo con tu clase")
      .fill("Publicación del compañero");
    await p.getByRole("button", { name: "Publicar", exact: true }).click();
    await q.getByText("Publicación del compañero", { exact: true }).waitFor();
    await q.getByLabel("Compartir algo con tu clase").fill("Publicación nueva");
    await q.getByRole("button", { name: "Publicar", exact: true }).click();
    await p.getByText("Publicación nueva", { exact: true }).waitFor();
    const post = q
      .locator("article")
      .filter({ hasText: "Publicación del compañero" });
    await post.getByRole("button", { name: "Fijar", exact: true }).click();
    await p.locator('article[data-pinned="true"]').waitFor();
    assert.match(
      await p.locator("article").first().innerText(),
      /Publicación del compañero/,
    );
    const peerPost = p
      .locator("article")
      .filter({ hasText: "Publicación del compañero" });
    await peerPost.getByRole("textbox").fill("Respuesta en directo");
    await peerPost
      .getByRole("button", { name: "Responder", exact: true })
      .click();
    await q.getByText("Respuesta en directo", { exact: true }).waitFor();
    await q.reload();
    await q.getByText("Respuesta en directo", { exact: true }).waitFor();
    for (const [name, id] of [
      ["Novedades", "news"],
      ["Trabajo de clase", "work"],
      ["Personas", "people"],
      ["Calendario", "calendar"],
      ["Cuadernos y archivos", "notebooks"],
    ]) {
      await p.getByRole("tab", { name, exact: true }).click();
      const panel = p.locator('[data-class-tab="' + id + '"]');
      await panel.waitFor();
      assert.ok((await panel.innerText()).length > 15);
      await p.getByRole("tab", { name, exact: true }).click();
      assert.ok(await panel.isVisible());
    }
    await p.getByRole("tab", { name: "Personas", exact: true }).click();
    await p.getByText("Administrador/a", { exact: true }).waitFor();
    await p.setViewportSize({ width: 390, height: 844 });
    for (const [name, id] of [
      ["Novedades", "news"],
      ["Trabajo de clase", "work"],
      ["Personas", "people"],
      ["Calendario", "calendar"],
      ["Cuadernos y archivos", "notebooks"],
    ]) {
      await p.getByRole("tab", { name, exact: true }).click();
      await p.locator('[data-class-tab="' + id + '"]').waitFor();
    }
    const output = await fs.mkdtemp(path.join(os.tmpdir(), "class-tabs-"));
    await p.screenshot({
      path: path.join(output, "tabs-mobile.png"),
      fullPage: true,
    });
    await p.setViewportSize({ width: 1440, height: 1000 });
    await p.getByRole("tab", { name: "Novedades", exact: true }).click();
    await p.locator('[data-class-tab="news"]').waitFor();
    await p.waitForFunction(() => {
      const panel = document.querySelector('[data-class-tab="news"]');
      return panel && getComputedStyle(panel).opacity === "1";
    });
    await p.screenshot({
      path: path.join(output, "tabs-desktop.png"),
      fullPage: true,
    });
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log(
      JSON.stringify({
        result: "passed",
        checks: [
          "two-user realtime posts",
          "pins sorted first",
          "replies realtime and after reload",
          "five nonblank tabs desktop/mobile",
          "active tab never collapses",
          "administrator label",
        ],
        output,
      }),
    );
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
