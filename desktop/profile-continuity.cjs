// Windows-only packaged-app rehearsal. Never runs an installer or uses a personal profile.
// node desktop/profile-continuity.cjs <published-1.4.0.exe> <candidate.exe>
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
assert.equal(process.platform,'win32');
const [baseline,candidate]=process.argv.slice(2);assert.ok(baseline&&candidate,'Provide both unpacked executables');
assert.equal(fs.readFileSync(path.join(path.dirname(baseline),'resources/app-update.yml'),'utf8'),fs.readFileSync(path.join(path.dirname(candidate),'resources/app-update.yml'),'utf8'),'Packaged updater feed must remain identical');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlantium-continuity-')),appData=path.join(root,'app-data'),profile=path.join(appData,'academic-autopilot-desktop');
fs.mkdirSync(profile,{recursive:true});fs.writeFileSync(path.join(profile,'window-preferences.json'),JSON.stringify({useCustomTitlebar:false}));
const appRoot=path.resolve(__dirname,'..');
const delay=ms=>new Promise(r=>setTimeout(r,ms));async function until(fn){for(let i=0;i<200;i++){try{const x=await fn();if(x)return x;}catch{}await delay(100);}throw Error('Timeout waiting for isolated Electron');}
function pdfFixture(){const stream='BT /F1 18 Tf 40 140 Td (PDF local de prueba) Tj ET';const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];let value='%PDF-1.4\n';const offsets=[0];objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(value));value+=`${i+1} 0 obj\n${obj}\nendobj\n`});const start=Buffer.byteLength(value);value+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return Buffer.from(value)}
const pdf=pdfFixture();
const results=[];let active;
const server=http.createServer((req,res)=>{
 if(req.url==='/localforage.js'){res.setHeader('Content-Type','text/javascript');fs.createReadStream(path.join(appRoot,'frontend/node_modules/localforage/dist/localforage.js')).pipe(res);return;}
 res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Atlantium</title><h1>Atlantium</h1><script src="/localforage.js"></script>');
});
function protocol(ws){let id=0;const pending=new Map();const api={paused:null};ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Debugger.paused')api.paused=m.params;if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});api.send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});return api;}
async function run(exe,version,seed){
 for(const port of [9351,9352])await new Promise((resolve,reject)=>{const probe=require('node:net').createServer();probe.once('error',reject);probe.listen(port,'127.0.0.1',()=>probe.close(resolve));});
 const log=fs.openSync(path.join(root,'native-'+(seed?'baseline':'candidate')+'.log'),'w');
 active=cp.spawn(exe,['--inspect-brk=127.0.0.1:9351','--remote-debugging-port=9352','--remote-debugging-address=127.0.0.1'],{env:{...process.env,AUTOPILOT_APP_URL:'http://localhost:3900',AUTOPILOT_SMOKE:'1'},windowsHide:true,stdio:['ignore',log,log]});
 let ws,browser;
 try{
  const targets=await until(async()=>{const r=await fetch('http://127.0.0.1:9351/json/list');return r.json()});ws=new WebSocket(targets[0].webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));const api=protocol(ws);await api.send('Debugger.enable');await api.send('Runtime.runIfWaitingForDebugger');await until(()=>api.paused);
  const frame=api.paused.callFrames[0];const script=await api.send('Debugger.getScriptSource',{scriptId:frame.location.scriptId});assert.ok(script.scriptSource.includes('com.academicautopilot.desktop.iconfix1'),'Must pause in application entry before touching any profile');
  const expr=`(()=>{const e=require('electron');e.app.setPath('appData',${JSON.stringify(appData)});if(${seed}){e.app.setPath('userData',${JSON.stringify(profile)});e.app.setPath('sessionData',${JSON.stringify(profile)});}global.__realExit=e.app.exit.bind(e.app);e.app.exit=()=>{};return {version:e.app.getVersion()}})()`;
  const setup=await api.send('Debugger.evaluateOnCallFrame',{callFrameId:frame.callFrameId,expression:expr,returnByValue:true});assert.ok(!setup.exceptionDetails,JSON.stringify(setup));assert.equal(setup.result.value.version,'1.4.0');assert.equal(setup.result.value.version,version);
  await api.send('Debugger.resume');
  await until(async()=>{const r=await fetch('http://127.0.0.1:9352/json/list');const d=await r.json();return d.some(t=>t.url==='http://localhost:3900/')});
  browser=await require(appRoot+'/frontend/node_modules/playwright-core').chromium.connectOverCDP('http://127.0.0.1:9352');const page=browser.contexts()[0].pages()[0];await page.waitForFunction(()=>window.localforage&&window.autopilotDesktop);
  const data=await page.evaluate(async ({seed,pdf})=>{
    const books=localforage.createInstance({name:'academic-autopilot',storeName:'library_books'}),files=localforage.createInstance({name:'academic-autopilot',storeName:'library_files'});
    if(seed){document.cookie='session_probe=kept; max-age=3600; path=/';localStorage.setItem('autopilot_token','isolated-session-token');localStorage.setItem('academic-autopilot-preferences',JSON.stringify({animationLevel:'reduced'}));const c=await caches.open('continuity-cache');await c.put('/cached-resource',new Response('cached bytes'));localStorage.setItem('academic-office-draft:release-test:local',JSON.stringify({data:{title:'Documento de prueba',content:'Texto local conservado'}}));await books.setItem('pdf-release-test',{id:'pdf-release-test',title:'PDF de prueba',fileName:'prueba.pdf',lastPage:1,notes:'Nota conservada',bookmarks:[1]});await files.setItem('pdf-release-test',Uint8Array.from(atob(pdf),c=>c.charCodeAt(0)).buffer);}
    const storedPdf=await files.getItem('pdf-release-test');const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',storedPdf))).map(v=>v.toString(16).padStart(2,'0')).join('');return {cookie:document.cookie,token:localStorage.getItem('autopilot_token'),preferences:localStorage.getItem('academic-autopilot-preferences'),cached:await(await caches.match('/cached-resource')).text(),draft:localStorage.getItem('academic-office-draft:release-test:local'),book:await books.getItem('pdf-release-test'),pdfHash:hash,ua:navigator.userAgent};
  },{seed,pdf:pdf.toString('base64')});
  assert.ok(data.ua.includes('AcademicAutopilotDesktop/'+version));if(!seed){for(const key of ['cookie','token','preferences','cached'])assert.equal(data[key],results[0].data[key]);assert.equal(data.draft,results[0].data.draft);assert.deepEqual(data.book,results[0].data.book);assert.equal(data.pdfHash,results[0].data.pdfHash);}
  async function evaluate(expression){const r=await api.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
  const identity=await evaluate("(()=>{const e=process.mainModule.require('electron');return {name:e.app.getName(),userData:e.app.getPath('userData'),sessionData:e.app.getPath('sessionData'),partitionPath:e.BrowserWindow.getAllWindows()[0].webContents.session.storagePath}})()");
  assert.equal(identity.userData,profile);assert.equal(identity.sessionData,profile);
  if(!seed){assert.equal(identity.name,'Atlantium');assert.equal(identity.partitionPath,results[0].identity.partitionPath);}
  const nativePreferences=JSON.parse(fs.readFileSync(path.join(profile,'window-preferences.json'),'utf8'));assert.equal(nativePreferences.useCustomTitlebar,false);
  results.push({version,profile,identity,data,nativePreferences});fs.writeFileSync(path.join(root,'continuity-results.json'),JSON.stringify(results,null,2));
  await evaluate("(async()=>{const s=process.mainModule.require('electron').BrowserWindow.getAllWindows()[0].webContents.session;s.flushStorageData();await s.cookies.flushStore();return true})()");void evaluate('global.__realExit(0)').catch(()=>{});await delay(100);ws.close();ws=null;await until(()=>active.exitCode!==null);console.log('PASS native isolated',version);
 }finally{if(ws)ws.close();if(active&&active.exitCode===null)active.kill();if(browser)await browser.close().catch(()=>{});fs.closeSync(log);active=null;}
}

(async()=>{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(3900,'127.0.0.1',resolve)});try{await run(path.resolve(baseline),'1.4.0',true);await run(path.resolve(candidate),'1.4.0',false);console.log('Evidence: '+root);}finally{server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
