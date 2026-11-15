const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {checkVersions,checkRemote,checkDraft}=require('./check.cjs'),{createMetadata}=require('./metadata.cjs');
test('versiones reales coherentes y rechazo de etiqueta distinta o preliminar',()=>{
  const v=checkVersions();assert.equal(checkVersions(undefined,'v'+v),v);for(const tag of ['v9.0.0','v'+v+'-beta.1'])assert.throws(()=>checkVersions(undefined,tag));
});
test('todas las raíces de versión deben coincidir',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'version-check-'));
  try{for(const file of ['frontend/package.json','frontend/package-lock.json','desktop/package.json','desktop/package-lock.json','frontend/public/version.json']){
    fs.mkdirSync(path.dirname(path.join(tmp,file)),{recursive:true});fs.writeFileSync(path.join(tmp,file),JSON.stringify({version:'1.3.46',packages:{'':{version:'1.3.46'}}}));
  }
  assert.equal(checkVersions(tmp),'1.3.46');fs.writeFileSync(path.join(tmp,'desktop/package-lock.json'),JSON.stringify({version:'1.3.46',packages:{'':{version:'1.3.45'}}}));assert.throws(()=>checkVersions(tmp));
  fs.mkdirSync(path.join(tmp,'docs/releases'),{recursive:true});fs.writeFileSync(path.join(tmp,'docs/releases/1.3.46.md'),'## Novedades\n- Una mejora.\n## Correcciones\n## Avisos');
  assert.throws(()=>checkDraft(tmp,'1.3.46'));fs.writeFileSync(path.join(tmp,'frontend/public/version.json'),JSON.stringify({version:'1.3.46',enabled:false}));assert.equal(checkDraft(tmp,'1.3.46').length,1);
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('CI y ambos Vercel del mismo commit son obligatorios',()=>{
  const run={id:1,head_sha:'abc',head_branch:'main',event:'push',status:'completed',conclusion:'success'};
  const statuses=['Vercel – academicautopilot','Vercel – academic-autopilot2-0'].map(context=>({id:1,context,state:'success'}));
  checkRemote([run],statuses,'abc');
  for(const conclusion of ['failure',null,'cancelled'])assert.throws(()=>checkRemote([{...run,conclusion}],statuses,'abc'));
  for(const state of ['pending','failure','error'])assert.throws(()=>checkRemote([run],[{...statuses[0],state},statuses[1]],'abc'));
  assert.throws(()=>checkRemote([run],statuses.slice(1),'abc'));assert.throws(()=>checkRemote([run],statuses,'other'));
  assert.throws(()=>checkRemote([run,{...run,id:2,conclusion:'failure'}],statuses,'abc'));
});
test('el manifiesto usa bytes reales y las mismas notas, sin fecha de publicación inventada',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'manifest-check-'));
  try{const installer=path.join(tmp,'test.exe');fs.writeFileSync(installer,Buffer.alloc(12345));const m=createMetadata('1.3.46','## Novedades\n- Una mejora.\n## Correcciones\n- Un arreglo.\n## Avisos',installer);assert.equal(m.sizeBytes,12345);assert.equal(m.publishedAt,null);assert.deepEqual(m.notes,['Una mejora.','Un arreglo.']);assert.throws(()=>createMetadata('1.3.46','[PENDIENTE]',installer));}finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
