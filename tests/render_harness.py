"""DOM tests without browser navigation. Uses in-memory storage and in-process API.

Managed Chromium in this environment disallows all URL navigation. This harness
keeps that policy intact: HTML is rendered on about:blank. Browser storage and
fetch are explicit test adapters. API tests separately cover persistence/auth.
This is not a deployed-site or native file:// persistence test.
"""
import json
import tempfile
import os
from pathlib import Path
from fastapi.testclient import TestClient
from playwright.sync_api import sync_playwright
from app import create_app

ROOT=Path(__file__).resolve().parents[1]
ART=Path(os.getenv('TEST_ARTIFACT_DIR',str(ROOT/'test-artifacts')));ART.mkdir(exist_ok=True)
LOCAL=Path(os.getenv('TEST_HTML',str(ROOT/'declaration-local.html'))).read_text()
INDEX=(ROOT/'public/index.html').read_text().replace('<link rel="stylesheet" href="/assets/style.css">','<style>'+ (ROOT/'public/style.css').read_text()+'</style>').replace('<script src="/assets/core.js"></script>','<script>'+ (ROOT/'public/core.js').read_text()+'</script>').replace('<script src="/assets/app.js"></script>','<script>'+ (ROOT/'public/app.js').read_text()+'</script>')
MEMORY='''<script>
window.TEST_STORAGE=window.TEST_STORAGE||{};
Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return window.TEST_STORAGE[k]||null;},setItem(k,v){window.TEST_STORAGE[k]=String(v);},removeItem(k){delete window.TEST_STORAGE[k];}}});
</script>'''
FETCH='''<script>
window.fetch=async function(path,options={}){
 const data=await window.testApi({path,method:options.method||'GET',headers:options.headers||{},body:options.body||null});
 return {ok:data.status>=200&&data.status<300,status:data.status,json:async()=>data.json};
};
</script>'''
checks=[];errors=[]
def check(value,message):
 assert value,message
 checks.append(message)

def load(page,html,prefix=''):
 page.set_content(html.replace('<script>',''+prefix+'<script>',1))
 page.wait_for_timeout(120)

