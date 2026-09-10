const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/core.js');
const D = require('../declaration.json');

test('six signed goals, no made-up progress', () => {
 const s=C.initial(D); const m=C.metrics(D,s);
 assert.equal(m.progress,0);assert.equal(m.completed,0);assert.equal(m.totalSteps,24);
});
test('each obligation has equal weight despite different step counts',()=>{
 const s=C.initial(D);
 D.goals[0].steps.forEach(x=>s.goals.g1.steps[x.id]=true);
 assert.equal(C.metrics(D,s).progress,100/6);
 const p=C.initial(D);p.goals.g5.steps.g5s1=true;
 assert.equal(C.metrics(D,p).progress,100/6);
});
test('steps alone never accept final result',()=>{
 const s=C.initial(D);D.goals.forEach(g=>g.steps.forEach(x=>s.goals[g.id].steps[x.id]=true));
 assert.equal(C.metrics(D,s).progress,100);assert.equal(C.metrics(D,s).completed,0);
});
test('only declared criteria determine result acceptance',()=>{
 const s=C.initial(D);D.goals[0].criteria.forEach(x=>s.goals.g1.criteria[x.id]=true);
 assert.equal(C.metrics(D,s).completed,1);
});
test('deadline is the Minsk calendar date, not browser timezone',()=>{
 assert.equal(C.daysLeft('2026-10-31','2026-10-30T22:00:00Z'),0);
 assert.equal(C.daysLeft('2026-10-31','2026-09-09T12:00:00Z'),52);
 assert.equal(C.daysLeft('2026-10-31','2026-11-01T12:00:00Z'),-1);
});
test('no divide by zero in wheel chart',()=>{
 const s=C.initial(D);assert.equal(C.wheelAverage(s.wheel),null);
 s.wheel.ratings.work=0;assert.equal(C.wheelAverage(s.wheel),0);
});
test('escape text and permit only https proof links',()=>{
 assert.equal(C.esc('<script>'), '&lt;script&gt;');
 assert.equal(C.safeUrl('javascript:alert(1)'), '');
 assert.equal(C.safeUrl('https://example.com/document'), 'https://example.com/document');
});
