const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const A=require('../dist/analytics.js');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/assets/data.json')));
const sample=[
 {total_cost:100,parts_cost:60,repair_hours:10,repeat_30d:1,flag_count:1},
 {total_cost:200,parts_cost:140,repair_hours:20,repeat_30d:0,flag_count:0},
];
const r=A.scenario(sample,1,.1,.5,5);
assert.equal(r.repeatSavings,100);
assert.equal(r.partsSavings,14); // Not 20: the prevented repair's parts are excluded.
assert.equal(r.net,109);
assert.equal(r.projectedCost,186);
assert.equal(r.avoidedHours,20); // 10 avoided + half of the remaining 20.
const base=A.scenario(sample,0,0,0,0);
assert.equal(base.gross,0);assert.equal(base.avoidedHours,0);
const all=A.scenario(sample,1,1,1,0);
assert.equal(all.gross,240);assert.equal(all.avoidedHours,30);
assert.equal(A.metrics([]).repeatRate,0);
const filters={period:'',dealer:'',model:'',component:''};
assert.equal(A.filter(data.claims,filters).length,2400);
const quarters=['Q1','Q2','Q3'].map(period=>A.filter(data.claims,{...filters,period}));
assert.equal(quarters.reduce((n,r)=>n+r.length,0),2400);
for(let i=0;i<3;i++)assert(quarters[i].every(r=>Math.floor((Number(r.month.slice(-2))-1)/3)===i));
const filtered=A.filter(data.claims,{...filters,dealer:'D01',component:'Cooling',period:'Q2'});
assert(filtered.every(x=>x.dealer_id==='D01'&&x.component==='Cooling'&&x.month>='2026-04'&&x.month<='2026-06'));
assert(A.filter(data.claims,{...filters,dealer:'D01'},true).length===2400);
const m=A.metrics(data.claims);
assert(Math.abs(A.group(data.claims,'component').reduce((s,g)=>s+g.cost,0)-m.cost)<.001);
const bench=A.benchmark([{component:'A'},{component:'A'},{component:'B'}],
 [{component:'A',repeat_30d:1,total_cost:0,repair_hours:0,parts_cost:0,flag_count:0},
  {component:'A',repeat_30d:0,total_cost:0,repair_hours:0,parts_cost:0,flag_count:0}]);
assert.equal(bench.covered,2);assert.equal(bench.rate,.5);
assert.equal(A.benchmark([],[]).rate,null);
console.log('PASS: scenario double-counting, zero cases, quarter filters, dealer peer pool, group totals, benchmark coverage.');
console.log(JSON.stringify({claims:m.n,cost:m.cost,repeat_rate:m.repeatRate,flags:m.flagged}));
