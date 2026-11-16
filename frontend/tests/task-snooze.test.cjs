const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function load(name, requireModule=()=>{throw Error('Unexpected dependency');}) {
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/'+name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const exports={};vm.runInNewContext(code,{exports,require:requireModule,Intl,Date,Set,Map});return exports;
}
const snooze=load('task-snooze');
test('Madrid: fechas relativas por dias civiles, incluso con cambios de hora',()=>{
  for(const [now,expected] of [['2030-03-30T23:30:00Z','2030-04-01'],['2030-10-26T22:30:00Z','2030-10-28']]) assert.equal(snooze.reminderDateAfter(1,Date.parse(now)),expected);
  assert.equal(snooze.reminderDateAfter(3,Date.parse('2030-03-29T12:00:00Z')),'2030-04-01');
});
test('el aplazamiento deja de estar vigente al comenzar su dia en Madrid',()=>{
  const task={snoozed_until:'2030-03-31T22:00:00Z'};
  assert.equal(snooze.isSnoozed(task,Date.parse('2030-03-31T21:59:59Z')),true);
  assert.equal(snooze.isSnoozed(task,Date.parse('2030-03-31T22:00:00Z')),false);
});
test('no emergente para completadas, archivadas, entregadas ni tareas del mismo dia',()=>{
  const task={id:'a',title:'Tarea',status:'pending',due_at:'2030-03-29T10:00:00Z'};const now=Date.parse('2030-03-30T10:00:00Z');
  assert.equal(snooze.isOverdueReminder(task,now),true);
  for(const patch of [{status:'completed'},{status:'archived'},{delivery_status:'declared'},{delivery_status:'confirmed'},{due_at:'2030-03-30T00:00:00Z'}]) assert.equal(snooze.isOverdueReminder({...task,...patch},now),false);
});
test('el centro de avisos silencia el vencimiento sin alterar el plazo',()=>{
  const {buildNotifications}=load('notifications',()=>snooze);
  const task={id:'a',title:'Tarea',status:'pending',due_at:'2030-03-29T10:00:00Z',snoozed_until:'2030-04-01T22:00:00Z'};
  const now=Date.parse('2030-03-30T10:00:00Z');
  assert.equal(buildNotifications({tasks:[task],grades:[],courses:[],now}).filter(n=>n.kind==='deadline').length,0);
  assert.equal(buildNotifications({tasks:[task,{...task,id:'part',parent_task_id:task.id,snoozed_until:null}],grades:[],courses:[],now}).filter(n=>n.kind==='deadline').length,0);
  assert.equal(buildNotifications({tasks:[{...task,snoozed_until:null}],grades:[],courses:[],now}).filter(n=>n.kind==='deadline').length,1);
  assert.equal(task.due_at,'2030-03-29T10:00:00Z');
});
