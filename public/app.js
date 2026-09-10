/* Interactive declaration UI. The hosted edition never trusts client-side roles. */
(async function () {
 'use strict';
 const C=window.DeclarationCore, E=C.esc;
 const LOCAL=Boolean(window.LOCAL_DECLARATION);
 const KEY='declaration:2026-10-31:v1';
 const $=s=>document.querySelector(s);
 const clone=o=>JSON.parse(JSON.stringify(o));
 const iconPaths={grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',map:'<rect x="8" y="3" width="8" height="5" rx="1"/><path d="M12 8v5M5 13h14M5 13v3m14-3v3"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/>',chart:'<path d="M4 3v17h17M7 15l4-5 4 2 6-7"/>',file:'<path d="M14 2H5v20h14V7zM14 2v6h5M8 12h8m-8 4h8"/>',arrow:'<path d="M7 17 17 7M7 7h10v10"/>',right:'<path d="m9 5 7 7-7 7"/>',share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-3m-6 7 6 3"/>',dots:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h3"/>',check:'<path d="m5 12 4 4L19 6"/>',circlecheck:'<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',list:'<path d="m3 6 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2M10 6h11m-11 6h11m-11 6h11"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6"/>',upload:'<path d="M12 17V5m-5 5 5-5 5 5M4 17v4h16v-4"/>',copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',logout:'<path d="M9 3H3v18h6m4-9h8m-4-4 4 4-4 4"/>',print:'<path d="M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6z"/>',leaf:'<path d="M20 3C9 1 2 8 5 15c3 7 15 4 15-12ZM5 20 16 8"/>',target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',refresh:'<path d="M20 5v5h-5M4 19v-5h5M5 8a8 8 0 0 1 13-4l2 6M4 14l2 6a8 8 0 0 0 13-4"/>'};
 const icon=n=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[n]||iconPaths.target}</svg>`;
 const navs=[['overview','grid','Обзор'],['map','map','Карта задач'],['dynamics','chart','Динамика'],['document','file','Декларация']];
 let B=null,D=null,csrf=null,view='overview',filter='all',drawer=null,modal=null,inviteToken=null;
 let saving=false,sync='saved',lastSync=null,storageError=false,dirty=false,returnFocus=null;
 const statusNames={empty:'Нет отметок',active:'В работе',review:'Проверить результат',accepted:'Результат принят'};
 const fmtDate=(value,withTime=false)=>value?new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Minsk',day:'2-digit',month:'short',...(withTime?{hour:'2-digit',minute:'2-digit'}:{year:'numeric'})}).format(new Date(value.length===10?value+'T12:00:00+03:00':value)).replace(' г.',''):'—';
 const pct=n=>Math.round(n)+'%';
 const initials=s=>s.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
 const plural=(n,a,b,c)=>{n=Math.abs(n)%100;return n>=11&&n<=14?c:n%10===1?a:n%10>=2&&n%10<=4?b:c;};
 const own=()=>B&&B.user.role==='owner';
 const stats=()=>C.metrics(D,B.state);
 const getGoal=id=>D.goals.find(g=>g.id===id);
 const goalStats=id=>stats().goals.find(g=>g.id===id);
 const btn=(text,action,ico='',classes='',extra='')=>`<button type="button" class="btn ${classes}" data-action="${action}" ${extra}>${ico?icon(ico):''}${text}</button>`;
 const ibtn=(ico,action,label,extra='')=>`<button type="button" class="icon-btn" data-action="${action}" aria-label="${E(label)}" title="${E(label)}" ${extra}>${icon(ico)}</button>`;
 function toast(text,error=false){const el=$('#toast');el.textContent=text;el.className='toast visible'+(error?' error':'');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),error?6500:3300);}
 function saveLabel(){return sync==='saving'?'Сохраняем…':sync==='error'?'Не сохранено':sync==='offline'?'Нет связи':LOCAL?'Сохранено в браузере':'Данные синхронизированы';}
 function saveStatus(){return `<span class="status-save" data-sync><i class="dot ${sync==='error'||sync==='offline'?'error':LOCAL?'local':''}"></i><span>${saveLabel()}</span></span>`;}
 function updateStatus(){document.querySelectorAll('[data-sync]').forEach(el=>{el.innerHTML=`<i class="dot ${sync==='error'||sync==='offline'?'error':LOCAL?'local':''}"></i><span>${saveLabel()}</span>`;});}
 async function api(path,method='GET',data){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
  try{
   const headers={};if(method!=='GET'){headers['Content-Type']='application/json';headers['X-Requested-With']='DeclarationDashboard';if(csrf)headers['X-CSRF-Token']=csrf;}
   const r=await fetch(path,{method,credentials:'same-origin',headers,body:data===undefined?undefined:JSON.stringify(data),signal:controller.signal,cache:'no-store'});
   const payload=await r.json().catch(()=>({detail:'Сервер вернул неожиданный ответ.'}));
   if(!r.ok){const e=new Error(typeof payload.detail==='string'?payload.detail:'Проверьте введённые данные.');e.status=r.status;throw e;}return payload;
  }catch(e){if(e.name==='AbortError')throw new Error('Нет ответа от сервера. Изменения не сохранены.');throw e;}finally{clearTimeout(timer);}
 }
 function validateImported(state){
  if(!state||!state.goals||!state.wheel)throw new Error('В файле нет совместимого состояния декларации.');
  const out=C.initial(D);
  if(Object.keys(state.goals).length!==6)throw new Error('Должно быть шесть обязательств.');
  for(const g of D.goals){
   const a=state.goals[g.id],b=out.goals[g.id];if(!a)throw new Error('В файле отсутствует обязательство.');
   for(const key of ['steps','criteria'])for(const k of Object.keys(b[key])){if(typeof a[key]?.[k]!=='boolean')throw new Error('Некорректные отметки в файле.');b[key][k]=a[key][k];}
   for(const k of Object.keys(b.dates)){const v=a.dates?.[k]||'';if(v&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v+'T12:00:00Z'))||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v))throw new Error('Некорректная дата.');b.dates[k]=v;}
   if(g.area==='business'){if(typeof a.proof!=='string'||a.proof.length>4000||typeof a.proofUrl!=='string'||a.proofUrl.length>2000)throw new Error('Некорректное подтверждение.');b.proof=a.proof;b.proofUrl=a.proofUrl;if(b.proofUrl&&!C.safeUrl(b.proofUrl))throw new Error('Поддерживаются только ссылки https://.');}
   b.completedAt=Object.values(b.criteria).every(Boolean)?(a.completedAt&&Number.isFinite(Date.parse(a.completedAt))?a.completedAt:new Date().toISOString()):null;
  }
  for(const a of D.wheelAreas){const v=state.wheel.ratings?.[a.id];if(v!==null&&!(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=10))throw new Error('Оценки баланса должны быть от 0 до 10.');out.wheel.ratings[a.id]=v;}
  if(typeof state.wheel.reflection!=='string'||state.wheel.reflection.length>4000)throw new Error('Некорректная заметка колеса баланса.');out.wheel.reflection=state.wheel.reflection;
  return out;
 }
 function localDetails(a,b){
  const changes=[];
  for(const g of D.goals){for(const key of ['steps','criteria'])for(const item of g[key]){if(a.goals[g.id][key][item.id]!==b.goals[g.id][key][item.id])changes.push(`${key==='steps'?'Шаг':'Критерий'} ${b.goals[g.id][key][item.id]?'подтверждён':'отменён'}: ${g.title} · ${item.text}`);}
   if(JSON.stringify(a.goals[g.id].dates)!==JSON.stringify(b.goals[g.id].dates))changes.push('Обновлены сроки: '+g.title);
   if(a.goals[g.id].proof!==b.goals[g.id].proof||a.goals[g.id].proofUrl!==b.goals[g.id].proofUrl)changes.push('Обновлено подтверждение: '+g.title);
  }
  if(JSON.stringify(a.wheel)!==JSON.stringify(b.wheel))changes.push('Обновлена личная оценка баланса. Содержание закрыто для группы.');
  return changes;
 }
 async function changeState(mutator,message='Изменения сохранены'){
  if(!own()||saving)return false;
  const next=clone(B.state);mutator(next);
  if(JSON.stringify(next)===JSON.stringify(B.state)){dirty=false;toast('Новых изменений нет');return true;}
  saving=true;sync='saving';updateStatus();document.querySelectorAll('[data-state-check]').forEach(x=>x.disabled=true);
  try{
   if(LOCAL){
    if(storageError)throw new Error('Локальное хранилище недоступно. Экспортируйте данные перед закрытием.');
    const normalized=validateImported(next);
    for(const g of D.goals)normalized.goals[g.id].completedAt=Object.values(normalized.goals[g.id].criteria).every(Boolean)?B.state.goals[g.id].completedAt||new Date().toISOString():null;
    const timestamp=new Date().toISOString();const m=C.metrics(D,normalized);
    const result={...B,state:normalized,version:B.version+1,updatedAt:timestamp,history:[...B.history,{id:B.version+1,at:timestamp,actor:B.user.name,detail:localDetails(B.state,normalized),metrics:{progress:m.progress,completed:m.completed}}]};
    localStorage.setItem(KEY,JSON.stringify({state:result.state,version:result.version,updatedAt:result.updatedAt,history:result.history}));B=result;
   }else B=await api('/api/board','PUT',{version:B.version,state:next});
   sync='saved';dirty=false;lastSync=new Date();toast(message);render();return true;
  }catch(e){
   if(e.status===409){B=await api('/api/board').catch(()=>B);dirty=false;sync='saved';}
   else sync='error';
   toast(e.message||'Сохранение не выполнено.',true);render();return false;
  }finally{saving=false;updateStatus();if(drawer&&!modal&&!dirty)renderDrawer();}
 }
 function ring(n,label='прогресс действий'){const length=2*Math.PI*48;return `<div class="ring" role="img" aria-label="${pct(n)} — ${E(label)}"><svg viewBox="0 0 112 112"><circle class="track" cx="56" cy="56" r="48"/><circle class="meter" cx="56" cy="56" r="48" stroke-dasharray="${length}" stroke-dashoffset="${length*(1-n/100)}"/></svg><div class="ring-label"><strong>${pct(n)}</strong><span>${E(label)}</span></div></div>`;}
 function render(){
  if(!B)return;const m=stats(),days=C.daysLeft(D.deadline),countdown=days<0?`${Math.abs(days)} ${plural(days,'день','дня','дней')}`:days===0?'Сегодня':`${days} ${plural(days,'день','дня','дней')}`;
  $('#app').innerHTML=`<div class="shell"><aside class="sidebar"><div class="brand"><span class="brand-mark">М</span><div><strong>Декларация</strong><span>МАСТЕРМАЙНД</span></div></div><div><p class="sidebar-label">РАБОЧЕЕ ПРОСТРАНСТВО</p><nav class="nav" aria-label="Разделы декларации">${navs.map(([id,ico,label])=>`<button type="button" data-view="${id}" class="${view===id?'active':''}" ${view===id?'aria-current="page"':''}>${icon(ico)}<span>${label}</span></button>`).join('')}</nav></div><div class="side-note"><span class="eyebrow">${days<0?'ПОСЛЕ ДЕДЛАЙНА':'ДО МАСТЕРМАЙНДА'}</span><div class="countdown mono">${countdown}</div><p class="tiny muted">31 октября 2026</p><div class="bar" style="margin-top:14px"><span style="width:${Math.max(0,Math.min(100,(77-days)/77*100))}%"></span></div><p class="tiny muted" style="margin-top:7px">Календарь, не прогресс задач</p></div><div class="side-person"><span class="avatar">${E(initials(B.user.name))}</span><div><div class="name">${E(B.user.name)}</div><span class="tiny muted">${own()?'Владелец декларации':'Участник мастермайнда'}</span></div></div></aside><div class="content"><header class="topbar"><div class="crumb"><span>Личное пространство</span>${icon('right')}<strong>${E(navs.find(n=>n[0]===view)[2])}</strong></div><div class="top-actions">${own()?btn('Поделиться','share','share'):btn('Обновить','refresh','refresh')}${ibtn('dots','menu','Действия и настройки')}</div></header><main id="main" tabindex="-1"><div class="view-panel">${view==='overview'?overview(m):view==='map'?mapView(m):view==='dynamics'?dynamics():view==='document'?documentView():overview(m)}</div><footer class="footer-note"><span>Основание: декларация от 15.08.2026 · Время — Минск</span><span>${LOCAL?'Локальное сохранение':`Совместный доступ · ${own()?'редактирование':'просмотр'}`}</span></footer></main></div></div>`;
 }
 function heading(title,desc,extra=''){return `<div class="page-heading"><div><h1>${title}</h1><p>${desc}</p></div>${extra}</div>`;}
 function card(g,m){return `<article class="goal-card ${g.area}" data-card="${g.id}"><div class="goal-top"><span class="goal-number">${String(g.number).padStart(2,'0')}</span><span class="tag ${g.area}">${E(g.function)}</span></div><h3>${E(g.title)}</h3><p>${E(g.objective)}</p><div class="card-meter"><div class="meter-caption"><span>${m.done} / ${m.total} ${plural(m.total,'шаг','шага','шагов')}</span><span class="mono">${pct(m.percent)}</span></div><div class="bar" role="progressbar" aria-label="${E(g.title)}: шаги" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(m.percent)}"><span style="width:${m.percent}%"></span></div></div><div class="card-bottom"><span class="tag ${m.status}">${statusNames[m.status]}</span><button type="button" class="card-open" data-goal="${g.id}" aria-label="Открыть: ${E(g.title)}">Открыть ${icon('arrow')}</button></div></article>`;}
 function overview(m){
  const goals=D.goals.filter(g=>filter==='all'||g.area===filter);const last=B.history.at(-1);
  return `${heading('Моя декларация','Шесть обязательств. Один понятный маршрут.',`<span class="tag">${icon('calendar')} До 31.10.2026</span>`)}<section class="hero"><div class="hero-copy"><span class="eyebrow">ГЛАВНОЕ НАПРАВЛЕНИЕ</span><h2>От операционки —<br> к стратегии.</h2><p>Передать опыт и ответственность. Освободить пространство для развития бизнеса, семьи и личной жизни.</p><div class="hero-foot"><span class="tag business">3 бизнесовых обязательства</span><span class="tag personal">3 личных обязательства</span><button class="link-button" data-action="purpose">Моя цель ${icon('arrow')}</button></div></div><div class="hero-progress">${ring(m.progress)}<div class="progress-detail"><strong class="mono">${m.completed}<span style="font-size:18px;color:#8ba392"> / 6</span></strong><p>результатов принято</p><button class="link-button" style="margin-top:12px" data-action="method">Как считаем ${icon('info')}</button></div></div></section><div class="stats-line"><div class="stat"><span class="stat-icon">${icon('list')}</span><div><strong class="mono">${m.doneSteps} / ${m.totalSteps}</strong><p>шагов отмечено</p></div></div><div class="stat"><span class="stat-icon">${icon('circlecheck')}</span><div><strong class="mono">${m.goals.filter(g=>g.status==='review').length}</strong><p>ждут проверки результата</p></div></div><div class="stat"><span class="stat-icon">${icon('clock')}</span><div><strong style="font-size:${B.updatedAt?'13px':'16px'}">${B.updatedAt?fmtDate(B.updatedAt,true):'Нет отметок'}</strong><p>последнее изменение</p></div></div></div><div class="section-heading"><h2>Шесть обязательств <span class="muted small">/ ${goals.length}</span></h2><div class="filters" aria-label="Фильтр обязательств">${[['all','Все'],['business','Бизнес'],['personal','Личное']].map(([id,label])=>`<button type="button" data-filter="${id}" class="${filter===id?'active':''}" aria-pressed="${filter===id}">${label}</button>`).join('')}</div></div><section class="goals-grid" aria-label="Обязательства">${goals.map(g=>card(g,m.goals.find(x=>x.id===g.id))).join('')}</section><div class="lower-grid"><section class="panel"><div class="row between" style="margin-bottom:9px"><h3 style="margin:0">Последнее обновление</h3><button class="link-button" data-view="dynamics">Вся история ${icon('arrow')}</button></div>${last?`<p>${E(last.detail[0]||'Обновлено состояние декларации.')}</p><span class="tiny muted">${fmtDate(last.at,true)} · ${E(last.actor)}</span>`:`<div class="empty-inline"><span class="empty-icon">${icon('leaf')}</span><div><p>История начинается с первого действия.</p><p>Открой обязательство и отметь фактически сделанное.</p></div></div>`}</section><section class="panel"><div class="row" style="margin-bottom:9px;color:var(--green)">${icon('target')}<h3 style="margin:0">Шаги и результат — отдельно</h3></div><p>Чек-лист показывает движение. Обязательство принято, когда подтверждены его исходные критерии.</p></section></div>`;
 }
 function mapView(m){return `${heading('Карта декларации','Нажми на обязательство, чтобы раскрыть действия и критерии.')}<section class="map-panel"><div class="map-root"><span class="eyebrow">ЦЕЛЬ ДЕКЛАРАЦИИ</span><h2>Больше пространства<br>для стратегии и жизни</h2><p>${m.completed} из 6 результатов принято · ${pct(m.progress)} действий</p></div><div class="tree-columns">${[['business','Бизнес','Управление · проекты · компетенции'],['personal','Личное','Баланс · семья · отношения']].map(([area,title,desc])=>{const gs=D.goals.filter(g=>g.area===area),ms=m.goals.filter(s=>gs.some(g=>g.id===s.id));return `<div class="tree-branch"><div class="branch-heading ${area}"><span>${title}</span><span>${pct(ms.reduce((a,b)=>a+b.percent,0)/3)}</span></div>${gs.map(g=>{const p=m.goals.find(x=>x.id===g.id);return `<button type="button" class="map-node" data-goal="${g.id}" aria-label="Открыть ${E(g.title)}"><span class="goal-number">${String(g.number).padStart(2,'0')}</span><span class="grow"><strong>${E(g.title)}</strong><small>${statusNames[p.status]} · ${p.done}/${p.total} шагов</small></span><span class="node-progress">${pct(p.percent)}</span></button>`;}).join('')}<p class="tiny muted" style="text-align:center;margin-top:15px">${desc}</p></div>`;}).join('')}</div></section><div class="badge-legend"><span><i></i>Каждое обязательство имеет одинаковый вес</span><span>Подзадачи раскрываются по нажатию</span></div>`;}
 function progressChart(){
  const history=B.history;
  if(!history.length)return `<div class="chart-empty"><p>Пока нет истории изменений.<br>График появится после первой сохранённой отметки. Прошлые результаты не предполагаются.</p></div>`;
  const points=history.filter(e=>Number.isFinite(e.metrics?.progress));if(!points.length)return '';
  const w=900,h=245,L=40,R=18,T=15,H=190;const first=Date.parse(points[0].at),last=Date.parse(points.at(-1).at);const span=last-first;
  const coords=points.map((e,i)=>({x:span?L+(Date.parse(e.at)-first)/span*(w-L-R):w/2,y:T+H*(1-e.metrics.progress/100),e}));
  const path=coords.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2)).join(' ');
  return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="История прогресса действий: ${points.length} обновлений, текущий прогресс ${pct(points.at(-1).metrics.progress)}">${[0,25,50,75,100].map(n=>`<line x1="${L}" y1="${T+H*(1-n/100)}" x2="${w-R}" y2="${T+H*(1-n/100)}" stroke="#e8eee5"/><text x="0" y="${T+H*(1-n/100)+4}">${n}%</text>`).join('')}${coords.length>1?`<path d="${path} L ${coords.at(-1).x} ${T+H} L ${coords[0].x} ${T+H} Z" fill="#e9f2e9"/><path d="${path}" fill="none" stroke="#327865" stroke-width="2.5"/>`:''}${coords.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#327865" stroke="white" stroke-width="1.5"><title>${fmtDate(p.e.at,true)}: ${pct(p.e.metrics.progress)} · принято ${p.e.metrics.completed}/6</title></circle>`).join('')}<text x="${L}" y="${h-9}">${fmtDate(points[0].at,true)}</text>${span?`<text x="${w-R}" y="${h-9}" text-anchor="end">${fmtDate(points.at(-1).at,true)}</text>`:''}</svg>`;
 }
 function dynamics(){const m=stats();return `${heading('Динамика выполнения','Только сохранённые изменения. Отмена отметки тоже остаётся в истории.')}<section class="panel chart-panel"><div class="row between"><div><span class="eyebrow">ПРОГРЕСС ДЕЙСТВИЙ</span><h2 class="mono" style="font-size:29px;font-weight:550;margin-top:4px">${pct(m.progress)}</h2></div><span class="tag business">Принято ${m.completed} / 6</span></div>${progressChart()}</section><section class="panel" style="margin-top:19px"><div class="row between"><h3 style="margin:0">Журнал изменений</h3><span class="tiny muted">${B.history.length?`Последние ${Math.min(B.history.length,50)} записей`:'История пока пуста'}</span></div>${B.history.length?`<ol class="timeline">${B.history.slice(-50).reverse().map(ev=>`<li><time>${fmtDate(ev.at,true)}</time>${ev.detail.map(t=>`<p>${E(t)}</p>`).join('')}<small>${E(ev.actor)} · действия ${pct(ev.metrics.progress)} · принято ${ev.metrics.completed}/6</small></li>`).join('')}</ol>`:`<div class="empty-inline" style="margin-top:15px"><span class="empty-icon">${icon('clock')}</span><p>Первая отметка создаст первую запись.<br>Дата подписания не считается датой начала фактической работы.</p></div>`}</section>`;}
 function documentView(){return `${heading('Исходная декларация','Содержание подписанного документа отделено от рабочего чек-листа.',btn('Печать','print','print'))}<article class="document"><span class="eyebrow">ПОДПИСАНО 15 АВГУСТА 2026</span><h2>Декларация</h2><p>Я, <strong>${E(D.author)}</strong>,<br><strong>обязуюсь к следующему Мастермайнду «31» октября 2026 г.:</strong></p><ol>${D.goals.map(g=>`<li>${E(g.statement)}</li>`).join('')}</ol><h3>Я делаю это для того, чтобы</h3><p>${E(D.purpose)}</p><h3>Критерием выполнения обязательств будет</h3><ol>${D.goals.map(g=>`<li>${g.criteria.map(c=>E(c.text)).join(' ')}</li>`).join('')}</ol><div class="doc-line"><div><span class="tiny muted">Цена слова при невыполнении</span><strong>${E(D.price)}</strong></div><div><span class="tiny muted">Награда себе в случае успеха</span><strong>${E(D.reward)}</strong></div></div><p class="source">${E(D.source)} Это текстовая версия для отслеживания. Рабочие подзадачи и методика процентов не меняют подписанные обязательства.</p></article>`;}
 function sourceDetails(g){return `<details class="source-details"><summary>Формулировка из декларации</summary><p>${E(g.statement)}</p></details>`;}
 function openGoal(id,tab='steps'){
  if(dirty&&!window.confirm('Не сохранённый текст будет потерян. Продолжить?'))return;
  if(!getGoal(id))return;returnFocus=document.activeElement;dirty=false;modal=null;drawer={id,tab};renderDrawer(true);
 }
 function renderDrawer(focus=false){
  if(!drawer)return;const g=getGoal(drawer.id),v=B.state.goals[g.id],m=goalStats(g.id);const prevScroll=$('.drawer-body')?.scrollTop||0;
  $('#overlay').innerHTML=`<div class="backdrop" data-action="close"></div><section class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title"><header class="drawer-head"><div class="row between"><div class="row"><span class="goal-number">${String(g.number).padStart(2,'0')}</span><span class="tag ${g.area}">${E(g.function)}</span></div>${ibtn('close','close','Закрыть обязательство')}</div><h2 id="drawer-title">${E(g.title)}</h2><p>${E(g.objective)}</p><div class="row between" style="margin-top:12px"><span class="tag ${m.status}">${statusNames[m.status]}</span><span class="tiny muted">${m.done}/${m.total} шагов · ${pct(m.percent)}</span></div><nav class="drawer-tabs" aria-label="Разделы обязательства">${[['steps','Шаги'],['result','Результат']].map(([id,label])=>`<button type="button" data-tab="${id}" class="${drawer.tab===id?'active':''}" aria-current="${drawer.tab===id?'page':'false'}">${label}</button>`).join('')}</nav></header><div class="drawer-body">${drawer.tab==='result'?resultContent(g,v,m):stepsContent(g,v,m)}</div><footer class="drawer-foot"><span>${own()?'Отмечает владелец декларации':'Просмотр · отметки изменяет Максим'}</span>${saveStatus()}</footer></section>`;
  document.body.style.overflow='hidden';$('.drawer-body').scrollTop=prevScroll;
  if(focus)setTimeout(()=>$('.drawer-head .icon-btn')?.focus(),20);
 }
 function stepsContent(g,v,m){return `${sourceDetails(g)}<div class="subsection-label"><span>Рабочий чек-лист</span><span class="muted tiny">Не новые обязательства</span></div><ul class="check-list">${g.steps.map((s,i)=>{const due=v.dates[s.id];const overdue=due&&due<C.today()&&!v.steps[s.id];return `<li class="check-row ${v.steps[s.id]?'done':''}"><input type="checkbox" id="${s.id}" data-state-check="steps" data-id="${s.id}" ${v.steps[s.id]?'checked':''} ${!own()||saving?'disabled':''}><div class="check-content"><label class="step-label" for="${s.id}">${E(s.text)}</label><div class="date-control">${own()?`<input type="date" data-due="${s.id}" value="${E(due)}" min="2020-01-01" max="2100-12-31" aria-label="Срок: ${E(s.text)}" ${saving?'disabled':''}>`:`<small>${due?fmtDate(due):'Промежуточный срок не задан'}</small>`}<small class="${overdue?'overdue':''}">${overdue?'Срок прошёл':due?'Плановая дата':'Срок не задан'}</small></div></div></li>`;}).join('')}</ul>${g.id==='g4'&&own()?`<div class="inline-divider"></div>${btn('Заполнить колесо баланса','wheel','target')}<p class="privacy-label">${icon('lock')} Оценки и личная заметка видны только тебе</p>`:''}<div class="inline-divider"></div><p class="legal-method">Шаги показывают ход работы. Выполнение самого обязательства подтверждается во вкладке «Результат».</p><div style="margin-top:15px">${btn('Проверить критерии','tab-result','circlecheck','primary')}</div>`;}
 function resultContent(g,v,m){
  return `${sourceDetails(g)}${m.complete?`<div class="notice success"><strong>Результат принят владельцем.</strong><br>Подтверждено ${fmtDate(v.completedAt,true)}. Дату фактического события эта отметка не устанавливает.</div>`:'<div class="notice">Подтверди только те критерии, которые фактически выполнены. Полный чек-лист сам по себе не принимает результат.</div>'}<div class="subsection-label">Исходные критерии выполнения</div><div class="criterion-box">${g.criteria.map(c=>`<div class="check-row ${v.criteria[c.id]?'done':''}"><input type="checkbox" id="${c.id}" data-state-check="criteria" data-id="${c.id}" ${v.criteria[c.id]?'checked':''} ${!own()||saving?'disabled':''}><div class="check-content"><label for="${c.id}">${E(c.text)}</label></div></div>`).join('')}</div>${g.area==='business'?own()?`<form data-form="proof"><div class="field"><label for="proof">Подтверждение результата</label><textarea id="proof" name="proof" maxlength="4000" placeholder="Что сделано и где это можно проверить. Без технических секретов.">${E(v.proof)}</textarea><small>Необязательное поле. Текст увидят участники мастермайнда.</small></div><div class="field"><label for="proofUrl">Ссылка на материал</label><input type="url" id="proofUrl" name="proofUrl" value="${E(v.proofUrl)}" placeholder="https://…" maxlength="2000"><small>Проверь права на связанный документ перед отправкой.</small></div><button type="submit" class="btn primary">${icon('check')}Сохранить подтверждение</button></form>`:`<div class="field"><label>Подтверждение владельца</label><p style="white-space:pre-wrap;font-size:12px">${E(v.proof)||'Материал пока не указан.'}</p>${C.safeUrl(v.proofUrl)?`<p style="margin-top:12px"><a href="${E(C.safeUrl(v.proofUrl))}" target="_blank" rel="noopener noreferrer">Открыть подтверждающий материал ↗</a></p>`:''}</div>`:'<div class="privacy-label">'+icon('lock')+' Для личных обязательств достаточно статуса и даты подтверждения.</div>'}<p class="legal-method" style="margin-top:20px">Критерии подтверждает владелец декларации. Подтверждение владельцем не означает независимой проверки результата.</p>`;
 }
 function showModal(type,title,body,wide=false){
  if(!drawer)returnFocus=document.activeElement;modal=type;
  $('#overlay').innerHTML=`<div class="backdrop" data-action="close"></div><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h2 id="modal-title">${title}</h2>${ibtn('close','close','Закрыть окно')}</div>${body}</section>`;
  document.body.style.overflow='hidden';setTimeout(()=>$('.modal .icon-btn')?.focus(),10);
 }
 function closeOverlay(force=false){
  if(!force&&dirty&&!confirm('Не сохранённый текст будет потерян. Закрыть?'))return;
  dirty=false;
  if(modal&&drawer){modal=null;renderDrawer(true);return;}
  modal=null;drawer=null;$('#overlay').innerHTML='';document.body.style.overflow='';returnFocus?.focus?.();returnFocus=null;
 }
 function methodModal(){showModal('method','Как считается выполнение',`<p>${E(D.method)}</p><div class="notice"><strong>Прогресс действий</strong> = (доля шагов №1 + … + доля шагов №6) ÷ 6 × 100%.</div><p>Например, все шаги одного обязательства дают примерно 16,7% общего прогресса — независимо от длины чек-листа.</p><div class="notice"><strong>Принято X / 6</strong> — количество обязательств, у которых подтверждены все исходные критерии.</div><p>Оценки в колесе баланса не прибавляются к проценту. Календарная шкала показывает время до встречи, а не сделанную работу. Промежуточные сроки задаёшь ты.</p>`);}
 function radar(w){
  const vals=D.wheelAreas.map(a=>w.ratings[a.id]);const full=vals.every(v=>typeof v==='number');const cx=170,cy=156,r=100;
  const xy=(i,f)=>[cx+Math.cos(-Math.PI/2+i*Math.PI/3)*r*f,cy+Math.sin(-Math.PI/2+i*Math.PI/3)*r*f];
  const poly=f=>D.wheelAreas.map((_,i)=>xy(i,f).join(',')).join(' ');
  return `<svg class="radar" viewBox="0 0 340 316" role="img" aria-label="Колесо жизненного баланса. ${full?'Оценены все шесть сфер.':'Не все сферы оценены; отсутствующие значения не заменяются нулями.'}">${[.2,.4,.6,.8,1].map(f=>`<polygon points="${poly(f)}" fill="${f===1?'#f6f9f3':'none'}" stroke="#dce7d8"/>`).reverse().join('')}${D.wheelAreas.map((a,i)=>{const [x,y]=xy(i,1);return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#dce7d8"/>`;}).join('')}${full?`<polygon points="${vals.map((v,i)=>xy(i,v/10).join(',')).join(' ')}" fill="#42796526" stroke="#347260" stroke-width="2"/>`:''}${vals.map((v,i)=>{if(typeof v!=='number')return '';const [x,y]=xy(i,v/10);return `<circle cx="${x}" cy="${y}" r="3.5" fill="#347260"><title>${E(D.wheelAreas[i].label)}: ${v}</title></circle>`;}).join('')}${D.wheelAreas.map((a,i)=>{const [x,y]=xy(i,1.24);const anchor=i===0||i===3?'middle':i<3?'start':'end';return `<text x="${x}" y="${y+4}" text-anchor="${anchor}">${a.id==='growth'?'Развитие':E(a.label)}</text>`;}).join('')}${!full?`<text x="${cx}" y="${cy}" text-anchor="middle" style="font-size:9px">${vals.filter(v=>typeof v==='number').length} / 6 оценок</text>`:''}</svg>`;
 }
 function wheelModal(){if(!own())return;const w=B.state.wheel;showModal('wheel','Колесо жизненного баланса',`<p>Личная оценка удовлетворённости сферами от 0 до 10. Это не диагностика. Пустое поле означает «не оценено».</p><form data-form="wheel"><div class="wheel-layout"><div id="radar-wrap">${radar(w)}</div><div>${D.wheelAreas.map(a=>`<div class="wheel-field"><label for="wheel-${a.id}">${E(a.label)}</label><input type="number" min="0" max="10" step="1" id="wheel-${a.id}" name="${a.id}" data-wheel-value="${a.id}" value="${w.ratings[a.id]===null?'':w.ratings[a.id]}" placeholder="—"></div>`).join('')}<p class="wheel-scale">0 — совсем не удовлетворён<br>10 — полностью удовлетворён</p></div></div><div class="field" style="margin-top:15px"><label for="reflection">Какие перекосы я замечаю</label><textarea id="reflection" name="reflection" maxlength="4000" placeholder="Личная заметка. Участники мастермайнда её не увидят.">${E(w.reflection)}</textarea></div><div class="privacy-label">${icon('lock')} Оценки и заметка доступны только владельцу</div><p class="tiny muted">Сохранение оценок не отмечает шаги и критерии автоматически. Их подтверждаешь отдельно.</p><div class="modal-actions"><button type="submit" class="btn primary">${icon('check')}Сохранить оценки</button></div></form>`,true);}
 async function shareModal(){
  if(LOCAL){showModal('share','Совместный доступ',`<div class="notice warning"><strong>Этот файл пока не является общей онлайн-страницей.</strong><br>Отметки хранятся только в текущем браузере. Пересылка HTML не синхронизирует прогресс.</div><p>Для единого актуального прогресса предназначена серверная версия из комплекта. После публикации здесь появятся одноразовые приглашения, учётные записи участников и просмотр актуального прогресса.</p><p>Сейчас группе можно отправить текстовый отчёт на текущую дату. Он не включает оценки баланса и личную заметку.</p><div class="modal-actions">${btn('Скачать отчёт','download-report','download','primary')}${btn('Резервная копия','export','download')}</div>`);return;}
  if(!own())return;showModal('share','Участники мастермайнда','<p>Загружаем права доступа…</p>');
  try{const data=await api('/api/members');if(modal!=='share')return;
   showModal('share','Участники мастермайнда',`<p>Приглашённый участник видит прогресс. Изменять отметки и принимать результат можешь только ты.</p><form data-form="invite"><div class="field"><label for="invite-name">Кого приглашаем</label><input type="text" id="invite-name" name="name" maxlength="80" placeholder="Имя участника" required></div><button type="submit" class="btn primary">${icon('share')}Создать приглашение</button></form><div id="invite-output"></div><p class="tiny muted" style="margin-top:12px">Ссылка одноразовая, действует 7 дней. Отправляй её лично адресату. Пароль участник создаёт сам.</p><div class="inline-divider"></div><h3 style="font-size:13px;margin-bottom:9px">Активные участники</h3>${data.members.filter(u=>u.active).map(u=>`<div class="member-row"><div><strong>${E(u.name)}</strong><small>${u.role==='owner'?'Владелец · редактирование':'Участник · просмотр'}</small></div>${u.role==='member'?`<button class="btn quiet danger" data-revoke-member="${u.id}">Отозвать</button>`:'<span class="tag business">Ты</span>'}</div>`).join('')}${data.invites.length?`<h3 style="font-size:13px;margin:19px 0 8px">Ожидают входа</h3>${data.invites.map(i=>`<div class="member-row"><div>${E(i.name)}<small>До ${fmtDate(new Date(i.expires*1000).toISOString())}</small></div><button class="btn quiet danger" data-revoke-invite="${i.id}">Отозвать</button></div>`).join('')}`:''}`);
  }catch(e){toast(e.message,true);closeOverlay(true);}
 }
 function report(){const m=stats();return ['ДЕКЛАРАЦИЯ · ОТЧЁТ ДЛЯ МАСТЕРМАЙНДА',D.author,'Отчёт на '+fmtDate(new Date().toISOString(),true),'Дедлайн: 31.10.2026','',`Прогресс действий: ${pct(m.progress)}`,`Принято результатов: ${m.completed} из 6`,`Отмечено шагов: ${m.doneSteps} из ${m.totalSteps}`,'',...D.goals.flatMap(g=>{const p=goalStats(g.id),s=B.state.goals[g.id];return [`${g.number}. ${g.title}`,`Статус: ${statusNames[p.status]}. Шаги: ${p.done}/${p.total}. Критерии: ${p.accepted}/${g.criteria.length}.`,...(p.complete?[`Подтверждено: ${fmtDate(s.completedAt,true)}.`]:[]),...(g.area==='business'&&s.proof?[`Подтверждение: ${s.proof}`]:[]),...(g.area==='business'&&s.proofUrl?[`Материал: ${s.proofUrl}`]:[]),''];}),'Личные оценки и содержание семейных разговоров в отчёт не включены.',LOCAL?'Это локальный снимок состояния, а не синхронизируемая онлайн-страница.':'Это снимок состояния на указанное время. Актуальный прогресс доступен в дашборде.','Методика: равный вес каждого обязательства; принятие результатов отдельно от подготовительных шагов.'].join('\n');}
 function download(name,text,type='text/plain;charset=utf-8'){
  const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
 }
 async function copy(text){try{await navigator.clipboard.writeText(text);toast('Скопировано');return true;}catch{return false;}}
 async function exportData(){if(!own())return;try{const data=LOCAL?{...B,format:'declaration-board-v1',exportedAt:new Date().toISOString()}:await api('/api/export');download('declaration-backup-'+C.today()+'.json',JSON.stringify(data,null,2),'application/json');toast('Резервная копия создана. Она содержит личные оценки.');}catch(e){toast(e.message,true);}}
 function importData(){if(!own())return;const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{const file=input.files[0];if(!file)return;try{if(file.size>2_000_000)throw new Error('Файл слишком большой.');const data=JSON.parse(await file.text());if(data.format!=='declaration-board-v1'||data.declaration?.id!==D.id)throw new Error('Это резервная копия другой декларации.');const state=validateImported(data.state);if(!confirm('Заменить текущие отметки, сроки и личные оценки данными из файла? История из файла не импортируется.'))return;closeOverlay(true);await changeState(s=>{s.goals=state.goals;s.wheel=state.wheel;},'Отметки импортированы. История не заменена.');}catch(e){toast(e.message,true);}};input.click();}
 function menuModal(){showModal('menu','Действия',`<div class="menu-grid">${btn('Отчёт для мастермайнда','report','file')}${own()?`${btn('Скачать резервную копию','export','download')}${btn('Импортировать отметки из копии','import','upload')}`:''}${btn('Методика расчёта','method','info')}${!LOCAL?btn('Выйти из аккаунта','logout','logout','quiet'):''}</div><p class="tiny muted" style="margin:17px 0 0">Резервная копия владельца включает личные оценки баланса. Для группы используй отчёт, а не резервную копию.</p>`);}
 function reportModal(){showModal('report','Отчёт для мастермайнда',`<p>Снимок текущего состояния. Личные оценки и заметка колеса баланса исключены.</p><textarea id="report-content" class="report-text" readonly>${E(report())}</textarea><div class="modal-actions">${btn('Скачать .txt','download-report','download')}${btn('Скопировать','copy-report','copy','primary')}</div>`,true);}
 async function refresh(silent=false){
  if(LOCAL||saving||!B)return;
  try{const next=await api('/api/board');const changed=next.version!==B.version;B=next;lastSync=new Date();sync='saved';updateStatus();
   if(changed&&!dirty&&!modal){render();if(drawer)renderDrawer();}
   if(!silent)toast('Данные обновлены');
  }catch(e){if(e.status===401){B=null;drawer=null;modal=null;$('#overlay').innerHTML='';document.body.style.overflow='';await bootServer();return;}
   sync='offline';updateStatus();if(!silent)toast('Не удалось обновить данные. Последняя загруженная версия остаётся на экране.',true);
  }
 }
 function showAuth(setupRequired=false){
  const joining=Boolean(inviteToken);const mode=joining?'join':setupRequired?'setup':'login';
  $('#app').innerHTML=`<div class="auth-wrap"><section class="auth-story"><span class="brand-mark">М</span><h1>Обещания —<br>в действия.<br>Действия —<br>в результат.</h1><p>Закрытое пространство мастермайнда: понятные обязательства, видимый прогресс и поддержка группы.</p></section><main class="auth-card" id="main"><form data-form="auth" data-mode="${mode}"><span class="eyebrow">ДЕКЛАРАЦИЯ · МАСТЕРМАЙНД</span><h2 style="margin-top:12px">${joining?'Присоединиться':setupRequired?'Настроить доступ':'С возвращением'}</h2><p>${joining?'Тебя пригласили наблюдать за выполнением обязательств.':setupRequired?'Первый вход владельца. Код настройки доступен администратору приложения.':'Войди, чтобы увидеть актуальный прогресс декларации.'}</p>${mode==='setup'?'<div class="field"><label for="auth-code">Код первичной настройки</label><input id="auth-code" name="code" type="password" required autocomplete="off"></div>':''}${mode!=='login'?'<div class="field"><label for="auth-name">Имя для группы</label><input id="auth-name" name="name" type="text" maxlength="80" required autocomplete="name"></div>':''}<div class="field"><label for="auth-username">Логин</label><input id="auth-username" name="username" type="text" autocomplete="username" pattern="[a-zA-Z0-9_.-]{3,40}" required>${mode!=='login'?'<small>Латинские буквы и цифры, от 3 до 40 символов.</small>':''}</div><div class="field"><label for="auth-password">Пароль</label><input id="auth-password" name="password" type="password" autocomplete="${mode==='login'?'current-password':'new-password'}" ${mode==='login'?'':'minlength="12"'} maxlength="200" required>${mode!=='login'?'<small>Не менее 12 символов.</small>':''}</div><div class="error-msg" id="auth-error" role="alert"></div><button class="btn primary" type="submit">${mode==='login'?'Войти':mode==='setup'?'Создать рабочее пространство':'Принять приглашение'}${icon('arrow')}</button><p class="auth-note">${mode==='login'?'Нет доступа? Владелец декларации выдаёт персональное приглашение.':joining?'Участник может просматривать прогресс, но не менять выполнение.':'Данные не открываются анонимным посетителям.'}</p></form></main></div>`;
 }
 async function bootServer(){try{const s=await api('/api/session');csrf=s.csrf;if(s.user){B=await api('/api/board');D=B.declaration;lastSync=new Date();inviteToken=null;render();}else showAuth(s.setupRequired);}catch(e){$('#app').innerHTML=`<div class="loading"><div style="max-width:420px;padding:25px"><h2 style="font-size:20px;margin-bottom:12px">Нет соединения с приложением</h2><p>${E(e.message)}</p><p style="margin:14px 0">Эта страница требует работающего сервера. Для открытия без сервера используй отдельный файл «Декларация — локальная версия.html».</p>${btn('Повторить','retry','refresh','primary')}</div></div>`;}}
 // All dynamic copy is escaped. Event delegation survives re-renders.
 document.addEventListener('click',async e=>{
  const el=e.target.closest('button,[data-action="close"]');if(!el)return;
  if(el.dataset.view){if(dirty&&!confirm('Не сохранённый текст будет потерян. Продолжить?'))return;closeOverlay(true);view=el.dataset.view;render();window.scrollTo({top:0,behavior:'instant'});return;}
  if(el.dataset.filter){filter=el.dataset.filter;render();return;}
  if(el.dataset.goal){openGoal(el.dataset.goal);return;}
  if(el.dataset.tab){if(dirty&&!confirm('Не сохранённый текст будет потерян. Перейти?'))return;dirty=false;drawer.tab=el.dataset.tab;renderDrawer();return;}
  if(el.dataset.revokeMember){if(!confirm('Отозвать доступ участника? Его текущие сессии также завершатся.'))return;try{await api('/api/members/'+el.dataset.revokeMember,'DELETE',{});await shareModal();toast('Доступ отозван');}catch(err){toast(err.message,true);}return;}
  if(el.dataset.revokeInvite){try{await api('/api/invites/'+el.dataset.revokeInvite,'DELETE',{});await shareModal();toast('Приглашение отозвано');}catch(err){toast(err.message,true);}return;}
  switch(el.dataset.action){
   case'close':closeOverlay();break;
   case'purpose':showModal('purpose','Я делаю это для того, чтобы',`<p style="font-size:15px;color:var(--ink)">${E(D.purpose)}</p><span class="tiny muted">Из подписанной декларации от 15.08.2026</span>`);break;
   case'method':methodModal();break;
   case'share':await shareModal();break;
   case'menu':menuModal();break;
   case'wheel':wheelModal();break;
   case'tab-result':drawer.tab='result';renderDrawer();break;
   case'report':reportModal();break;
   case'copy-report':if(!await copy($('#report-content').value)){$('#report-content').focus();$('#report-content').select();toast('Текст выделен. Скопируй его сочетанием клавиш.');}break;
   case'download-report':download('mastermind-report-'+C.today()+'.txt',report());break;
   case'export':await exportData();break;
   case'import':importData();break;
   case'copy-invite':if(!await copy($('#invite-link').value)){$('#invite-link').select();toast('Ссылка выделена для копирования.');}break;
   case'print':closeOverlay(true);view='document';render();setTimeout(()=>window.print(),60);break;
   case'refresh':await refresh();break;
   case'retry':await bootServer();break;
   case'logout':try{await api('/api/logout','POST',{});B=null;csrf=null;drawer=null;modal=null;$('#overlay').innerHTML='';document.body.style.overflow='';await bootServer();}catch(err){toast(err.message,true);}break;
  }
 });
 document.addEventListener('change',async e=>{
  const el=e.target;
  if(el.dataset.stateCheck&&drawer&&dirty){el.checked=B.state.goals[drawer.id][el.dataset.stateCheck][el.dataset.id];toast('Сначала сохрани текст подтверждения. Черновик оставлен без изменений.',true);return;}
  if(el.dataset.stateCheck&&drawer){const kind=el.dataset.stateCheck,id=el.dataset.id,value=el.checked,gid=drawer.id;await changeState(s=>s.goals[gid][kind][id]=value,kind==='criteria'?'Критерий обновлён':'Шаг обновлён');}
  if(el.dataset.due&&drawer){const id=el.dataset.due,value=el.value,gid=drawer.id;await changeState(s=>s.goals[gid].dates[id]=value,'Срок сохранён');}
 });
 document.addEventListener('input',e=>{
  if(e.target.matches('textarea,input[type=text],input[type=url],input[type=number]')&&$('#overlay')?.contains(e.target))dirty=true;
  if(e.target.dataset.wheelValue){const w={ratings:{},reflection:''};for(const a of D.wheelAreas){const raw=$(`[data-wheel-value="${a.id}"]`).value;w.ratings[a.id]=raw===''?null:Math.max(0,Math.min(10,Number(raw)));}$('#radar-wrap').innerHTML=radar(w);}
 });
 document.addEventListener('submit',async e=>{
  const f=e.target;if(!f.dataset.form)return;e.preventDefault();const submit=f.querySelector('button[type=submit]');if(submit?.disabled)return;if(submit)submit.disabled=true;
  try{
   const fd=new FormData(f);
   if(f.dataset.form==='auth'){
    const payload=Object.fromEntries(fd);if(f.dataset.mode==='join')payload.token=inviteToken;
    await api('/api/'+f.dataset.mode,'POST',payload);inviteToken=null;await bootServer();
   }else if(f.dataset.form==='proof'){
    const gid=drawer.id,url=String(fd.get('proofUrl')).trim();if(url&&!C.safeUrl(url))throw new Error('Поддерживаются ссылки https://.');
    await changeState(s=>{s.goals[gid].proof=String(fd.get('proof')).trim();s.goals[gid].proofUrl=url;},'Подтверждение сохранено');
   }else if(f.dataset.form==='wheel'){
    const ratings={};for(const a of D.wheelAreas){const raw=String(fd.get(a.id));ratings[a.id]=raw===''?null:Number(raw);}
    const ok=await changeState(s=>s.wheel={ratings,reflection:String(fd.get('reflection'))},'Личные оценки сохранены');if(ok){dirty=false;if(modal==='wheel')closeOverlay(true);}
   }else if(f.dataset.form==='invite'){
    const data=await api('/api/invites','POST',{name:String(fd.get('name')).trim()});const url=location.origin+location.pathname+'#invite='+encodeURIComponent(data.token);
    $('#invite-output').innerHTML=`<div class="invite-result"><strong>Приглашение для ${E(data.name)}</strong><div class="field" style="margin:10px 0 7px"><input id="invite-link" type="text" readonly value="${E(url)}" aria-label="Ссылка-приглашение"></div>${btn('Скопировать ссылку','copy-invite','copy')}<p class="tiny" style="margin-top:9px">Действует до ${fmtDate(new Date(data.expires*1000).toISOString())}. После закрытия ссылка повторно не показывается.</p></div>`;dirty=false;toast('Приглашение создано');
   }
  }catch(err){if(f.dataset.form==='auth'){const box=$('#auth-error');if(box)box.textContent=err.message;}else toast(err.message,true);}finally{if(submit&&submit.isConnected)submit.disabled=false;}
 });
 document.addEventListener('keydown',e=>{
  if(!drawer&&!modal)return;
  if(e.key==='Escape'){e.preventDefault();closeOverlay();}
  if(e.key==='Tab'){
   const box=$('.modal')||$('.drawer');if(!box)return;const els=[...box.querySelectorAll('button:not(:disabled),a,input:not(:disabled),textarea,select,summary,[tabindex="0"]')].filter(x=>x.offsetParent!==null);
   if(!els.length)return;const first=els[0],last=els.at(-1);
   if(e.shiftKey&&(document.activeElement===first||!box.contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!box.contains(document.activeElement))){e.preventDefault();first.focus();}
  }
 });
 window.addEventListener('beforeunload',e=>{if(saving||dirty){e.preventDefault();e.returnValue='';}});
 window.addEventListener('storage',e=>{if(LOCAL&&e.key===KEY&&e.newValue&&!saving&&!dirty){try{const data=JSON.parse(e.newValue);B={...B,...data,state:validateImported(data.state)};render();if(drawer&&!modal)renderDrawer();toast('Данные обновлены из другой вкладки этого браузера');}catch{toast('Не удалось прочитать изменение из другой вкладки.',true);}}});
 if(LOCAL){
  D=window.LOCAL_DECLARATION;B={declaration:D,user:{id:0,username:'maxim',name:'Максим',role:'owner'},state:C.initial(D),version:0,updatedAt:null,history:[]};
  try{const saved=localStorage.getItem(KEY);if(saved){const data=JSON.parse(saved);B={...B,...data,state:validateImported(data.state)};if(!Array.isArray(B.history))throw new Error('Некорректная история.');}}
  catch(e){storageError=true;sync='error';setTimeout(()=>toast('Локальное хранилище недоступно или копия повреждена. Старые данные не перезаписаны.',true),300);}
  render();
 }else{
  const hash=new URLSearchParams(location.hash.slice(1));inviteToken=hash.get('invite');
  if(inviteToken)history.replaceState(null,'',location.pathname+location.search);
  await bootServer();
  setInterval(()=>{if(!document.hidden)refresh(true);},12000);
 }
})();
