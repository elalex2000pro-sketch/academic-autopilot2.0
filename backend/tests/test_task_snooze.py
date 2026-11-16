"""Recordatorios por dia local, sin modificar el plazo ni el sync."""
import asyncio
import importlib.util
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from app.api.deps import get_db
from app.api.v1 import tasks as tasks_api
from app.connectors.base import NormalizedTask
from app.models.task import Task
from app.models.user import User
from app.models.enums import Provider, SourcePlatform
from app.services import sync_service
from test_chat_flow import account
from test_peer_classwork import client


class Clock(datetime):
    instant = datetime(2030, 3, 30, 10, tzinfo=timezone.utc)
    @classmethod
    def now(cls, tz=None):
        return cls.instant.astimezone(tz) if tz else cls.instant.replace(tzinfo=None)


@pytest.fixture
def setup(client, monkeypatch):
    Clock.instant = datetime(2030, 3, 30, 10, tzinfo=timezone.utc)
    monkeypatch.setattr(tasks_api, "datetime", Clock)
    owner, profile, _ = account(client, "snoozer")
    def create(title="Vencida", due="2030-03-28T12:00:00Z"):
        r = client.post('/api/v1/tasks', headers=owner, json={'title':title,'due_at':due})
        assert r.status_code == 201, r.text
        return r.json()
    return owner, profile, create


def test_snooze_due_date_expiry_daily_claim_and_delivery(client, setup):
    owner, _, create = setup
    task = create(); path='/api/v1/tasks/'+task['id']
    r=client.put(path+'/snooze', headers=owner,json={'until':'2030-03-31'})
    assert r.status_code==200, r.text
    assert r.json()['due_at']==task['due_at']
    assert datetime.fromisoformat(r.json()['snoozed_until']).astimezone(tasks_api.REMINDER_ZONE).date().isoformat()=='2030-03-31'
    assert client.post('/api/v1/tasks/overdue-prompts',headers=owner).json()['tasks']==[]
    Clock.instant=datetime(2030,3,31,22,30,tzinfo=timezone.utc) # ya es 1 de abril en Madrid
    claimed=client.post('/api/v1/tasks/overdue-prompts',headers=owner).json()['tasks']
    assert [t['id'] for t in claimed]==[task['id']]
    assert client.post('/api/v1/tasks/overdue-prompts',headers=owner).json()['tasks']==[]
    Clock.instant=datetime(2030,4,1,22,30,tzinfo=timezone.utc)
    assert len(client.post('/api/v1/tasks/overdue-prompts',headers=owner).json()['tasks'])==1
    declared=client.post(path+'/delivery',headers=owner,json={}).json()
    assert declared['status']=='completed' and declared['delivery_status']=='declared'
    Clock.instant=datetime(2030,4,2,22,30,tzinfo=timezone.utc)
    assert client.post('/api/v1/tasks/overdue-prompts',headers=owner).json()['tasks']==[]
    assert client.delete(path+'/delivery',headers=owner).json()['status']=='pending'
    assert client.put(path+'/snooze',headers=owner,json={'until':None}).json()['snoozed_until'] is None
    assert client.get(path,headers=owner).json()['due_at']==task['due_at']


def test_limits_permissions_and_local_day(client, setup):
    owner, _, create=setup
    today=create('Todavia hoy','2030-03-30T00:00:00Z')
    done=create('Completada'); client.post('/api/v1/tasks/'+done['id']+'/complete',headers=owner)
    archived=create('Archivada'); client.delete('/api/v1/tasks/'+archived['id'],headers=owner)
    for i in range(8): create('Pendiente '+str(i))
    r=client.post('/api/v1/tasks/overdue-prompts',headers=owner)
    assert r.status_code==200,r.text
    assert len(r.json()['tasks'])==5 and r.json()['remaining']==3
    assert today['id'] not in [t['id'] for t in r.json()['tasks']]
    assert client.post('/api/v1/tasks/overdue-prompts',headers=owner).json()['tasks']==[]
    other,_,_=account(client,'snoozeother')
    path='/api/v1/tasks/'+today['id']+'/snooze'
    assert client.put(path,headers=other,json={'until':'2030-04-01'}).status_code==404
    assert client.put(path,headers=owner,json={'until':'2030-03-30'}).status_code==422


@pytest.mark.parametrize('day,utc', [('2030-03-31','2030-03-30T23:00:00+00:00'),('2030-04-01','2030-03-31T22:00:00+00:00'),('2030-10-28','2030-10-27T23:00:00+00:00')])
def test_dst_midnight(client,setup,day,utc):
    owner,_,create=setup
    task=create()
    r=client.put('/api/v1/tasks/'+task['id']+'/snooze',headers=owner,json={'until':day})
    assert datetime.fromisoformat(r.json()['snoozed_until'])==datetime.fromisoformat(utc)


def test_sync_does_not_overwrite_snooze(client,setup):
    owner,profile,create=setup
    task=create(); path='/api/v1/tasks/'+task['id']
    saved=client.put(path+'/snooze',headers=owner,json={'until':'2030-04-05'}).json()
    async def sync():
        async for db in client.app.dependency_overrides[get_db]():
            current=await db.get(Task,UUID(task['id'])); current.source=SourcePlatform.moodle
            await db.commit()
            user=await db.get(User,UUID(profile['id']))
            await sync_service._upsert_tasks(db,user,Provider.moodle,[NormalizedTask(external_id=current.external_id,title=current.title,due_at=current.due_at,completed=False,completion_known=False)])
            await db.commit()
    asyncio.run(sync())
    actual=client.get(path,headers=owner).json()
    assert actual['snoozed_until']==saved['snoozed_until'] and actual['due_at']==task['due_at']


def test_sqlite_additive_migration(tmp_path,monkeypatch):
    spec=importlib.util.spec_from_file_location('migration27',Path(__file__).parents[1]/'alembic/versions/0027_task_snooze.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    engine=sa.create_engine('sqlite:///'+str(tmp_path/'migration27.sqlite'))
    with engine.begin() as c:
        c.execute(sa.text('create table tasks (id integer primary key, title text, due_at text, status text)'))
        c.execute(sa.text("insert into tasks values (1,'Anterior','2030-01-01','pending'),(2,'Completada',null,'completed')"))
        before=c.execute(sa.text('select * from tasks')).all()
        monkeypatch.setattr(module,'op',Operations(MigrationContext.configure(c)))
        module.upgrade()
        assert c.execute(sa.text('select id,title,due_at,status from tasks')).all()==before
        assert c.execute(sa.text('select snoozed_until,overdue_prompted_on from tasks')).all()==[(None,None),(None,None)]
        c.execute(sa.text("insert into tasks (id,title,status) values (3,'Cliente anterior','pending')"))
        module.downgrade()
        assert c.execute(sa.text('select * from tasks where id<3')).all()==before
    engine.dispose()
