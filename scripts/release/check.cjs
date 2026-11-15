const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..');
function checkVersions(root=ROOT,tag){
  const files=['frontend/package.json','frontend/package-lock.json','desktop/package.json','desktop/package-lock.json','frontend/public/version.json'];
  const values=files.flatMap(file=>{const data=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));return file.endsWith('lock.json')?[data.version,data.packages?.['']?.version]:[data.version];});
  const version=values[0];assert.match(version,/^\d+\.\d+\.\d+$/,'Solo versiones estables');
  assert.ok(values.every(v=>v===version),'Los cinco archivos (incluidas raíces lock) deben tener la misma versión');
  if(tag!==undefined)assert.equal(tag,'v'+version,'La etiqueta debe coincidir exactamente con la versión');
  return version;
}
function checkRemote(runs,statuses,sha){
  const run=runs.filter(r=>r.head_sha===sha&&r.head_branch==='main'&&r.event==='push').sort((a,b)=>b.id-a.id)[0];
  assert.ok(run?.status==='completed'&&run.conclusion==='success','El último CI de main para este commit no está verde');
  for(const context of ['Vercel – academicautopilot','Vercel – academic-autopilot2-0']){
    const status=statuses.filter(s=>s.context===context).sort((a,b)=>b.id-a.id)[0];
    assert.equal(status?.state,'success',context+' debe estar verde');
  }
}
async function remote(){
  assert.equal(process.env.GITHUB_EVENT_NAME,'push');assert.equal(process.env.GITHUB_REF_TYPE,'tag');
  const tag=process.env.GITHUB_REF_NAME;checkVersions(ROOT,tag);
  require('./metadata.cjs').parseNotes(fs.readFileSync(path.join(ROOT,'docs/releases',tag.slice(1)+'.md'),'utf8'));
  const sha=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  assert.equal(sha,cp.execFileSync('git',['rev-parse','origin/main'],{encoding:'utf8'}).trim(),'La etiqueta debe apuntar al main actual');
  const repo=process.env.GITHUB_REPOSITORY;
  async function get(route){const r=await fetch('https://api.github.com/repos/'+repo+route,{headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json'}});assert.ok(r.ok,'GitHub '+r.status);return r.json();}
  const runs=await get('/actions/workflows/ci.yml/runs?event=push&head_sha='+sha+'&per_page=100');
  const statuses=await get('/commits/'+sha+'/statuses?per_page=100');
  checkRemote(runs.workflow_runs,statuses,sha);console.log('Versiones, etiqueta, CI y dos Vercel correctos para '+sha);
}
module.exports={checkVersions,checkRemote};
if(require.main===module)(async()=>{if(process.argv[2]==='--remote')await remote();else console.log(checkVersions(ROOT,process.argv[2]));})().catch(e=>{console.error(e.message);process.exitCode=1;});
