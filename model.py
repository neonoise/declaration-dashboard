"""Signed declaration content and strict server-side state validation."""
from pathlib import Path
import json
import datetime as dt
from urllib.parse import urlsplit

DECLARATION = json.loads(Path(__file__).with_name('declaration.json').read_text(encoding='utf-8'))
UTC = dt.timezone.utc

def now():
    return dt.datetime.now(UTC).isoformat(timespec='seconds')

def initial_state():
    return {'goals':{g['id']:{'steps':{x['id']:False for x in g['steps']},'criteria':{x['id']:False for x in g['criteria']},'dates':{x['id']:'' for x in g['steps']},'proof':'','proofUrl':'','completedAt':None} for g in DECLARATION['goals']},'wheel':{'ratings':{a['id']:None for a in DECLARATION['wheelAreas']},'reflection':''}}

def metrics(state):
    goals = []
    for g in DECLARATION['goals']:
        v = state['goals'][g['id']]
        goals.append({'id':g['id'], 'percent':100*sum(v['steps'].values())/len(g['steps']), 'complete':all(v['criteria'].values())})
    return {'progress':sum(g['percent'] for g in goals)/6, 'completed':sum(g['complete'] for g in goals),'goals':goals}

def validate_state(raw, old):
    def require(condition,message='Некорректные данные состояния.'):
        if not condition: raise ValueError(message)
    def exact(obj,keys):
        require(isinstance(obj,dict) and set(obj)==set(keys))
    def text(value,limit):
        require(isinstance(value,str) and len(value)<=limit)
        return value.strip()
    exact(raw,['goals','wheel'])
    exact(raw['goals'],[g['id'] for g in DECLARATION['goals']])
    result = initial_state()
    for g in DECLARATION['goals']:
        gid=g['id']; v=raw['goals'][gid]; out=result['goals'][gid]
        exact(v,['steps','criteria','dates','proof','proofUrl','completedAt'])
        for key,items in [('steps',g['steps']),('criteria',g['criteria'])]:
            exact(v[key],[x['id'] for x in items])
            require(all(type(value) is bool for value in v[key].values()))
            out[key]=dict(v[key])
        exact(v['dates'],[s['id'] for s in g['steps']])
        for key,value in v['dates'].items():
            require(isinstance(value,str))
            if value:
                try: date=dt.date.fromisoformat(value)
                except (ValueError,TypeError): raise ValueError('Некорректная дата подзадачи.')
                require(value==date.isoformat() and '2020-01-01'<=value<='2100-12-31','Некорректная дата подзадачи.')
            out['dates'][key]=value
        out['proof']=text(v['proof'],4000)
        out['proofUrl']=text(v['proofUrl'],2000)
        if out['proofUrl']:
            url=urlsplit(out['proofUrl'])
            require(url.scheme=='https' and bool(url.netloc) and not url.username,'Ссылка должна начинаться с https://.')
        if g['area']=='personal':
            require(not out['proof'] and not out['proofUrl'],'Для личных обязательств фиксируются только статусы и даты.')
        out['completedAt']=(old['goals'][gid]['completedAt'] or now()) if all(out['criteria'].values()) else None
    exact(raw['wheel'],['ratings','reflection'])
    exact(raw['wheel']['ratings'],[a['id'] for a in DECLARATION['wheelAreas']])
    for key,value in raw['wheel']['ratings'].items():
        require(value is None or type(value) in (int,float) and 0<=value<=10,'Оценка должна быть от 0 до 10.')
        result['wheel']['ratings'][key]=value
    result['wheel']['reflection']=text(raw['wheel']['reflection'],4000)
    return result

def event_summary(old,new):
    changes=[]
    for g in DECLARATION['goals']:
        gid=g['id'];a=old['goals'][gid];b=new['goals'][gid]
        for key,items in [('steps',g['steps']),('criteria',g['criteria'])]:
            for item in items:
                if a[key][item['id']]!=b[key][item['id']]:
                    kind='Шаг' if key=='steps' else 'Критерий'
                    action='подтверждён' if b[key][item['id']] else 'отменён'
                    changes.append(f'{kind} {action}: {g["title"]} · {item["text"]}')
        if a['dates']!=b['dates']: changes.append('Обновлены сроки: '+g['title'])
        if a['proof']!=b['proof'] or a['proofUrl']!=b['proofUrl']: changes.append('Обновлено подтверждение: '+g['title'])
    if old['wheel']!=new['wheel']: changes.append('Обновлена личная оценка баланса. Содержание закрыто для группы.')
    return changes
