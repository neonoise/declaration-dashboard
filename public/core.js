/* Shared, dependency-free presentation model. Dates use the declaration's Minsk time. */
(function (root) {
 'use strict';
 const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function initial(d) {
  return {goals:Object.fromEntries(d.goals.map(g=>[g.id,{steps:Object.fromEntries(g.steps.map(s=>[s.id,false])),criteria:Object.fromEntries(g.criteria.map(c=>[c.id,false])),dates:Object.fromEntries(g.steps.map(s=>[s.id,''])),proof:'',proofUrl:'',completedAt:null}])),wheel:{ratings:Object.fromEntries(d.wheelAreas.map(a=>[a.id,null])),reflection:''}};
 }
 function metrics(d,s) {
  const goals=d.goals.map(g=>{
   const v=s.goals[g.id];const done=g.steps.filter(x=>v.steps[x.id]).length;
   const accepted=g.criteria.filter(x=>v.criteria[x.id]).length;
   const percent=done/g.steps.length*100;
   const complete=accepted===g.criteria.length;
   return {id:g.id,done,total:g.steps.length,percent,accepted,complete,status:complete?'accepted':done===g.steps.length?'review':done||accepted?'active':'empty'};
  });
  return {goals,progress:goals.reduce((s,g)=>s+g.percent,0)/goals.length,completed:goals.filter(g=>g.complete).length,doneSteps:goals.reduce((s,g)=>s+g.done,0),totalSteps:goals.reduce((s,g)=>s+g.total,0)};
 }
 function today(value) { const d=value?new Date(value):new Date(); return new Date(d.getTime()+3*3600000).toISOString().slice(0,10); }
 function daysLeft(deadline,now) {return Math.round((Date.parse(deadline+'T00:00:00Z')-Date.parse(today(now)+'T00:00:00Z'))/86400000);}
 function safeUrl(s) {try {const u=new URL(s);return u.protocol==='https:'?u.href:'';}catch {return '';}}
 function wheelAverage(w) {const vals=Object.values(w?.ratings||{}).filter(v=>typeof v==='number'&&Number.isFinite(v));return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;}
 const api={initial,metrics,daysLeft,today,esc,safeUrl,wheelAverage};
 if(typeof module!=='undefined'&&module.exports) module.exports=api; else root.DeclarationCore=api;
})(typeof window!=='undefined'?window:globalThis);
