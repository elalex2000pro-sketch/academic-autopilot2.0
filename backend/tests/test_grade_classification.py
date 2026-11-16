import asyncio
import importlib.util
from pathlib import Path
from uuid import UUID
import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from app.api.v1.grades import _weighted_average
from app.api.deps import get_db
from app.models.user import User
from app.models.enums import Provider
from app.connectors.base import NormalizedCourse, NormalizedTask
from app.services.sync_service import _upsert_courses, _upsert_tasks
from test_chat_flow import account
from test_peer_classwork import client


@pytest.mark.parametrize('pairs,expected', [([],None), ([(80,20),(50,30),(100,50)],81), ([(80,None),(40,20)],60), ([(80,0),(40,0)],60), ([(100,1),(0,2)],33.33)])
def test_previous_average_results_unchanged(pairs,expected):
    assert _weighted_average(pairs)==expected


def legacy(summary):
    return {**summary,'courses':[{k:v for k,v in c.items() if k!='terms'} for c in summary['courses']]}


def test_summary_classification_permissions_and_sync(client):
    owner,profile,_=account(client,'gradesowner')
    other,_,_=account(client,'gradesother')
    course=client.post('/api/v1/courses',headers=owner,json={'name':'Historia'}).json()['id']
    records=[]
    for score,weight in [(8,20),(5,30),(10,50),(None,None)]:
        r=client.post('/api/v1/grades',headers=owner,json={'course_id':course,'title':'Nota '+str(len(records)), 'score':score,'weight':weight,'is_exam':score is None})
        assert r.status_code==201,r.text
        records.append(r.json()); assert r.json()['trimester'] is None and r.json()['unit'] is None
    baseline=client.get('/api/v1/grades/summary',headers=owner).json()
    assert baseline['overall_average_percent']==81
    assert baseline['courses'][0]['terms'][0]['trimester'] is None
    for i,g in enumerate(records):
        r=client.patch('/api/v1/grades/'+g['id'],headers=owner,json={'trimester':1 if i<2 else 2,'unit':'3' if i<2 else 'Los romanos'})
        assert r.status_code==200,r.text
        assert r.json()['is_exam']==g['is_exam']
    result=client.get('/api/v1/grades/summary',headers=owner).json()
    assert legacy(result)==legacy(baseline)
    terms=result['courses'][0]['terms']
    assert terms[0]['average_percent']==62 and terms[0]['units'][0]['average_percent']==62
    assert terms[1]['average_percent']==100 and terms[1]['graded_count']==1
    assert terms[1]['units'][0]['unit']=='Los romanos'
    assert client.patch('/api/v1/grades/'+records[0]['id'],headers=other,json={'trimester':3}).status_code==404
    for value in [0,4,1.5,True]:
        assert client.patch('/api/v1/grades/'+records[0]['id'],headers=owner,json={'trimester':value}).status_code==422
    assert client.patch('/api/v1/grades/'+records[0]['id'],headers=owner,json={'unit':'x'*81}).status_code==422
    before=client.get('/api/v1/grades',headers=owner).json()
    async def sync():
        async for db in client.app.dependency_overrides[get_db]():
            user=await db.get(User,UUID(profile['id']))
            await _upsert_courses(db,user,Provider.moodle,[NormalizedCourse(external_id='moodle1',name='Asignatura importada')])
            await _upsert_tasks(db,user,Provider.moodle,[NormalizedTask(external_id='task1',title='Tarea importada')])
            await db.commit()
    asyncio.run(sync())
    assert client.get('/api/v1/grades',headers=owner).json()==before
    cleared=client.patch('/api/v1/grades/'+records[0]['id'],headers=owner,json={'trimester':None,'unit':None}).json()
    assert cleared['trimester'] is None and cleared['unit'] is None
    assert legacy(client.get('/api/v1/grades/summary',headers=owner).json())==legacy(baseline)


def test_mixed_weights_normalized_per_group(client):
    owner,_,_=account(client,'groupweights')
    for score,weight,term,unit in [(8,None,1,'A'),(4,20,1,'A'),(10,0,2,'B'),(2,0,2,'B'),(None,None,3,'C')]:
        assert client.post('/api/v1/grades',headers=owner,json={'title':'Nota','score':score,'weight':weight,'trimester':term,'unit':unit}).status_code==201
    result=client.get('/api/v1/grades/summary',headers=owner).json()
    assert result['overall_average_percent']==60
    terms=result['courses'][0]['terms']
    assert [t['average_percent'] for t in terms]==[60,60,None]


def test_sqlite_migration_preserves_old_grades(tmp_path,monkeypatch):
    spec=importlib.util.spec_from_file_location('migration28',Path(__file__).parents[1]/'alembic/versions/0028_grade_classification.py')
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    engine=sa.create_engine('sqlite:///'+str(tmp_path/'grades.sqlite'))
    with engine.begin() as c:
        c.execute(sa.text('create table grades (id integer primary key,title text,score real,weight real)'))
        c.execute(sa.text("insert into grades values (1,'Anterior',8,20),(2,'Pendiente',null,null)"))
        before=c.execute(sa.text('select * from grades')).all()
        monkeypatch.setattr(m,'op',Operations(MigrationContext.configure(c)));m.upgrade()
        assert c.execute(sa.text('select id,title,score,weight from grades')).all()==before
        assert c.execute(sa.text('select trimester,unit from grades')).all()==[(None,None),(None,None)]
        c.execute(sa.text("insert into grades (id,title) values (3,'Cliente antiguo')"))
        m.downgrade();assert c.execute(sa.text('select * from grades where id<3')).all()==before
        m.upgrade();assert c.execute(sa.text('select count(*) from grades')).scalar()==3
    engine.dispose()
