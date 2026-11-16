const assert=require('node:assert/strict');
const path=require('node:path');
async function verifyTaskSnooze(browser,{API,WEB,output,viewport}) {
  assert.equal((await (await fetch(API+'/health')).json()).environment,'isolated-chat-test');
  let token;
  async function api(route,method='GET',data) {
    const r=await fetch(API+'/api/v1'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
    assert.ok(r.ok,route+': '+r.status);return r.status===204?null:r.json();
  }
  token=(await api('/auth/register','POST',{email:`snooze-${viewport.width}-${Date.now()}@example.com`,password:'SnoozeTest123',full_name:'Prueba aplazamiento'})).access_token;
  const user=await api('/auth/me');
  for(const theme of ['light','dark']) {
    const a=await api('/tasks','POST',{title:`Aplazar ${theme}`,due_at:'2020-01-01T12:00:00Z'});
    const b=await api('/tasks','POST',{title:`Entregar ${theme}`,due_at:'2020-01-02T12:00:00Z'});
    const context=await browser.newContext({viewport,timezoneId:'Europe/Madrid',serviceWorkers:'block'});
    await context.addInitScript(({token,user,theme})=>{localStorage.setItem('autopilot_token',token);localStorage.setItem('autopilot_user',JSON.stringify(user));localStorage.setItem('hasCompletedOnboarding_v1','true');localStorage.setItem('academic-autopilot-theme-v18',theme);},{token,user,theme});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try {
      await page.goto(WEB+'/');
      const dialog=page.getByRole('dialog',{name:'Tareas que han pasado de fecha'});
      await dialog.waitFor();assert.equal(await page.locator('dialog[open]').count(),1);
      const card=dialog.getByRole('article',{name:a.title,exact:true});
      await card.getByRole('button',{name:'Mañana',exact:true}).click();
      await card.getByText('Aplazada hasta',{exact:false}).waitFor();
      assert.equal((await api('/tasks/'+a.id)).due_at,a.due_at);
      await card.getByRole('button',{name:'Deshacer aplazamiento',exact:true}).click();
      await card.getByRole('button',{name:'Deshacer aplazamiento',exact:true}).waitFor({state:'hidden'});
      await card.getByRole('button',{name:'En 3 días',exact:true}).click();
      await card.getByRole('button',{name:'Deshacer aplazamiento',exact:true}).waitFor();
      const delivery=dialog.getByRole('article',{name:b.title,exact:true});
      await delivery.getByRole('button',{name:'Ya la entregué',exact:true}).click();
      await delivery.getByText('Entregada (marcada por ti)',{exact:true}).waitFor();
      assert.equal((await api('/tasks/'+b.id)).status,'completed');
      await delivery.getByRole('button',{name:'Deshacer entrega',exact:true}).click();
      await delivery.getByRole('button',{name:'Ya la entregué',exact:true}).waitFor();
      assert.equal((await api('/tasks/'+b.id)).status,'pending');
      const box=await dialog.boundingBox();assert.ok(box.x>=0 && box.x+box.width<=viewport.width+1);
      await page.screenshot({path:path.join(output,`aplazar-${viewport.width}-${theme}.png`)});
      await delivery.getByRole('button',{name:'Ahora no',exact:true}).click();
      await dialog.getByRole('button',{name:'Cerrar · Ahora no (todas)',exact:true}).click();
      const response=page.waitForResponse(r=>r.url().endsWith('/api/v1/tasks/overdue-prompts'));
      await page.reload();await response;
      await page.waitForTimeout(300);
      assert.equal(await page.locator('dialog[open]').count(),0);
      assert.deepEqual((await api('/tasks/overdue-prompts','POST')).tasks,[]);
      await page.getByRole('button',{name:/Historial \/ Vencidas/}).click();
      const task=page.getByRole('article',{name:a.title,exact:true});
      await task.locator('button').filter({hasText:a.title}).first().click();
      await task.getByRole('button',{name:'En 1 semana',exact:true}).click();
      await task.getByText('Aplazada hasta',{exact:false}).first().waitFor();
      assert.match(await task.innerText(),/Vencida/);
      const chosen=new Date(Date.now()+10*86400000).toISOString().slice(0,10);
      await task.getByLabel('Fecha para aplazar '+a.title,{exact:true}).fill(chosen);
      await task.getByRole('button',{name:'Elegir fecha',exact:true}).click();
      await task.getByText(chosen.split('-').reverse().join('/'),{exact:false}).first().waitFor();
      assert.equal((await api('/tasks/'+a.id)).due_at,a.due_at);
      assert.deepEqual(errors,[]);
      console.log(`PASS aplazar ${viewport.width} ${theme}: dialogo unico, fechas, deshacer, entrega, limite diario y menu`);
    } catch(e) {await page.screenshot({path:path.join(output,`snooze-failure-${viewport.width}-${theme}.png`)}).catch(()=>{});throw e;}
    finally {await context.close();}
  }
}
module.exports={verifyTaskSnooze};
