"""Acceptance tests for the actual shared API; all clients use independent cookies."""
import importlib
import copy
import pytest
from fastapi.testclient import TestClient

HEAD = {'X-Requested-With': 'DeclarationDashboard'}
PASSWORD = 'test-password-very-long-92'

@pytest.fixture
def env(tmp_path):
    app_module = importlib.import_module('app')
    app = app_module.create_app(str(tmp_path), setup_code='setup-test-code', secure_cookie=False)
    owner = TestClient(app)
    r = owner.post('/api/setup', json={'code': 'setup-test-code', 'username': 'maxim', 'name': 'Максим', 'password': PASSWORD}, headers=HEAD)
    assert r.status_code == 200, r.text
    csrf = owner.get('/api/session').json()['csrf']
    headers = dict(HEAD, **{'X-CSRF-Token': csrf})
    return app, owner, headers, tmp_path

def guest(env):
    app, owner, headers, _ = env
    invite = owner.post('/api/invites', json={'name':'Участник'}, headers=headers)
    assert invite.status_code == 200, invite.text
    token = invite.json()['token']
    client = TestClient(app)
    result = client.post('/api/join', json={'token':token, 'username':'friend', 'name':'Друг', 'password':PASSWORD}, headers=HEAD)
    assert result.status_code == 200, result.text
    csrf = client.get('/api/session').json()['csrf']
    return client, dict(HEAD, **{'X-CSRF-Token':csrf}), token

def test_private_board_requires_login(env):
    assert TestClient(env[0]).get('/api/board').status_code == 401

def test_initial_board_exact_signed_source_and_no_progress(env):
    board = env[1].get('/api/board').json()
    assert len(board['declaration']['goals']) == 6
    assert board['declaration']['deadline'] == '2026-10-31'
    assert board['declaration']['signedAt'] == '2026-08-15'
    assert sum(len(x['steps']) for x in board['declaration']['goals']) == 24
    assert board['history'] == []
    assert board['version'] == 0
    assert not any(any(x['steps'].values()) for x in board['state']['goals'].values())

def test_owner_can_save_and_revision_is_checked(env):
    app, owner, headers, _ = env
    board = owner.get('/api/board').json()
    board['state']['goals']['g1']['steps']['g1s1'] = True
    out = owner.put('/api/board', json={'version':0,'state':board['state']}, headers=headers)
    assert out.status_code == 200, out.text
    assert out.json()['version'] == 1
    assert len(out.json()['history']) == 1
    conflict = owner.put('/api/board', json={'version':0,'state':board['state']}, headers=headers)
    assert conflict.status_code == 409

def test_noop_does_not_invent_progress_history(env):
    _, owner, headers, _ = env
    b = owner.get('/api/board').json()
    r = owner.put('/api/board', json={'version':0,'state':b['state']}, headers=headers)
    assert r.status_code == 200
    assert r.json()['version'] == 0
    assert r.json()['history'] == []

def test_csrf_is_enforced(env):
    _, owner, _, _ = env
    b = owner.get('/api/board').json()
    assert owner.put('/api/board', json={'version':0,'state':b['state']}, headers=HEAD).status_code == 403

def test_cross_origin_write_is_forbidden(env):
    _, owner, headers, _ = env
    assert owner.post('/api/invites', json={'name':'x'}, headers={**headers,'Origin':'https://evil.invalid'}).status_code == 403

def test_guest_reads_and_comments_but_cannot_edit(env):
    g, headers, _ = guest(env)
    b = g.get('/api/board').json()
    assert b['user']['role'] == 'member'
    assert g.put('/api/board', json={'version':0,'state':b['state']}, headers=headers).status_code == 403
    assert g.post('/api/invites', json={'name':'x'}, headers=headers).status_code == 403
    assert g.post('/api/comments', json={'goalId':'g1','text':'Согласуем контрольную точку.'}, headers=headers).status_code == 200
    assert len(env[1].get('/api/board').json()['comments']) == 1

def test_invite_is_single_use(env):
    _, _, token = guest(env)
    r = TestClient(env[0]).post('/api/join', json={'token':token,'username':'second','name':'Second','password':PASSWORD}, headers=HEAD)
    assert r.status_code == 400

def test_no_public_registration_without_invite(env):
    r = TestClient(env[0]).post('/api/join', json={'token':'wrong','username':'stranger','name':'Stranger','password':PASSWORD}, headers=HEAD)
    assert r.status_code == 400

def test_owner_setup_cannot_repeat(env):
    r = TestClient(env[0]).post('/api/setup', json={'code':'setup-test-code','username':'attacker','name':'attacker','password':PASSWORD}, headers=HEAD)
    assert r.status_code == 409

