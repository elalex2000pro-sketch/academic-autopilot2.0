// Isolated API; external AI is a controlled test provider. All writes use real endpoints.
const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const API='http://127.0.0.1:8000/api/v1',WEB='http://localhost:3000';
(async()=>{
  assert.equal((await(await fetch('http://127.0.0.1:8000/health')).json()).environment,'isolated-chat-test');
  const out=process.env.REVIEW_OUTPUT;assert.ok(out);await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
  try{for(const width of [1440,390]){
    const account=await(await fetch(API+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:`review-${width}-${Date.now()}@example.com`,password:'ReviewBrowser123',full_name:'Prueba Repaso'})})).json();
    const headers={Authorization:'Bearer '+account.access_token,'Content-Type':'application/json'};
    async function request(route,body,method='POST'){const r=await fetch(API+route,{method,headers,...(body?{body:JSON.stringify(body)}:{})});assert.ok(r.ok,route+': '+r.status);return r.status===204?null:r.json();}
    const user=await request('/auth/me',null,'GET');
    for(const kind of ['notes','attached','missing-ai','empty']){
      await request('/assistant/profile',{provider:kind==='missing-ai'?'gemini':'local',api_key:'',model:'test',base_url:kind==='missing-ai'?'':'http://example.invalid/v1'},'PUT');
      const note=await request('/notebooks',{title:kind,content:kind==='attached'||kind==='empty'?'':'La mitocondria produce ATP mediante respiración celular.'});
      if(kind==='attached'){
        const form=new FormData();form.set('file',new Blob(['La mitocondria produce ATP mediante respiración celular.'],{type:'text/plain'}),'celulas.txt');
        const r=await fetch(API+'/files',{method:'POST',headers:{Authorization:headers.Authorization},body:form});assert.ok(r.ok);const file=await r.json();await request('/notebooks/'+note.id+'/sources',{document_id:file.id});
      }
      const c=await browser.newContext({viewport:{width,height:960},serviceWorkers:'block'});await c.addInitScript(({token,user})=>{localStorage.setItem('autopilot_token',token);localStorage.setItem('autopilot_user',JSON.stringify(user));localStorage.setItem('hasCompletedOnboarding_v1','true');},{token:account.access_token,user});
      const page=await c.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      page.on('request',r=>{if(r.method()==='POST'&&(/\/api\/v1\/files(?:\/|$)/.test(r.url())||r.url().endsWith('/sources')))errors.push('No debe subir archivos ni crear fuentes implícitamente');});
      try{
        await page.goto(WEB+'/review?notebook='+note.id,{waitUntil:'networkidle'});await page.getByLabel('Pregunta al cuaderno',{exact:true}).waitFor();
        await page.getByLabel('Pregunta al cuaderno',{exact:true}).fill('¿Qué produce la mitocondria?');
        const send=page.getByRole('button',{name:'Enviar pregunta',exact:true});
        if(kind==='empty'){
          assert.equal(await send.isEnabled(),false);await page.getByText('Escribe apuntes en el cuaderno o añade una fuente para empezar.',{exact:true}).waitFor({timeout:4000});
        }else{
          assert.equal(await send.isEnabled(),true,'Chat debe aceptar los apuntes o la fuente');await send.click();
          if(kind==='missing-ai'){
            await page.getByText('Para usar Chat y Studio, abre Ajustes y configura tu modelo y, si lo necesita, su clave de IA.',{exact:true}).waitFor({timeout:4000});
            if(width<1024)await page.getByRole('button',{name:'Studio',exact:true}).click();
            const response=page.waitForResponse(r=>r.url().endsWith('/notebooks/'+note.id+'/chat')&&r.request().method()==='POST');
            await page.getByRole('button',{name:'Tarjetas',exact:true}).click();const result=await(await response).json();
            assert.ok(result.answer.includes('Ajustes'));assert.equal(result.actions.length,0);
            await page.getByText('Para usar Chat y Studio, abre Ajustes y configura tu modelo y, si lo necesita, su clave de IA.',{exact:true}).first().waitFor();
          }
          else{
            await page.getByText('Produce ATP',{exact:false}).first().waitFor({timeout:8000});
            for(const [label,endpoint] of [['Tarjetas','/flashcards'],['Cuestionario','/quizzes'],['Resumen','/notebooks/'+note.id]]){
              if(width<1024)await page.getByRole('button',{name:'Studio',exact:true}).click();
              await page.getByRole('button',{name:label,exact:true}).click();
              const end=Date.now()+10000;let found=false;
              while(Date.now()<end){const data=await request(endpoint,null,'GET');found=Array.isArray(data)?data.some(x=>x.notebook_id===note.id):data.content.includes('## Energía');if(found)break;await page.waitForTimeout(100);}
              assert.ok(found,label+' debe guardarse en la API');await page.getByText('Material guardado',{exact:false}).first().waitFor();
            }
            assert.equal((await request('/notebooks/'+note.id+'/sources',null,'GET')).length,kind==='notes'?0:1);
          }
        }
        assert.deepEqual(errors,[]);results.push({width,kind,status:'passed'});console.log('PASS',width,kind);
      }catch(error){results.push({width,kind,status:'failed',reason:error.message});console.log('FAIL',width,kind,error.message.split('\n')[0]);}
      finally{await page.screenshot({path:path.join(out,width+'-'+kind+'.png'),animations:'disabled'});await c.close();}
    }
  }}finally{await browser.close();await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));}
  assert.ok(results.every(r=>r.status==='passed'),'Revisar results.json');
})().catch(e=>{console.error(e);process.exitCode=1;});
