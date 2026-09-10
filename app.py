"""Private declaration dashboard API. Run behind HTTPS with a persistent data directory."""
import copy
import json
import os
import re
import secrets
import hmac
import time
import sqlite3
from pathlib import Path
from urllib.parse import urlsplit
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from model import DECLARATION, validate_state, event_summary, metrics, now
from storage import Store, digest, password_hash, password_matches

ROOT=Path(__file__).parent

def create_app(data_dir=None,setup_code=None,secure_cookie=None):
    store=Store(data_dir or os.getenv('DATA_DIR',str(ROOT/'data')))
    app=FastAPI(docs_url=None,redoc_url=None,openapi_url=None)
    app.state.store=store
    secure_cookie = (os.getenv('COOKIE_SECURE','1')=='1') if secure_cookie is None else secure_cookie
    public_url=os.getenv('PUBLIC_URL','').rstrip('/')
    code=setup_code or os.getenv('SETUP_CODE')
    with store.connect() as db:
        saved=db.execute("SELECT value FROM config WHERE key='setup'").fetchone()
        if not saved:
            code=code or secrets.token_urlsafe(24)
            db.execute("INSERT INTO config(key,value) VALUES('setup',?)",(digest(code),))
            if not setup_code and not os.getenv('SETUP_CODE'):
                print('Код первичной настройки (сохраните приватно): '+code,flush=True)

    @app.middleware('http')
    async def protection(request: Request,call_next):
        if request.method in ('POST','PUT','DELETE','PATCH'):
            if request.headers.get('X-Requested-With')!='DeclarationDashboard':
                return JSONResponse({'detail':'Запрос отклонён.'},403)
            origin=request.headers.get('origin')
            allowed=public_url or str(request.base_url).rstrip('/')
            if origin and origin.rstrip('/')!=allowed:
                return JSONResponse({'detail':'Межсайтовый запрос отклонён.'},403)
            if 'application/json' not in request.headers.get('content-type',''):
                return JSONResponse({'detail':'Требуется JSON.'},415)
            try:
                if int(request.headers.get('content-length','0'))>65536: return JSONResponse({'detail':'Запрос слишком большой.'},413)
            except ValueError: return JSONResponse({'detail':'Некорректный запрос.'},400)
            if len(await request.body())>65536: return JSONResponse({'detail':'Запрос слишком большой.'},413)
        response=await call_next(request)
        response.headers['Cache-Control']='no-store'
        response.headers['X-Content-Type-Options']='nosniff'
        response.headers['X-Frame-Options']='DENY'
        response.headers['Referrer-Policy']='no-referrer'
        response.headers['Permissions-Policy']='camera=(), microphone=(), geolocation=()'
        response.headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
        if secure_cookie: response.headers['Strict-Transport-Security']='max-age=31536000'
        return response

    def limit(request,kind,maximum=12,seconds=600):
        ip=request.client.host if request.client else 'unknown'
        if store.limited(kind+':'+ip,maximum,seconds): raise HTTPException(429,'Слишком много запросов. Повторите позже.')

    def identity(request,csrf=False,owner=False):
        token=request.cookies.get('declaration_session','')
        with store.connect() as db:
            row=db.execute('SELECT u.id,u.username,u.name,u.role,s.csrf FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>? AND u.active=1',(digest(token),time.time())).fetchone()
        if not row: raise HTTPException(401,'Войдите, чтобы открыть декларацию.')
        user=dict(row)
        if owner and user['role']!='owner': raise HTTPException(403,'Это действие доступно только владельцу.')
        if csrf and not hmac.compare_digest(user['csrf'],request.headers.get('X-CSRF-Token','')): raise HTTPException(403,'Сессия изменилась. Обновите страницу.')
        return user

    def public_user(user): return {k:user[k] for k in ('id','username','name','role')}

    def login_response(uid):
        token=secrets.token_urlsafe(32);csrf=secrets.token_urlsafe(24)
        with store.connect() as db:
            db.execute('DELETE FROM sessions WHERE expires<?',(time.time(),))
            db.execute('INSERT INTO sessions(token,user_id,csrf,expires) VALUES(?,?,?,?)',(digest(token),uid,csrf,time.time()+7*86400))
        response=JSONResponse({'ok':True})
        response.set_cookie('declaration_session',token,max_age=7*86400,httponly=True,secure=secure_cookie,samesite='strict',path='/')
        return response

    def credentials(payload):
        username=payload.get('username','')
        name=payload.get('name','')
        password=payload.get('password','')
        if not all(isinstance(v,str) for v in (username,name,password)): raise HTTPException(400,'Некорректные данные учётной записи.')
        username=username.strip().lower();name=name.strip()
        if not re.fullmatch('[a-z0-9_.-]{3,40}',username): raise HTTPException(400,'Логин: 3–40 латинских букв, цифр, точек, дефисов или подчёркиваний.')
        if not 1<=len(name)<=80: raise HTTPException(400,'Имя должно содержать от 1 до 80 символов.')
        if not 12<=len(password)<=200: raise HTTPException(400,'Пароль должен содержать от 12 до 200 символов.')
        return username,name,password

    def board(user):
        with store.connect() as db:
            row=db.execute('SELECT * FROM board WHERE id=1').fetchone()
            state=json.loads(row['state'])
            events=[{'id':r['id'],'at':r['at'],'actor':r['actor'],'detail':json.loads(r['detail']),'metrics':json.loads(r['metrics'])} for r in db.execute('SELECT * FROM events ORDER BY id DESC LIMIT 400')][::-1]
        if user['role']!='owner': state['wheel']=None
        return {'declaration':DECLARATION,'user':public_user(user),'state':state,'version':row['version'],'updatedAt':row['updated'],'history':events,'serverTime':now()}

    @app.get('/')
    def index(): return FileResponse(ROOT/'public'/'index.html')

    @app.get('/healthz')
    def health(): return {'ok':True}

    @app.get('/api/session')
    def session(request: Request):
        try:
            user=identity(request)
            return {'user':public_user(user),'csrf':user['csrf'],'setupRequired':False}
        except HTTPException:
            return {'user':None,'csrf':None,'setupRequired':not store.has_owner()}

    @app.post('/api/setup')
    def setup(payload:dict,request: Request):
        limit(request,'setup')
        username,name,password=credentials(payload)
        rawcode=payload.get('code','')
        if not isinstance(rawcode,str): raise HTTPException(400,'Неверный код настройки.')
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute("SELECT 1 FROM users WHERE role='owner'").fetchone(): raise HTTPException(409,'Владелец уже зарегистрирован.')
            saved=db.execute("SELECT value FROM config WHERE key='setup'").fetchone()['value']
            if not hmac.compare_digest(saved,digest(rawcode)): raise HTTPException(403,'Неверный код настройки.')
            uid=db.execute("INSERT INTO users(username,name,password,role) VALUES(?,?,?,'owner')",(username,name,password_hash(password))).lastrowid
        return login_response(uid)

    @app.post('/api/login')
    def login(payload:dict,request: Request):
        limit(request,'login')
        username=payload.get('username','');password=payload.get('password','')
        if not isinstance(username,str) or not isinstance(password,str) or len(password)>200: raise HTTPException(401,'Неверный логин или пароль.')
        with store.connect() as db:
            row=db.execute('SELECT * FROM users WHERE username=? AND active=1',(username.strip().lower(),)).fetchone()
        # Always perform a password derivation to reduce username timing differences.
        stored=row['password'] if row else '00'*16+':'+'00'*64
        valid=password_matches(password,stored)
        if not row or not valid: raise HTTPException(401,'Неверный логин или пароль.')
        return login_response(row['id'])

    @app.post('/api/logout')
    def logout(payload:dict,request: Request):
        identity(request,csrf=True)
        with store.connect() as db: db.execute('DELETE FROM sessions WHERE token=?',(digest(request.cookies.get('declaration_session','')),))
        response=JSONResponse({'ok':True});response.delete_cookie('declaration_session',path='/')
        return response

    @app.get('/api/board')
    def get_board(request: Request): return board(identity(request))

    @app.put('/api/board')
    def put_board(payload:dict,request: Request):
        user=identity(request,csrf=True,owner=True)
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row=db.execute('SELECT * FROM board WHERE id=1').fetchone()
            if type(payload.get('version')) is not int or payload['version']!=row['version']: raise HTTPException(409,'Есть изменения с другого устройства. Данные обновлены; повторите своё действие.')
            old=json.loads(row['state'])
            try: state=validate_state(payload.get('state'),old)
            except (ValueError,KeyError,TypeError) as e: raise HTTPException(400,str(e) if isinstance(e,ValueError) else 'Некорректное состояние.')
            if state!=old:
                timestamp=now()
                db.execute('UPDATE board SET state=?,version=version+1,updated=? WHERE id=1',(json.dumps(state,ensure_ascii=False),timestamp))
                db.execute('INSERT INTO events(at,actor,detail,metrics) VALUES(?,?,?,?)',(timestamp,user['name'],json.dumps(event_summary(old,state),ensure_ascii=False),json.dumps(metrics(state))))
        return board(user)

    @app.post('/api/invites')
    def invite(payload:dict,request: Request):
        identity(request,csrf=True,owner=True);limit(request,'invite',30,3600)
        name=payload.get('name','Участник мастермайнда')
        if not isinstance(name,str) or not 1<=len(name.strip())<=80: raise HTTPException(400,'Укажите имя участника.')
        token=secrets.token_urlsafe(32);expiry=time.time()+7*86400
        with store.connect() as db: db.execute('INSERT INTO invites(token,name,expires) VALUES(?,?,?)',(digest(token),name.strip(),expiry))
        return {'token':token,'expires':expiry,'name':name.strip()}

    @app.post('/api/join')
    def join(payload:dict,request: Request):
        limit(request,'join')
        username,name,password=credentials(payload)
        token=payload.get('token','')
        if not isinstance(token,str): raise HTTPException(400,'Приглашение недействительно.')
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            invitation=db.execute('SELECT * FROM invites WHERE token=? AND used=0 AND expires>?',(digest(token),time.time())).fetchone()
            if not invitation: raise HTTPException(400,'Приглашение использовано, отозвано или просрочено.')
            try: uid=db.execute("INSERT INTO users(username,name,password,role) VALUES(?,?,?,'member')",(username,name,password_hash(password))).lastrowid
            except sqlite3.IntegrityError: raise HTTPException(409,'Этот логин уже занят.')
            db.execute('UPDATE invites SET used=1 WHERE id=?',(invitation['id'],))
        return login_response(uid)

    @app.get('/api/members')
    def members(request: Request):
        identity(request,owner=True)
        with store.connect() as db:
            users=[dict(r) for r in db.execute('SELECT id,username,name,role,active FROM users ORDER BY id')]
            invites=[dict(r) for r in db.execute('SELECT id,name,expires FROM invites WHERE used=0 AND expires>? ORDER BY id DESC',(time.time(),))]
        return {'members':users,'invites':invites}

    @app.delete('/api/members/{uid}')
    def revoke_member(uid:int,payload:dict,request: Request):
        user=identity(request,csrf=True,owner=True)
        if user['id']==uid: raise HTTPException(400,'Нельзя отозвать собственный доступ.')
        with store.connect() as db:
            db.execute("UPDATE users SET active=0 WHERE id=? AND role='member'",(uid,))
            db.execute('DELETE FROM sessions WHERE user_id=?',(uid,))
        return {'ok':True}

    @app.delete('/api/invites/{iid}')
    def revoke_invite(iid:int,payload:dict,request: Request):
        identity(request,csrf=True,owner=True)
        with store.connect() as db: db.execute('UPDATE invites SET used=1 WHERE id=?',(iid,))
        return {'ok':True}

    @app.get('/api/export')
    def export(request: Request):
        user=identity(request,owner=True)
        data=board(user)
        data['exportedAt']=now();data['format']='declaration-board-v1'
        return JSONResponse(data,headers={'Content-Disposition':'attachment; filename="declaration-backup.json"'})

    app.mount('/assets',StaticFiles(directory=ROOT/'public'),name='assets')
    return app
