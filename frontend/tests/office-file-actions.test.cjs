const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { Blob, File } = require("node:buffer");
const ts = require("typescript");

async function main() {
  const downloads = [];
  const window = {};
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, "../src/lib/office-file-actions.ts"), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, window, Blob, File, require(name) {
    assert.equal(name, "./office-doc");
    return { downloadFile: (name, blob) => downloads.push({ name, blob }) };
  } });
  const blob = new Blob(["Álgebra"], { type: "text/html" });
  assert.equal((await exports.saveOfficeFile("texto.html", blob)).ok, true);
  assert.equal(downloads[0].blob, blob);
  await exports.saveOfficeFile("texto.docx", blob, "application/docx");
  assert.equal(downloads[1].blob.type, "application/docx");
  assert.equal(await downloads[1].blob.text(), "Álgebra");
  assert.equal(await exports.pickOfficeFile(), null);

  const calls = [];
  let saved = { ok: true, path: "documento.html" };
  let opened = { ok: true, name: "texto.txt", text: "Contenido" };
  window.autopilotDesktop = { files: {
    save: async payload => { calls.push(payload); return saved; },
    open: async payload => { assert.equal(payload.mode, "pick-office"); return opened; },
  } };
  assert.equal(await exports.saveOfficeFile("texto.html", blob), saved);
  assert.equal(calls[0].name, "texto.html");
  assert.equal(Buffer.from(calls[0].data).toString(), "Álgebra");
  assert.equal(Object.hasOwn(calls[0], "mimeType"), false);
  await exports.saveOfficeFile("texto.docx", blob, "application/docx");
  assert.equal(calls[1].mimeType, "application/docx");
  saved = { ok: false, canceled: true };
  assert.equal(await exports.saveOfficeFile("texto.html", blob), saved);
  saved = { ok: false, error: "Error del sistema" };
  assert.equal(await exports.saveOfficeFile("texto.html", blob), saved);
  assert.equal(downloads.length, 2);

  let result = await exports.pickOfficeFile();
  assert.equal(result.file.name, "texto.txt");
  assert.equal(await result.file.text(), "Contenido");
  opened = { ok: true, name: "texto.docx", data: new Uint8Array([80, 75, 3, 4]).buffer };
  result = await exports.pickOfficeFile();
  assert.deepEqual(Buffer.from(await result.file.arrayBuffer()), Buffer.from([80, 75, 3, 4]));
  opened = { ok: false, canceled: true };
  result = await exports.pickOfficeFile();
  assert.equal(result.file, null);
  assert.equal(result.canceled, true);
  console.log("PASS Office file transport: browser, native bytes/MIME, cancellation, errors, text and DOCX");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
