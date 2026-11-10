"""Notebook grounding, real writes, audit and shared-access boundaries."""
import asyncio
import json
import uuid

from test_peer_classwork import client, setup
from app.db.session import get_db
from app.models.book import Book, BookSection
from app.models.notebook import NotebookSource
from app.services import ai_service, notebook_ai


def seed(c, owner):
    notebook = c.post('/api/v1/notebooks', headers=owner, json={'title':'Biología'}).json()
    async def insert():
        async for db in c.app.dependency_overrides[get_db]():
            book = Book(user_id=uuid.UUID(c.get('/api/v1/auth/me',headers=owner).json()['id']), title='Células', source_filename='celulas.pdf', status='ready', format='pdf', size_bytes=400)
            db.add(book); await db.flush()
            db.add(BookSection(book_id=book.id,section_index=0,title='Página 7',content='La mitocondria produce ATP mediante respiración celular.', page_start=7,page_end=7))
            source=NotebookSource(notebook_id=uuid.UUID(notebook['id']),book_id=book.id,added_by=book.user_id)
            db.add(source); await db.commit()
            return str(source.id)
    return '/api/v1/notebooks/'+notebook['id'], asyncio.run(insert())


def fake(monkeypatch, data):
    async def post(*args): return {'content':json.dumps(data)}
    monkeypatch.setattr(ai_service,'_post_chat',post)


def test_citations_abstention_and_permissions(client, monkeypatch):
    c=client; a,b,x,base=setup(c); path,source=seed(c,a)
    fake(monkeypatch,{'supported':True,'answer':'La mitocondria produce ATP [1].'})
    payload={'question':'¿Qué produce la mitocondria?','source_ids':[source]}
    r=c.post(path+'/chat',headers=a,json=payload)
    assert r.status_code==200,r.text
    citation=r.json()['citations'][0]
    assert citation['source_id']==source and citation['page']==7
    assert citation['fragment']=='La mitocondria produce ATP mediante respiración celular.'
    assert c.post(path+'/chat',headers=x,json=payload).status_code==404
    assert c.post(path+'/chat',headers=a,json={**payload,'source_ids':[str(uuid.uuid4())]}).status_code==404
    fake(monkeypatch,{'supported':False,'answer':'No está en las fuentes'})
    assert c.post(path+'/chat',headers=a,json=payload).json()['answer']==notebook_ai.NO_ANSWER
    fake(monkeypatch,{'supported':True,'answer':'Inventado [99]'})
    assert c.post(path+'/chat',headers=a,json=payload).json()['answer']==notebook_ai.NO_ANSWER
    fake(monkeypatch,{'supported':True,'answer':'He creado tarjetas [1]'})
    assert c.post(path+'/chat',headers=a,json=payload).json()['answer']==notebook_ai.NO_ANSWER
    c.put(path+'/share',headers=a,json={'class_id':base.split('/')[-1],'permission':'read'})
    assert c.post(path+'/chat',headers=b,json=payload).status_code==200
    assert len(c.get(path+'/messages',headers=b).json())==2
    assert c.get(path+'/messages',headers=x).status_code==404
    assert c.post(path+'/chat',headers=a,json={**payload,'source_ids':[]}).json()['answer']==notebook_ai.NO_ANSWER


