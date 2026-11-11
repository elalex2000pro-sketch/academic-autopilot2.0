"""Private documents, version history, optimistic writes and draft retries."""
from test_peer_classwork import client
from test_chat_flow import account

BASE = '/api/v1/office/documents'

def test_permissions_history_conflict(client):
    c = client
    a, _, _ = account(c, 'officeowner')
    b, _, _ = account(c, 'officeother')
    data = dict(title='Informe', content='<h1>Álgebra</h1><p><strong>Original</strong></p>', settings={'orientation': 'landscape'})
    r = c.post(BASE, headers=a, json=data)
    assert r.status_code == 201, r.text
    doc = r.json(); path = BASE + '/' + doc['id']
    assert c.get(BASE, headers=b).json() == []
    for suffix in ['', '/versions']:
        assert c.get(path+suffix, headers=b).status_code == 404
    assert c.put(path, headers=b, json={**data, 'revision': 1}).status_code == 404
    assert c.delete(path, headers=b).status_code == 404
    assert c.post(path+'/duplicate', headers=b).status_code == 404
    version = c.get(path+'/versions', headers=a).json()[0]
    assert c.post(path+'/versions/'+version['id']+'/restore', headers=b, json={'revision': 1}).status_code == 404
    updated = {**data, 'content': '<p>Nuevo</p>', 'revision': 1}
    assert c.put(path, headers=a, json=updated).json()['revision'] == 2
    assert c.put(path, headers=a, json=updated).status_code == 409
    assert len(c.get(path+'/versions', headers=a).json()) == 1
    for _ in range(2):
        assert c.post(path+'/checkpoint', headers=a, json={'revision': 2}).status_code == 200
    assert len(c.get(path+'/versions', headers=a).json()) == 2
    restored = c.post(path+'/versions/'+version['id']+'/restore', headers=a, json={'revision': 2})
    assert restored.status_code == 200, restored.text
    assert restored.json()['content'] == data['content']
    assert restored.json()['settings'] == data['settings']
    assert restored.json()['revision'] == 3
    copy = c.post(path+'/duplicate', headers=a).json()
    assert copy['id'] != doc['id'] and copy['content'] == data['content']
    assert len(c.get(BASE+'?q=Informe&order=title', headers=a).json()) == 2
    assert c.delete(path, headers=a).status_code == 204
    assert c.get(BASE+'/'+copy['id'], headers=a).status_code == 200

def test_draft_migration_is_idempotent_and_lossless(client):
    c = client
    a, _, _ = account(c, 'draftowner')
    b, _, _ = account(c, 'draftother')
    data = dict(title='Borrador', content='<h2>Álgebra</h2><p style="color:red"><em>Texto</em></p>', import_key='legacy-1')
    first = c.post(BASE, headers=a, json=data).json()
    second = c.post(BASE, headers=a, json=data).json()
    assert first['id'] == second['id'] and second['content'] == data['content']
    assert len(c.get(BASE, headers=a).json()) == 1
    assert c.post(BASE, headers=b, json=data).json()['id'] != first['id']
    assert c.post(BASE, headers=a, json={'title': 'Grande', 'content': 'x'*(5*1024*1024)}).status_code == 413
    sheet = c.post(BASE, headers=a, json={'title': 'Hoja', 'kind': 'sheet', 'content': '{"A1":"=2+2"}'}).json()
    assert sheet['content'] == '{"A1":"=2+2"}'