def test_revoked_member_loses_existing_session(env):
    g, gh, _ = guest(env)
    uid = g.get('/api/session').json()['user']['id']
    r = env[1].delete('/api/members/'+str(uid), json={}, headers=env[2]) if False else env[1].request('DELETE','/api/members/'+str(uid), json={}, headers=env[2])
    assert r.status_code == 200
    assert g.get('/api/board').status_code == 401

def test_private_wheel_not_returned_to_guest(env):
    _, owner, headers, _ = env
    b = owner.get('/api/board').json()
    b['state']['wheel']['ratings']['work'] = 7
    b['state']['wheel']['reflection'] = 'Личная оценка, не для группы'
    owner.put('/api/board', json={'version':0,'state':b['state']}, headers=headers)
    g, _, _ = guest(env)
    assert g.get('/api/board').json()['state']['wheel'] is None
    assert 'Личная оценка' not in g.get('/api/board').text

def test_invalid_foreign_keys_rejected(env):
    _, owner, headers, _ = env
    b = owner.get('/api/board').json()
    b['state']['goals']['fake'] = {}
    assert owner.put('/api/board', json={'version':0,'state':b['state']}, headers=headers).status_code == 400

def test_invalid_dates_and_non_boolean_steps_rejected(env):
    _, owner, headers, _ = env
    b = owner.get('/api/board').json()
    b['state']['goals']['g1']['dates']['g1s1'] = '2026-02-30'
    assert owner.put('/api/board', json={'version':0,'state':b['state']}, headers=headers).status_code == 400
    b['state']['goals']['g1']['dates']['g1s1'] = ''
    b['state']['goals']['g1']['steps']['g1s1'] = 'true'
    assert owner.put('/api/board', json={'version':0,'state':b['state']}, headers=headers).status_code == 400

def test_unsafe_proof_url_rejected(env):
    _, owner, headers, _ = env
    b = owner.get('/api/board').json()
    b['state']['goals']['g1']['proofUrl'] = 'javascript:alert(1)'
    assert owner.put('/api/board', json={'version':0,'state':b['state']}, headers=headers).status_code == 400

def test_actual_completion_date_not_invented(env):
    _, owner, headers, _ = env
    b = owner.get('/api/board').json()
    b['state']['goals']['g5']['criteria']['g5c1'] = True
    r = owner.put('/api/board', json={'version':0,'state':b['state']}, headers=headers)
    assert r.status_code == 200
    assert r.json()['state']['goals']['g5']['completedAt']
    b = r.json()
    b['state']['goals']['g5']['criteria']['g5c1'] = False
    r = owner.put('/api/board', json={'version':b['version'],'state':b['state']}, headers=headers)
    assert r.json()['state']['goals']['g5']['completedAt'] is None

def test_persistence_across_app_restart(env):
    _, owner, headers, path = env
    b = owner.get('/api/board').json()
    b['state']['goals']['g1']['steps']['g1s1'] = True
    owner.put('/api/board', json={'version':0,'state':b['state']}, headers=headers)
    newapp = importlib.import_module('app').create_app(str(path), setup_code='different', secure_cookie=False)
    c = TestClient(newapp)
    r = c.post('/api/login', json={'username':'maxim','password':PASSWORD}, headers=HEAD)
    assert r.status_code == 200
    assert c.get('/api/board').json()['state']['goals']['g1']['steps']['g1s1'] is True

def test_no_guest_export_of_owner_private_state(env):
    g, _, _ = guest(env)
    assert g.get('/api/export').status_code == 403

def test_logout_invalidates_session(env):
    _, owner, headers, _ = env
    assert owner.post('/api/logout', json={}, headers=headers).status_code == 200
    assert owner.get('/api/board').status_code == 401

def test_bad_login_generic_failure(env):
    r = TestClient(env[0]).post('/api/login', json={'username':'maxim','password':'wrong'}, headers=HEAD)
    assert r.status_code == 401
    assert 'password_hash' not in r.text

def test_comment_validation(env):
    _, owner, headers, _ = env
    assert owner.post('/api/comments', json={'goalId':'g1','text':'   '}, headers=headers).status_code == 400
    assert owner.post('/api/comments', json={'goalId':'not-real','text':'Test'}, headers=headers).status_code == 400
    assert owner.post('/api/comments', json={'goalId':'g1','text':'x'*2001}, headers=headers).status_code == 400

def test_html_security_headers(env):
    r = env[1].get('/')
    assert r.headers['x-content-type-options'] == 'nosniff'
    assert "frame-ancestors 'none'" in r.headers['content-security-policy']
    assert r.headers['referrer-policy'] == 'no-referrer'
