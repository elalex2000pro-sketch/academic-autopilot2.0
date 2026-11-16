const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/task-delivery.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exports_ = {};
vm.runInNewContext(code, { exports: exports_ });
const { groupTaskDeliveries, deliveryLabel } = exports_;

test('separa entrega de completado; admite copias antiguas y ordena por vencimiento', () => {
  const tasks = [
    { id: 'done', title: 'Completada pero no entregada', status: 'completed', due_at: '2030-05-25' },
    { id: 'late', title: 'Vencida', status: 'pending', due_at: '2020-01-01' },
    { id: 'none', title: 'Sin fecha', status: 'pending' },
    { id: 'declared', title: 'En papel', status: 'completed', delivery_status: 'declared', delivered_at: '2030-01-01' },
    { id: 'confirmed', title: 'Confirmada', status: 'completed', delivery_status: 'confirmed', delivered_at: '2030-02-01' },
    { id: 'part', title: 'Parte', status: 'pending', parent_task_id: 'late' },
    { id: 'archived', title: 'Archivada', status: 'archived' },
  ];
  const original = JSON.stringify(tasks);
  const groups = groupTaskDeliveries(tasks);
  assert.deepEqual(Array.from(groups.pending, t => t.id), ['late', 'done', 'none']);
  assert.deepEqual(Array.from(groups.delivered, t => t.id), ['confirmed', 'declared']);
  assert.equal(JSON.stringify(tasks), original);
});

test('distingue la declaracion personal de la confirmacion y su plataforma', () => {
  assert.equal(deliveryLabel({ delivery_status: 'declared', source: 'manual' }), 'Entregada (marcada por ti)');
  assert.equal(deliveryLabel({ delivery_status: 'confirmed', source: 'moodle' }), 'Entrega confirmada por Moodle');
  assert.equal(deliveryLabel({ delivery_status: 'confirmed', source: 'google_classroom' }), 'Entrega confirmada por Classroom');
  assert.equal(deliveryLabel({}), 'Sin entrega registrada');
});
