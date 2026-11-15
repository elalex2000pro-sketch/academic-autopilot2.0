// Owned production web server + isolated API. No production accounts.
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const API='http://127.0.0.1:8000/api/v1',WEB='http://localhost:3000';
(async()=>{
  assert.equal((await(await fetch('http://127.0.0.1:8000/health')).json()).environment,'isolated-chat-test');
  const output=process.env.TIMETABLE_OUTPUT;assert.ok(output,'Set TIMETABLE_OUTPUT');
  const stage=process.env.TIMETABLE_STAGE||'after';await fs.mkdir(path.join(output,stage),{recursive:true});
  const account=await(await fetch(API+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:`timetable-${Date.now()}@example.com`,password:'TimetableBrowser123',full_name:'Prueba Horario'})})).json();
  const headers={Authorization:'Bearer '+account.access_token,'Content-Type':'application/json'};
  const user=await(await fetch(API+'/auth/me',{headers})).json(),entries=[];
  for(let day=0;day<7;day++){
    const response=await fetch(API+'/timetable',{method:'POST',headers,body:JSON.stringify({day_of_week:day,start_time:'08:00',end_time:'09:00',title:'Asignatura '+day})});
    assert.ok(response.ok);entries.push(await response.json());
  }
  const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
  try{
    for(const width of (process.env.TIMETABLE_WIDTHS?JSON.parse(process.env.TIMETABLE_WIDTHS):[1440,390,600,768,1024]))for(const route of ['/schedule','/planner','/calendar']){
      const context=await browser.newContext({viewport:{width,height:960},serviceWorkers:'block'});
      await context.addInitScript(({token,user,entries})=>{
        localStorage.setItem('autopilot_token',token);localStorage.setItem('autopilot_user',JSON.stringify(user));localStorage.setItem('hasCompletedOnboarding_v1','true');
        if(!localStorage.getItem('customTimetable'))localStorage.setItem('customTimetable',JSON.stringify(entries));
      },{token:account.access_token,user,entries});
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      const key=width+'-'+route.slice(1);
      try{
        await page.goto(WEB+route,{waitUntil:'networkidle'});
        const toggle=page.getByRole('button',{name:/Horario semanal Gestionar clases/});
        if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
        const region=page.getByRole('region',{name:'Horario semanal',exact:true});await region.waitFor();await region.scrollIntoViewIfNeeded();await page.evaluate(()=>document.fonts.ready);
        let shot=await region.screenshot({animations:'disabled'});
        for(let i=0;i<20;i++){await page.waitForTimeout(150);const next=await region.screenshot({animations:'disabled'});if(shot.equals(next))break;shot=next;}
        await fs.writeFile(path.join(output,stage,key+'.png'),shot);
        if(width===390)await page.screenshot({path:path.join(output,stage,key+'-page.png'),animations:'disabled'});
        const metrics=await region.evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth,right:e.getBoundingClientRect().right,page:document.documentElement.scrollWidth,viewport:innerWidth}));
        await fs.writeFile(path.join(output,stage,key+'.json'),JSON.stringify(metrics));
        assert.ok(metrics.right<=width+1,'El horario debe caber dentro de la página');assert.ok(metrics.page<=width+1,'La página no debe ensancharse');
        if(width<=600)assert.ok(metrics.scroll>metrics.client,'Debe existir desbordamiento DENTRO del horario');
        for(const day of [3,4,5,6]){
          const button=page.getByRole('button',{name:new RegExp('^Editar Asignatura '+day+' de')});
          const rect=await button.boundingBox();await region.evaluate((e,x)=>{e.scrollLeft+=x-e.getBoundingClientRect().left-e.clientWidth/2;},rect.x);
          if(width<=600&&day===6)assert.ok(await region.evaluate(e=>e.scrollLeft>0),'Debe desplazarse hasta el último día');
          await button.click({timeout:4000});await page.locator('#planner-class-title').fill('Editado '+day);
          await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
        }
        if(width===390){
          await region.scrollIntoViewIfNeeded();await region.evaluate(e=>{e.scrollLeft=e.scrollWidth;});
          await region.screenshot({path:path.join(output,stage,key+'-last-days.png'),animations:'disabled'});
          await page.screenshot({path:path.join(output,stage,key+'-last-days-page.png'),animations:'disabled'});
        }
        await page.reload({waitUntil:'networkidle'});
        const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('customTimetable')));
        for(const day of [3,4,5,6])assert.ok(saved.some(e=>e.day_of_week===day&&e.title==='Editado '+day));
        assert.deepEqual(errors,[]);results.push({key,status:'passed',metrics});console.log('PASS '+key);
      }catch(error){results.push({key,status:'failed',reason:error.message});console.log('FAIL '+key+': '+error.message.split('\n')[0]);}
      finally{await context.close();}
    }
  }finally{await browser.close();await fs.writeFile(path.join(output,stage,'results.json'),JSON.stringify(results,null,2));}
  assert.ok(results.every(r=>r.status==='passed'),'Horario: revisar results.json y capturas');
})().catch(e=>{console.error(e);process.exitCode=1;});
