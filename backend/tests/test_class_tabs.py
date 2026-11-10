from test_peer_classwork import client, setup

def test_replies_pins_and_members(client):
    c=client;a,b,x,base=setup(c)
    first=c.post(base+"/messages",headers=a,json={"content":"Primera"}).json()
    second=c.post(base+"/messages",headers=b,json={"content":"Segunda"}).json()
    reply=c.post(base+"/messages",headers=b,json={"content":"Respuesta","parent_id":first["id"]})
    assert reply.status_code==201,reply.text
    assert reply.json()["parent_id"]==first["id"]
    history=c.get(base+"/messages",headers=a).json()
    assert next(m for m in history if m["id"]==reply.json()["id"])["parent_id"]==first["id"]
    assert c.post(base+"/messages",headers=x,json={"content":"Ajena","parent_id":first["id"]}).status_code==403
    assert c.patch(base+"/messages/"+second["id"],headers=b,json={"pinned":True}).status_code==403
    assert c.patch(base+"/messages/"+second["id"],headers=a,json={"pinned":True}).json()["pinned"]
    members=c.get(base,headers=b).json()["members"]
    assert all(m["username"] for m in members)
    other=c.post("/api/v1/classes",headers=b,json={"name":"Otra"}).json()
    assert c.post("/api/v1/classes/"+other["id"]+"/messages",headers=b,json={"content":"Fuera","parent_id":first["id"]}).status_code==404
    assert c.post(base+"/leave",headers=a).status_code==204
    assert c.get(base,headers=b).json()["my_role"]=="owner"
    assert c.get(base,headers=a).status_code==403
