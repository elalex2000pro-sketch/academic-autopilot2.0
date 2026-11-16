const assert=require('node:assert/strict');
const path=require('node:path');
async function verifyGradeGroups(browser,{API,WEB,output,viewport}) {
  assert.equal((await (await fetch(API+'/health')).json()).environment,'isolated-chat-test');
  let token;
  async function api(route,method='GET',data) {
    const r=await fetch(API+'/api/v1'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
    assert.ok(r.ok,route+': '+r.status);return r.status===204?null:r.json();
  }
  token=(await api('/auth/register','POST',{email:`grades-${viewport.width}-${Date.now()}@example.com`,password:'GradesTest123',full_name:'Prueba notas'})).access_token;
  const user=await api('/auth/me');
  for(const theme of ['light','dark']) {
    const course=await api('/courses','POST',{name:'Historia '+theme});
    const old=await api('/grades','POST',{course_id:course.id,title:'Nota antigua',score:8,weight:20});
    await api('/grades','POST',{course_id:course.id,title:'Trabajo',score:5,weight:30,trimester:1,unit:'3'});
    const exam=await api('/grades','POST',{course_id:course.id,title:'Examen final',score:10,weight:50,is_exam:true,graded_at:'2030-05-20'});
    const before=await api('/grades/summary');
    const context=await browser.newContext({viewport,serviceWorkers:'block'});
    await context.addInitScript(({token,user,theme})=>{localStorage.setItem('autopilot_token',token);localStorage.setItem('autopilot_user',JSON.stringify(user));localStorage.setItem('hasCompletedOnboarding_v1','true');localStorage.setItem('academic-autopilot-theme-v18',theme);},{token,user,theme});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try {
      await page.goto(WEB+'/academics');
      await page.getByRole('button').filter({hasText:course.name}).first().click();
      const groups=page.getByRole('region',{name:'Notas por trimestre y unidad'});
      await groups.getByRole('region',{name:'Sin clasificar',exact:true}).waitFor();
      const card=groups.getByRole('article',{name:'Nota antigua',exact:true});
      await card.getByRole('button',{name:'Editar Nota antigua',exact:true}).click();
      await card.getByLabel('Trimestre',{exact:true}).selectOption('2');
      await card.getByLabel('Unidad',{exact:true}).fill('Los romanos');
      await card.getByRole('button',{name:'Guardar nota',exact:true}).click();
      await groups.getByRole('region',{name:'Trimestre 2',exact:true}).getByRole('article',{name:'Nota antigua',exact:true}).waitFor();
      assert.equal((await api('/grades/summary')).overall_average_percent,before.overall_average_percent);
      await groups.getByLabel('Filtrar notas',{exact:true}).selectOption('2');
      assert.equal(await groups.getByRole('article',{name:'Trabajo',exact:true}).count(),0);
      await groups.getByLabel('Filtrar notas',{exact:true}).selectOption('all');
      await groups.getByRole('button',{name:'Editar Examen final',exact:true}).click();
      const dialog=page.getByRole('dialog',{name:'Editar examen',exact:true});
      await dialog.getByLabel('Trimestre',{exact:true}).selectOption('3');
      await dialog.getByLabel('Unidad',{exact:true}).fill('Los romanos');
      await dialog.getByRole('button',{name:'Guardar cambios',exact:true}).click();
      await dialog.waitFor({state:'hidden'});
      const all=await api('/grades');assert.equal(all.find(g=>g.id===exam.id).trimester,3);assert.equal(all.find(g=>g.id===old.id).score,8);
      const form=page.locator('form').filter({has:page.getByRole('button',{name:'Registrar',exact:true})});
      await form.getByPlaceholder('Parcial 1').fill('Nota nueva');
      await form.getByLabel('Nota',{exact:true}).fill('9');
      await form.getByLabel('Trimestre',{exact:true}).selectOption('1');
      const input=form.getByLabel('Unidad',{exact:true});
      const list=await input.getAttribute('list');assert.ok(await page.locator(`[id="${list}"] option[value="3"]`).count());
      await input.fill('3');
      await form.getByRole('button',{name:'Registrar',exact:true}).click();
      await groups.getByRole('article',{name:'Nota nueva',exact:true}).waitFor();
      await groups.scrollIntoViewIfNeeded();
      const box=await groups.boundingBox();assert.ok(box.x>=-1&&box.x+box.width<=viewport.width+1);
      await groups.screenshot({path:path.join(output,`notas-${viewport.width}-${theme}.png`)});
      assert.deepEqual(errors,[]);
      console.log(`PASS notas ${viewport.width} ${theme}: antigua, filtro, examen, sugerencias, alta y medias`);
    } catch(e) {await page.screenshot({path:path.join(output,`grades-failure-${viewport.width}-${theme}.png`),fullPage:true}).catch(()=>{});throw e;}
    finally {await context.close();}
  }
}
module.exports={verifyGradeGroups};