with tempfile.TemporaryDirectory() as td:
 app=create_app(td,setup_code='component-test-code',secure_cookie=False)
 owner_client=TestClient(app)
 guest_client=TestClient(app)
 def adapter(client):
  def call(source,req):
   # In-process calls only; never route to external or network addresses.
   assert req['path'].startswith('/api/')
   data=json.loads(req['body']) if req['body'] else None
   r=client.request(req['method'],req['path'],headers=req['headers'],json=data)
   return {'status':r.status_code,'json':r.json()}
  return call
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  ctx=browser.new_context(viewport={'width':1440,'height':1080},locale='ru-RU',reduced_motion='reduce')
  page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  load(page,LOCAL,MEMORY)
  page.wait_for_selector('.goal-card')
  check(page.locator('.goal-card').count()==6,'DOM: six signed obligations')
  check(page.locator('.local-banner').count()==0,'DOM: removed banner stays absent')
  page.screenshot(path=str(ART/'dashboard-desktop.png'),full_page=True)
  page.locator('[data-goal="g5"]').click();page.locator('#g5s1').check()
  page.wait_for_function('document.querySelector(".ring-label strong").textContent==="17%"')
  page.locator('[data-tab="result"]').click();page.locator('#g5c1').check()
  page.wait_for_selector('.notice.success')
  check(page.locator('[data-card="g5"] .tag.accepted').count()==1,'DOM: acceptance independent from progress')
  page.locator('.drawer-head [data-action="close"]').click()
  stored=page.evaluate('JSON.stringify(window.TEST_STORAGE)')
  page.close();page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  load(page,LOCAL,MEMORY.replace('window.TEST_STORAGE||{}',stored))
  page.wait_for_selector('[data-card="g5"] .tag.accepted')
  check(page.locator('.ring-label strong').inner_text()=='17%','DOM: app reinitializes correctly from storage fixture')
  page.locator('[data-view="map"]').first.click()
  check(page.locator('.map-node').count()==6,'DOM: all map nodes interactive')
  page.screenshot(path=str(ART/'dashboard-map.png'),full_page=True)
  page.locator('[data-goal="g1"]').click();page.locator('[data-tab="result"]').click()
  page.locator('#proof').fill('Черновик подтверждения, ещё не опубликован')
  page.locator('#g1c1').click()
  check(page.locator('#proof').input_value()=='Черновик подтверждения, ещё не опубликован','DOM: criterion toggle does not discard an unsaved proof draft')
  page.locator('form[data-form="proof"] button[type=submit]').click()
  page.wait_for_timeout(100);page.locator('.drawer-head [data-action="close"]').click()
  page.locator('[data-goal="g4"]').click();page.locator('[data-action="wheel"]').click()
  for area,v in [('work',8),('family',6),('health',7),('growth',7),('rest',5),('finance',7)]:page.locator('#wheel-'+area).fill(str(v))
  page.locator('#reflection').fill('Личная заметка: не включать в отчёт')
  page.screenshot(path=str(ART/'dashboard-wheel.png'),full_page=True)
  page.evaluate("() => {window.testOriginalSet=localStorage.setItem;localStorage.setItem=()=>{throw new Error('Test storage failure')};}")
  page.locator('form[data-form="wheel"] button[type=submit]').click()
  page.wait_for_timeout(150)
  check(page.locator('form[data-form="wheel"]').count()==1,'DOM: storage failure keeps unsaved wheel form open')
  page.evaluate("() => {localStorage.setItem=window.testOriginalSet;}")
  page.locator('form[data-form="wheel"] button[type=submit]').click()
  page.wait_for_selector('.drawer');page.locator('.drawer-head [data-action="close"]').click()
  page.locator('[data-action="menu"]').click();page.locator('[data-action="report"]').click()
  check('Личная заметка' not in page.locator('#report-content').input_value(),'DOM: group report omits private wheel reflection')
  page.locator('.modal-head [data-action="close"]').click();page.locator('[data-view="dynamics"]').first.click()
  check(page.locator('.chart-svg').count()==1,'DOM: history graph generated only after actual fixture actions')
  page.screenshot(path=str(ART/'dashboard-history.png'),full_page=True)
  page.locator('[data-view="document"]').first.click()
  check(page.locator('.document ol').count()==2,'DOM: document contains obligations and criteria')
  check('1 000 у. е.' in page.locator('.document').inner_text(),'DOM: signed price retained without payment function')
  check('Крутой исинский чайник' in page.locator('.document').inner_text(),'DOM: signed reward retained')
  mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,device_scale_factor=1,locale='ru-RU',reduced_motion='reduce').new_page()
  mobile.on('pageerror',lambda e:errors.append(str(e)));load(mobile,LOCAL,MEMORY)
  mobile.wait_for_selector('.goal-card')
  check(mobile.evaluate('document.documentElement.scrollWidth<=innerWidth'),'mobile DOM: no horizontal overflow on overview')
  mobile.screenshot(path=str(ART/'dashboard-mobile.png'),full_page=True)
  mobile.locator('[data-view="map"]').first.click()
  check(mobile.evaluate('document.documentElement.scrollWidth<=innerWidth'),'mobile DOM: no horizontal overflow on map')
  mobile.locator('[data-goal="g1"]').click()
  check(mobile.locator('#g1s1').is_visible(),'mobile DOM: accessible task drawer')
  mobile.screenshot(path=str(ART/'dashboard-mobile-drawer.png'),full_page=True)
  # Server-mode UI calls a real in-process API with separate TestClient sessions.
  owner=browser.new_context(viewport={'width':1440,'height':1080},locale='ru-RU',reduced_motion='reduce').new_page()
  owner.on('pageerror',lambda e:errors.append(str(e)));owner.expose_binding('testApi',adapter(owner_client));load(owner,INDEX,FETCH)
  owner.wait_for_selector('#auth-code')
  owner.locator('#auth-code').fill('component-test-code');owner.locator('#auth-name').fill('Максим')
  owner.locator('#auth-username').fill('maxim');owner.locator('#auth-password').fill('component-only-password-very-long')
  owner.locator('form[data-form="auth"] button[type=submit]').click();owner.wait_for_selector('[data-card="g1"]')
  check(owner.locator('.local-banner').count()==0,'integrated DOM/API: owner authentication')
  owner.locator('[data-action="share"]').click();owner.locator('#invite-name').fill('Друг')
  owner.locator('form[data-form="invite"] button[type=submit]').click();owner.wait_for_selector('#invite-link')
  token=owner.locator('#invite-link').input_value().split('#invite=')[1]
  check(bool(token),'integrated DOM/API: one-time invitation created')
  r=guest_client.post('/api/join',json={'token':token,'username':'friend','name':'Друг','password':'component-only-password-very-long'},headers={'X-Requested-With':'DeclarationDashboard'})
  check(r.status_code==200,'API: guest accepts invitation with separate session')
  guest=browser.new_context(viewport={'width':1280,'height':960},locale='ru-RU',reduced_motion='reduce').new_page()
  guest.on('pageerror',lambda e:errors.append(str(e)));guest.expose_binding('testApi',adapter(guest_client));load(guest,INDEX,FETCH)
  guest.wait_for_selector('[data-card="g1"]');guest.locator('[data-goal="g1"]').click()
  check(guest.locator('#g1s1').is_disabled(),'integrated DOM/API: guest cannot interact with owner checkboxes')
  guest.locator('[data-tab="comments"]').click();guest.locator('#comment-text').fill('Совместный тестовый комментарий')
  check(guest.locator('[data-action="submit-comment"]').get_attribute('type')=='submit','DOM: comment button is a native submit control')
  guest.locator('[data-action="submit-comment"]').click();guest.wait_for_selector('.comment')
  check('Совместный тестовый комментарий' in guest.locator('#comment-list').inner_text(),'integrated DOM/API: guest comment is persisted')
  owner.locator('.modal-head [data-action="close"]').click();owner.locator('[data-view="discussion"]').first.click()
  owner.wait_for_selector('.comment',timeout=16000)
  check('Совместный тестовый комментарий' in owner.locator('#comment-list').inner_text(),'integrated DOM/API: poll delivers another session comment')
  owner.locator('[data-view="overview"]').first.click();owner.screenshot(path=str(ART/'dashboard-server.png'),full_page=True)
  check(not errors,'DOM: no uncaught JavaScript errors')
  browser.close()
result={'passed':len(checks),'checks':checks,'errors':errors,'scope':'Rendered DOM with explicit in-memory localStorage and in-process API adapters; browser URL navigation blocked by managed policy. Native file/browser network end-to-end not run.'}
(ART/'ui-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False,indent=2))