def test_real_tools_fallback_dedup_and_honest_failure(client,monkeypatch):
    c=client;a,b,x,base=setup(c);path,source=seed(c,a)
    payload={'question':'Crea material sobre la mitocondria','source_ids':[source]}
    args={'cards':[{'front':'¿Qué produce la mitocondria?','back':'ATP [1]'}]}
    fake(monkeypatch,{'actions':[{'tool':'create_flashcards','arguments':args}]})
    r=c.post(path+'/chat',headers=a,json=payload).json()
    assert r['actions'][0]['ok'] and r['actions'][0]['count']==1,r
    cards=c.get('/api/v1/flashcards',headers=a).json()
    assert any(f['id']==r['actions'][0]['ids'][0] for f in cards)
    again=c.post(path+'/chat',headers=a,json=payload).json()
    assert again['actions'][0]['reused']
    assert again['state']['counts']['flashcards']==1
    fake(monkeypatch,{'actions':[{'tool':'create_quiz','arguments':{'title':'Células','questions':[{'question':'¿Producto?','options':['ATP','Oro'],'answer':0,'explanation':'ATP [1]'}]}}]})
    quiz=c.post(path+'/chat',headers=a,json=payload).json()
    assert quiz['actions'][0]['ok'],quiz
    fake(monkeypatch,{'actions':[{'tool':'create_summary','arguments':{'title':'Energía','content':'Produce ATP [1]'}}]})
    assert c.post(path+'/chat',headers=a,json=payload).json()['actions'][0]['ok']
    assert 'Produce ATP [1]' in c.get(path,headers=a).json()['content']
    c.put(path+'/share',headers=a,json={'class_id':base.split('/')[-1],'permission':'read'})
    failed=c.post(path+'/chat',headers=b,json=payload).json()
    assert not failed['actions'][0]['ok'] and 'No se ha creado' in failed['answer']
    fake(monkeypatch,{'actions':[{'tool':'create_flashcards','arguments':{'cards':[{'front':'Inválida','back':'sin cita'}]}}]})
    bad=c.post(path+'/chat',headers=a,json=payload).json()
    assert not bad['actions'][0]['ok'] and 'No se ha creado' in bad['answer']


def test_native_loop_and_failure(client,monkeypatch):
    c=client;a,_,_,_=setup(c);path,source=seed(c,a)
    calls=[]
    async def post(profile,messages,model,tools):
        calls.append(messages.copy())
        if len(calls)==1:
            return {'role':'assistant','content':'', 'tool_calls':[{'id':'call1','type':'function','function':{'name':'create_flashcards','arguments':json.dumps({'cards':[{'front':'ATP','back':'Respiración [1]'}]})}}]}
        return {'content':json.dumps({'supported':True,'answer':'He creado 50 tarjetas [1]'})}
    monkeypatch.setattr(ai_service,'_post_chat',post)
    result=c.post(path+'/chat',headers=a,json={'question':'Crea tarjetas','source_ids':[source]}).json()
    assert result['actions'][0]['count']==1 and '50' not in result['answer']
    assert calls[1][-1]['role']=='tool'


def test_retrieval_visits_tail_and_budget():
    chunks=notebook_ai.fragments('Inicio neutro. '*10000+'xilófono singular',{'source_id':'s','title':'Libro','page':1})
    citations,context=notebook_ai.retrieve(chunks,'xilófono',1500)
    assert 'xilófono' in citations[0]['fragment'] and len(context)<=1500



def test_bulk_failure_rolls_back_all_cards(client, monkeypatch):
    c=client;a,_,_,_=setup(c);path,source=seed(c,a)
    fake(monkeypatch,{'actions':[{'tool':'create_flashcards','arguments':{'cards':[{'front':'ATP','back':'Respiración [1]'}, {'front':'Inválida','back':'Sin cita'}]}}]})
    r=c.post(path+'/chat',headers=a,json={'question':'Crea tarjetas','source_ids':[source]}).json()
    assert r['actions'][0]['ok'] is False
    assert c.get('/api/v1/flashcards',headers=a).json()==[]
    assert 'No se ha creado' in r['answer']


def test_provider_without_tools_retries_json(monkeypatch):
    import httpx
    from types import SimpleNamespace
    requests=[]
    def handle(request):
        body=json.loads(request.content); requests.append(body)
        if 'tools' in body: return httpx.Response(400,json={'error':'tools unsupported'})
        return httpx.Response(200,json={'choices':[{'message':{'content':'{"actions":[]}'}}]})
    original=httpx.AsyncClient
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kwargs: original(transport=httpx.MockTransport(handle),**kwargs))
    profile=SimpleNamespace(base_url='https://example.invalid/v1',api_key='',temperature=0,timeout_seconds=5)
    result=asyncio.run(ai_service._post_chat(profile,[{'role':'user','content':'JSON'}],'test',notebook_ai.tool_schemas()))
    assert len(requests)==2 and 'tools' not in requests[1]
    assert json.loads(result['content'])=={'actions':[]}
