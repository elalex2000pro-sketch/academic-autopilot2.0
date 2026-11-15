const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {checkVersions}=require('./check.cjs');
function parseNotes(markdown){
  for(const heading of ['Novedades','Correcciones','Avisos'])assert.ok(markdown.includes('## '+heading),'Falta '+heading);
  assert.ok(!markdown.includes('[PENDIENTE]'),'Completar las notas antes del lanzamiento');
  const notes=markdown.split(/\r?\n/).filter(l=>l.startsWith('- ')).map(l=>l.slice(2).trim()).filter(Boolean);
  assert.ok(notes.length>0&&notes.length<=8,'Usar de 1 a 8 puntos compartidos con la app');
  return notes;
}
function createMetadata(version,markdown,installer,now=new Date()){
  const notes=parseNotes(markdown);
  const sizeBytes=fs.statSync(installer).size;assert.ok(sizeBytes>0,'Instalador vacío');
  return {version,publishedAt:null,generatedAt:now.toISOString(),sizeBytes,notes,releaseUrl:`https://github.com/elalex2000pro-sketch/academic-autopilot2.0/releases/tag/v${version}`};
}
module.exports={createMetadata,parseNotes};
if(require.main===module){
  const root=path.resolve(__dirname,'../..'),version=checkVersions(root,process.env.GITHUB_REF_NAME);
  const notes=fs.readFileSync(path.join(root,'docs/releases',version+'.md'),'utf8');
  const directory=process.argv[2];assert.ok(directory,'Indicar carpeta de artefactos');
  const manifest=createMetadata(version,notes,path.join(directory,'Academic-Autopilot-Setup.exe'));
  fs.writeFileSync(path.join(directory,'version.json'),JSON.stringify(manifest,null,2)+'\n');
}
