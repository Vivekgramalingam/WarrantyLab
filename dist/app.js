'use strict';
const $ = s => document.querySelector(s);
const icons = {
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  building:'<path d="M4 21V8l8-5 8 5v13M2 21h20M9 21v-6h6v6M8 9h1m6 0h1M8 12h1m6 0h1"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  sliders:'<path d="M4 6h7m5 0h4M4 12h2m5 0h9M4 18h10m5 0h1"/><circle cx="13" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
  book:'<path d="M12 5v16M12 5C8 2 4 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-2-1-6-2-10 1Z"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  dollar:'<path d="M12 2v20m5-16H9a4 4 0 0 0 0 8h6a4 4 0 0 1 0 8H6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  repeat:'<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3"/>',
  file:'<path d="M14 2H5v20h14V7Zm0 0v5h5M8 12h8m-8 4h8"/>',
  spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.file}</svg>`;
document.querySelectorAll('[data-icon]').forEach(x => x.innerHTML = icon(x.dataset.icon));
const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const compact = n => n >= 1e6 ? '$'+(n/1e6).toFixed(2)+'M' : n >= 1000 ? '$'+(n/1000).toFixed(1)+'K' : money(n);
const num = n => new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n);
const pct = n => (n*100).toFixed(1)+'%';
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data, rows=[], view='overview', claimPage=1, search='', flagFilter='', dealerSort='repeat';
const filters = { period:'', dealer:'', model:'', component:'' };
const sim = { repeat:25, parts:5, time:10, implementation:25000 };
const pages = {
  overview:['Overview','WARRANTY & SERVICE ANALYTICS','A clearer view of service.','Find the cost drivers. Understand the repairs. Decide what comes next.'],
  dealers:['Dealer performance','NETWORK INTELLIGENCE','See the story behind the score.','Compare repair outcomes, sample sizes, and component-adjusted peer expectations.'],
  claims:['Claims explorer','CLAIM-LEVEL INVESTIGATION','Follow the signal to the source.','Search completed repairs and understand exactly why a claim was flagged.'],
  scenario:['Scenario lab','WHAT-IF ANALYSIS','Small changes. Measurable possibilities.','Explore potential savings with transparent assumptions—not a predictive forecast.'],
  guide:['Project guide','BUILD & LEARN','From dashboard to portfolio.','Understand the analysis, explore the source, and recreate it in Power BI.'],
};
function toast(text) { $('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3000); }
function navigate(page) {
  if(!pages[page]) page='overview'; view=page; history.replaceState(null,'','#'+page);
  document.querySelectorAll('[data-page]').forEach(x=>{x.classList.toggle('active',x.dataset.page===page);x.setAttribute('aria-current',x.dataset.page===page?'page':'false');});
  [$('#crumb'),$('#eyebrow'),$('#page-title'),$('#page-subtitle')].forEach((x,i)=>x.textContent=pages[page][i]);
  $('#filterbar').hidden=page==='guide'; $('#filterbar').style.display=page==='guide'?'none':'';
  $('#reset-button').style.display=page==='guide'?'none':'';
  $('#export-button').innerHTML=icon('download')+(page==='guide'?'Download kit':'Export data');
  render();
  window.scrollTo(0, 0);
}
function render() {
  if(!data) return;
  rows=Lab.filter(data.claims,filters);
  $('#result-count').textContent=num(rows.length)+' claims';
  $('#flag-nav').textContent=num(Lab.metrics(rows).flagged);
  if(view==='overview') renderOverview();
  if(view==='dealers') renderDealers();
  if(view==='claims') renderClaims();
  if(view==='scenario') renderScenario();
  if(view==='guide') renderGuide();
}
function kpis() {
  const m=Lab.metrics(rows);
  return `<section class="kpi-grid" aria-label="Key performance indicators">
    <article class="kpi"><div class="kpi-label">Claimed warranty cost ${icon('dollar')}</div><div class="kpi-value" title="${money(m.cost)}">${compact(m.cost)}</div><div class="kpi-note"><span class="pill">USD</span>Parts + labor · submitted claims</div></article>
    <article class="kpi"><div class="kpi-label">Repair claims ${icon('file')}</div><div class="kpi-value">${num(m.n)}</div><div class="kpi-note"><span class="pill">Completed</span>${num(new Set(rows.map(x=>x.vehicle_id)).size)} vehicles with repairs</div></article>
    <article class="kpi"><div class="kpi-label">Avg. repair turnaround ${icon('clock')}</div><div class="kpi-value">${m.n?m.avgHours.toFixed(1):'—'}<small>hrs</small></div><div class="kpi-note">Elapsed time · open to close</div></article>
    <article class="kpi"><div class="kpi-label">Repeat repair rate ${icon('repeat')}</div><div class="kpi-value">${m.n?pct(m.repeatRate):'—'}</div><div class="kpi-note"><span class="pill warn">30-day window</span>${num(m.repeats)} repeat repairs</div></article>
  </section>`;
}
function monthlyChart() {
  const grouped=Lab.group(rows,'month');
  const months=Array.from({length:9},(_,i)=>'2026-'+String(i+1).padStart(2,'0')).filter(m=>!filters.period||(filters.period==='Q1'&&m<='2026-03')||(filters.period==='Q2'&&m>='2026-04'&&m<='2026-06')||(filters.period==='Q3'&&m>='2026-07'));
  const vals=months.map(month=>({month,cost:grouped.find(g=>g.name===month)?.cost||0}));
  const max=Math.max(...vals.map(x=>x.cost),1)*1.2,W=600,H=205,left=54,right=16,top=14,bottom=32;
  const pw=W-left-right,ph=H-top-bottom;
  const points=vals.map((x,i)=>[left+(i+.5)*pw/vals.length,top+ph-(x.cost/max)*ph]);
  const line=points.map((p,i)=>(i?'L':'M')+p.join(',')).join(' ');
  const area=`M${points[0][0]},${top+ph} ${line.replace(/^M/,'L')} L${points.at(-1)[0]},${top+ph}Z`;
  return `<svg class="trend-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly claimed warranty cost. ${vals.map(x=>x.month+': '+money(x.cost)).join('; ')}">
  <defs><linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#bbd198" stop-opacity=".37"/><stop offset="100%" stop-color="#edf4df" stop-opacity=".15"/></linearGradient></defs>
  ${[0,1,2,3].map(i=>{const y=top+ph-i*ph/3;return `<line x1="${left}" y1="${y}" x2="${W-right}" y2="${y}" stroke="#e7ecdf" stroke-dasharray="3 4"/><text x="${left-9}" y="${y+3}" text-anchor="end" fill="#9ca88d" font-size="9">${compact(max*i/3)}</text>`;}).join('')}
  <path d="${area}" fill="url(#area-fill)"/><path d="${line}" fill="none" stroke="#547d4b" stroke-width="2.5" stroke-linejoin="round"/>
  ${points.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="white" stroke="#5a824b" stroke-width="2"><title>${vals[i].month}: ${money(vals[i].cost)}</title></circle><text x="${p[0]}" y="${H-8}" text-anchor="middle" fill="#8c9b7a" font-size="10">${new Date(vals[i].month+'-15T12:00:00').toLocaleDateString('en-US',{month:'short'})}</text>`).join('')}
  </svg>`;
}
function componentChart() {
  const groups=Lab.group(rows,'component').sort((a,b)=>b.cost-a.cost), max=Math.max(...groups.map(x=>x.cost),1);
  if(!groups.length) return '<div class="empty">No claims match these filters.</div>';
  return `<div class="bar-chart">${groups.map(g=>`<button class="bar-row" data-component="${g.name}" aria-label="Filter to ${g.name}, ${money(g.cost)}"><span class="bar-name">${g.name}</span><div class="bar-track"><div class="bar-fill" style="width:${g.cost/max*100}%"></div></div><span class="bar-value">${compact(g.cost)}</span></button>`).join('')}</div>`;
}
function dealerStats() {
  const pool=Lab.filter(data.claims,filters,true);
  return Lab.group(rows,'dealer_id').map(g=>({...g,...data.dealers.find(d=>d.dealer_id===g.name),peer:Lab.benchmark(g.items,pool.filter(x=>x.dealer_id!==g.name))}));
}
function dealerTable(full=false) {
  let ds=dealerStats();
  if(full&&dealerSort==='cost') ds.sort((a,b)=>b.cost-a.cost); else if(full&&dealerSort==='time') ds.sort((a,b)=>b.avgHours-a.avgHours); else ds.sort((a,b)=>b.repeatRate-a.repeatRate);
  if(!full) ds=ds.slice(0,5);
  return `<div class="table-wrap"><table><thead><tr><th>DEALER</th><th class="numeric">CLAIMS</th>${full?'<th class="numeric">CLAIMED COST</th>':''}<th class="numeric">AVG. HOURS</th><th class="numeric">REPEAT RATE</th>${full?'<th class="numeric">PEER EXPECTED</th>':''}<th>REVIEW SIGNAL</th></tr></thead><tbody>${ds.length?ds.map(d=>`<tr><td><button class="row-button dealer-cell" data-dealer="${d.dealer_id}" title="Explore claims for ${d.dealer}"><span class="dealer-avatar">${d.dealer.split(' ').slice(0,2).map(w=>w[0]).join('')}</span><span>${d.dealer}${full?`<small>${d.region}</small>`:''}</span></button></td><td class="numeric">${num(d.n)}</td>${full?`<td class="numeric">${compact(d.cost)}</td>`:''}<td class="numeric">${d.avgHours.toFixed(1)}</td><td class="numeric">${pct(d.repeatRate)}<span class="risk-track ${d.repeatRate>.08?'high':''}"><i style="width:${Math.min(d.repeatRate*500,100)}%"></i></span></td>${full?`<td class="numeric">${d.peer.rate===null?'—':pct(d.peer.rate)}<div class="peer-line">${num(d.peer.covered)}/${num(d.n)} covered</div></td>`:''}<td>${d.n<30?'<span class="pill neutral">Small sample</span>':d.peer.rate!==null&&d.repeatRate>d.peer.rate+.02?'<span class="pill warn">Review repeats</span>':'<span class="pill green">Monitor</span>'}</td></tr>`).join(''):`<tr><td colspan="7" class="empty">No dealers match these filters.</td></tr>`}</tbody></table></div>`;
}
function renderOverview() {
  const m=Lab.metrics(rows), gs=Lab.group(rows,'component').sort((a,b)=>b.cost-a.cost), top=gs[0];
  const repeats=Lab.group(rows,'dealer').sort((a,b)=>b.repeatRate-a.repeatRate)[0];
  const high=rows.filter(x=>x.high_cost).length, long=rows.filter(x=>x.long_repair).length;
  $('#screen').innerHTML=kpis()+`<div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h2>Warranty cost over time</h2><p class="panel-subtitle">Completed repair claims, grouped by opened month</p></div><span class="legend"><i></i>Claimed cost</span></div><div class="chart-wrap">${monthlyChart()}</div><div class="chart-note"><span>Average claim <b>${m.n?money(m.avgCost):'—'}</b></span><span>Hover over a point for its value</span></div></section><section class="panel"><div class="panel-head"><div><h2>Where the cost sits</h2><p class="panel-subtitle">Claimed cost by component</p></div><span class="tiny-label">USD</span></div>${componentChart()}<div class="panel-footnote">Select a bar to explore that component ↗</div></section></div>
  <section class="insight-strip"><span class="insight-icon">${icon('spark')}</span><div><strong>${top?`${top.name} accounts for ${pct(top.cost/m.cost)} of selected claim costs.`:'No claims in this selection.'}</strong><p>${top?`${num(top.n)} repairs · ${money(top.avgCost)} per claim. Check frequency and repair mix before assigning a cause.`:'Reset the filters to return to the full sample dataset.'}</p></div><button class="text-button" data-go="claims">Explore claims ↗</button></section>
  <div class="lower-grid"><section class="panel"><div class="panel-head table-head"><div><h2>Dealer performance at a glance</h2><p class="panel-subtitle">Highest repeat rates in the current selection</p></div><button class="text-button" data-go="dealers">View all ↗</button></div>${dealerTable()}<div class="table-foot"><span>30-day repeats · one claim per completed repair</span><span>Select a dealer to investigate</span></div></section>
  <section class="panel"><div class="panel-head"><div><h2>Your investigation queue</h2><p class="panel-subtitle">Signals to review, not conclusions</p></div><span class="pill warn">${num(m.flagged)} claims</span></div><div class="priority-list">
  <div class="priority"><span class="priority-number">01</span><div><h3>Understand repeat repairs</h3><p>${repeats?`${repeats.name} has a ${pct(repeats.repeatRate)} repeat rate across ${num(repeats.n)} repairs in this selection.`:'No matching claims.'}</p><button class="text-button" data-flag="repeat">Inspect repeat claims →</button></div></div>
  <div class="priority"><span class="priority-number">02</span><div><h3>Review unusually high costs</h3><p>${num(high)} claims exceed 2.5× their component’s full-dataset median. Validate parts and labor detail.</p><button class="text-button" data-flag="cost">View cost outliers →</button></div></div>
  <div class="priority"><span class="priority-number">03</span><div><h3>Look into repair delays</h3><p>${num(long)} repairs took more than 72 elapsed hours. Check wait time and parts availability.</p><button class="text-button" data-flag="time">Explore long repairs →</button></div></div></div></section></div>`;
}
function renderDealers() {
  const ds=dealerStats(), m=Lab.metrics(rows);
  $('#screen').innerHTML=`<div class="dealer-mini-grid"><div class="panel metric-mini"><span>Dealers in view</span><strong>${ds.length}<small style="font-size:12px;color:#93a187;font-weight:400"> / 8</small></strong></div><div class="panel metric-mini"><span>Selected repeat repair rate</span><strong>${m.n?pct(m.repeatRate):'—'}</strong></div><div class="panel metric-mini"><span>Selected repair turnaround</span><strong>${m.n?m.avgHours.toFixed(1)+' hrs':'—'}</strong></div></div>
  <section class="panel"><div class="panel-head table-head"><div><h2>Compare the network</h2><p class="panel-subtitle">Peer expected rate accounts for each dealer’s component mix</p></div><select class="toolbar-select" id="dealer-sort" aria-label="Sort dealers"><option value="repeat" ${dealerSort==='repeat'?'selected':''}>Highest repeat rate</option><option value="cost" ${dealerSort==='cost'?'selected':''}>Highest total cost</option><option value="time" ${dealerSort==='time'?'selected':''}>Longest turnaround</option></select></div>${dealerTable(true)}<div class="table-foot"><span>Review signal: observed repeats exceed peer expectation by &gt;2 percentage points, with ≥30 claims.</span></div></section>
  <div class="explain-note"><strong>A fairer comparison, with limits.</strong> Each dealer’s expected rate applies other dealers’ component-level repeat rates to its own repair mix. Peers share the period, model, and component filters; the dealer filter does not restrict the peer pool. Components without peer observations are excluded. The covered count shows the denominator. Severity, mileage, and uncertainty are not adjusted.</div>
  <div class="two-col"><section class="panel guide-content"><h2>Read the signal</h2><div class="step"><span class="step-num">1</span><div><h3>Start with sample size</h3><p>A high percentage from a handful of repairs is unstable. Compare the claim count before deciding where to investigate.</p></div></div><div class="step"><span class="step-num">2</span><div><h3>Check the repair mix</h3><p>A complex repair mix can increase turnaround and cost. The peer rate adjusts for component mix only—not every source of complexity.</p></div></div></section><section class="panel guide-content"><h2>Turn a finding into an action</h2><div class="step"><span class="step-num">3</span><div><h3>Open the underlying claims</h3><p>Select a dealer, inspect repeat claim histories, and ask what diagnostic, parts, or process information would validate your hypothesis.</p></div></div><div class="step"><span class="step-num">4</span><div><h3>Define the follow-up</h3><p>Propose a targeted review, assign an owner, and compare future repair outcomes using a consistent definition and matched populations.</p></div></div></section></div>`;
  $('#dealer-sort').addEventListener('change',e=>{dealerSort=e.target.value;renderDealers();});
}
function renderClaims() {
  $('#screen').innerHTML=`<section class="panel"><div class="panel-head"><div><h2>Repair claim records</h2><p class="panel-subtitle">Search, filter, and open a record to see its context</p></div><span class="pill neutral">Synthetic</span></div><div class="table-toolbar"><input class="search-input" id="claim-search" aria-label="Search claims" placeholder="Search claim, vehicle, dealer, component…" value="${esc(search)}"><select class="toolbar-select" id="flag-filter" aria-label="Investigation filter"><option value="">All claims</option><option value="flagged">Any investigation flag</option><option value="repeat">Repeat repairs</option><option value="cost">High-cost claims</option><option value="time">Long repairs (&gt;72 hrs)</option></select></div><div id="claim-table"></div></section><div class="explain-note"><strong>How flags work:</strong> Repeat = same vehicle and component, within 30 days after a previous repair closed. High cost = more than 2.5× the component’s full-dataset median. Long repair = more than 72 elapsed hours. These are transparent demonstration rules, not predictions of fraud or confirmed quality issues.</div>`;
  $('#flag-filter').value=flagFilter;
  $('#claim-search').addEventListener('input',e=>{search=e.target.value;claimPage=1;updateClaims();});
  $('#flag-filter').addEventListener('change',e=>{flagFilter=e.target.value;claimPage=1;updateClaims();});
  updateClaims();
}
function getClaimRows() {
  const q=search.trim().toLowerCase();
  return rows.filter(x=>(!q||[x.claim_id,x.vehicle_id,x.dealer,x.component,x.model].some(v=>v.toLowerCase().includes(q)))&&
    (!flagFilter||(flagFilter==='flagged'&&x.flag_count)||(flagFilter==='repeat'&&x.repeat_30d)||(flagFilter==='cost'&&x.high_cost)||(flagFilter==='time'&&x.long_repair)))
    .sort((a,b)=>b.opened_at.localeCompare(a.opened_at)||b.claim_id.localeCompare(a.claim_id));
}
function flags(x) {
  return `${x.repeat_30d?'<span class="pill warn">Repeat</span> ':''}${x.high_cost?'<span class="pill red">High cost</span> ':''}${x.long_repair?'<span class="pill warn">Long repair</span>':''}${!x.flag_count?'<span class="pill neutral">—</span>':''}`;
}
function updateClaims() {
  const all=getClaimRows(), pages=Math.max(1,Math.ceil(all.length/12));claimPage=Math.min(claimPage,pages);
  const start=(claimPage-1)*12, show=all.slice(start,start+12);
  $('#claim-table').innerHTML=`<div class="table-wrap"><table><thead><tr><th>CLAIM / VEHICLE</th><th>OPENED</th><th>DEALER</th><th>COMPONENT</th><th class="numeric">CLAIM COST</th><th class="numeric">HOURS</th><th>FLAGS</th></tr></thead><tbody>${show.length?show.map(x=>`<tr><td><button class="row-button" data-claim="${x.claim_id}">${x.claim_id}</button><div class="peer-line">${x.vehicle_id} · ${x.model}</div></td><td>${x.opened_at.slice(0,10)}</td><td>${x.dealer}</td><td>${x.component}</td><td class="numeric">${money(x.total_cost)}</td><td class="numeric">${x.repair_hours.toFixed(1)}</td><td>${flags(x)}</td></tr>`).join(''):'<tr><td colspan="7" class="empty">No claims match your search. Try another term or reset your filters.</td></tr>'}</tbody></table></div><div class="table-foot"><span>${all.length?`${num(start+1)}–${num(Math.min(start+12,all.length))} of ${num(all.length)}`:'0'} matching claims · Select a claim ID for details</span><div class="pagination"><button id="prev-page" ${claimPage===1?'disabled':''} aria-label="Previous page">←</button><span>${claimPage} / ${pages}</span><button id="next-page" ${claimPage===pages?'disabled':''} aria-label="Next page">→</button></div></div>`;
  $('#prev-page').onclick=()=>{claimPage--;updateClaims();};$('#next-page').onclick=()=>{claimPage++;updateClaims();};
}
function openClaim(id) {
  const x=data.claims.find(x=>x.claim_id===id);if(!x)return;
  const prior=data.claims.find(y=>y.claim_id===x.prior_claim_id);
  $('#claim-detail').innerHTML=`<div class="dialog-head"><div><div class="eyebrow">REPAIR CLAIM DETAIL · SYNTHETIC</div><h2 id="dialog-title">${x.claim_id}</h2><p>${x.dealer} · ${x.region}</p></div><button class="close-button" id="close-dialog" aria-label="Close claim details">×</button></div><div class="dialog-body"><dl class="detail-grid">${[['Vehicle',`${x.vehicle_id} · ${x.model} (${x.model_year})`],['Component',x.component],['Opened',x.opened_at.replace('T',' ')],['Closed',x.closed_at.replace('T',' ')],['Parts cost',money(x.parts_cost)],['Labor cost',money(x.labor_cost)],['Claimed total',money(x.total_cost)],['Elapsed repair time',x.repair_hours.toFixed(1)+' hours'],['Mileage',num(x.mileage)+' mi'],['Review flags',x.flag_count+' of 3 rules']].map(([a,b])=>`<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl>
  ${x.repeat_30d?`<div class="flag-box"><strong>Repeat repair within 30 days</strong>Previous repair ${x.prior_claim_id} for this vehicle and component closed ${prior.closed_at.replace('T',' ')}. <button class="text-button" data-claim="${x.prior_claim_id}">Open prior claim →</button></div>`:''}
  ${x.high_cost?`<div class="flag-box"><strong>Above the component cost threshold</strong>${money(x.total_cost)} exceeds 2.5 × ${money(data.meta.component_medians[x.component])} (full-dataset component median).</div>`:''}
  ${x.long_repair?`<div class="flag-box"><strong>Long repair turnaround</strong>${x.repair_hours.toFixed(1)} elapsed hours exceeds the illustrative 72-hour threshold. Investigate waiting time before drawing a conclusion.</div>`:''}
  ${!x.flag_count?'<div class="explain-note">This record triggers none of the three illustrative review rules.</div>':''}<p class="dialog-note">Flags are investigation prompts. They do not establish fraud, poor dealer execution, or a confirmed product defect. Timestamps are synthetic local event times; no time-zone conversion is applied.</p></div>`;
  $('#close-dialog').onclick=()=>$('#claim-dialog').close();
  if(!$('#claim-dialog').open) $('#claim-dialog').showModal();
}
function renderScenario() {
  $('#screen').innerHTML=`<div class="scenario-layout"><section class="panel scenario-controls"><h2>Set your assumptions</h2><p>Applied to the current filter selection. Adjust a lever and watch the scenario update.</p>
  ${[['repeat','Prevent repeat repairs',50,'Share of repeat claims avoided. Assumes average repeat-claim cost and time.'],['parts','Reduce parts prices',20,'Discount on parts for repairs remaining after prevention.'],['time','Shorten remaining repairs',40,'Reduction in elapsed repair hours, not labor hours.']].map(([key,label,max,desc])=>`<div class="slider-block"><label class="slider-label" for="sim-${key}">${label}<output id="out-${key}" for="sim-${key}">${sim[key]}%</output></label><input type="range" id="sim-${key}" min="0" max="${max}" step="1" value="${sim[key]}"><p>${desc}</p></div>`).join('')}
  <div class="slider-block"><label class="slider-label" for="sim-implementation">One-time implementation cost</label><div class="cost-input"><span>$</span><input type="number" id="sim-implementation" min="0" max="10000000" step="1000" value="${sim.implementation}"></div><p>Deducted from the selected period’s gross opportunity.</p></div><button class="button secondary small" id="reset-scenario">Reset assumptions</button></section><div><div id="scenario-output"></div><p class="scenario-assumptions"><strong>Scenario, not forecast.</strong> No confidence interval, causal effect, or guaranteed savings is implied. Repair-event hours are summed and may overlap across vehicles. They are not fleet uptime or technician capacity. No time savings are monetized.</p><button class="button secondary" id="download-scenario">${icon('download')} Download scenario summary</button></div></div>`;
  ['repeat','parts','time','implementation'].forEach(key=>$('#sim-'+key).addEventListener('input',e=>{
    const max=key==='implementation'?10000000:Number(e.target.max);sim[key]=Math.min(max,Math.max(0,Number(e.target.value)||0));
    if(key!=='implementation') $('#out-'+key).textContent=sim[key]+'%';updateScenario();
  }));
  $('#reset-scenario').onclick=()=>{Object.assign(sim,{repeat:25,parts:5,time:10,implementation:25000});renderScenario();};
  $('#download-scenario').onclick=()=>{
    const result=Lab.scenario(rows,sim.repeat/100,sim.parts/100,sim.time/100,sim.implementation);
    download('warranty-scenario.json',JSON.stringify({synthetic:true,filters,assumptions:sim,results:result,limitations:'Illustrative scenario only; not forecast, guaranteed savings, annualized value, or measured fleet uptime. USD. Applies to selected repairs.'},null,2),'application/json');toast('Scenario summary downloaded');
  };
  updateScenario();
}
function updateScenario() {
  const r=Lab.scenario(rows,sim.repeat/100,sim.parts/100,sim.time/100,sim.implementation);
  $('#scenario-output').innerHTML=`<section class="scenario-result"><div class="eyebrow">NET SCENARIO OPPORTUNITY · USD</div><div class="big-result">${money(r.net)}</div><p>After ${money(sim.implementation)} implementation cost · selected period only</p><div class="scenario-split"><div><small>Gross cost opportunity</small><strong>${money(r.gross)}</strong></div><div><small>Repair-event hours avoided</small><strong>${num(r.avoidedHours)} <span style="font-size:13px">hrs</span></strong></div></div></section><section class="panel scenario-breakdown"><div class="panel-head table-head"><div><h2>Show the math</h2><p class="panel-subtitle">${num(r.n)} selected claims · ${num(r.repeats)} repeat repairs</p></div></div><div class="breakdown-row"><span>Current claimed cost</span><strong>${money(r.cost)}</strong></div><div class="breakdown-row"><span>Prevented repeat claim cost</span><strong>− ${money(r.repeatSavings)}</strong></div><div class="breakdown-row"><span>Parts savings on remaining repairs</span><strong>− ${money(r.partsSavings)}</strong></div><div class="breakdown-row"><span>Projected claim cost (before implementation)</span><strong>${money(r.projectedCost)}</strong></div></section><div class="explain-note"><strong>No double-counting:</strong> Parts discounts apply after removing the parts cost of prevented repeat repairs. Repair-time reductions apply only to remaining repair-event hours.</div>`;
}
const codeSnippets = {
  sql:`-- Monthly service KPIs (SQLite)\nSELECT month,\n       COUNT(*) AS repair_claims,\n       ROUND(SUM(total_cost), 2) AS claimed_cost,\n       ROUND(AVG(repair_hours), 1) AS avg_repair_hours,\n       ROUND(100.0 * AVG(repeat_30d), 2) AS repeat_pct\nFROM claims\nGROUP BY month\nORDER BY month;`,
  dax:`// Create each measure separately in Power BI.\nClaims = COUNTROWS(FactClaims)\n\nClaimed Warranty Cost = SUM(FactClaims[total_cost])\n\nAverage Repair Hours = AVERAGE(FactClaims[repair_hours])\n\nRepeat Repairs = SUM(FactClaims[repeat_30d])\n\nRepeat Repair Rate = DIVIDE([Repeat Repairs], [Claims])`,
  model:`DIMENSION                   RELATIONSHIP          FACT\nDimDealer[dealer_id]         1 → many              FactClaims[dealer_id]\nDimVehicle[vehicle_id]       1 → many              FactClaims[vehicle_id]\nDimDate[Date]               1 → many              FactClaims[OpenDate]\n\nGrain: one claim per completed repair event.\nUse single-direction filters from dimensions to facts.\nCreate OpenDate from opened_at; mark DimDate as a date table.\nUse dimension fields for slicers.\nRepeat flags use full history before report filtering.`,
};
function qualityChecks() {
  return [
    ['Unique claim IDs',new Set(data.claims.map(x=>x.claim_id)).size===data.claims.length],
    ['Cost reconciliation',data.claims.every(x=>x.parts_cost>=0&&x.labor_cost>=0&&Math.abs(x.total_cost-x.parts_cost-x.labor_cost)<.011)],
    ['Valid repair dates',data.claims.every(x=>x.closed_at>x.opened_at)],
    ['Linked dimensions',data.claims.every(x=>data.dealers.some(d=>d.dealer_id===x.dealer_id)&&data.vehicles.some(v=>v.vehicle_id===x.vehicle_id))],
  ];
}
function renderGuide() {
  $('#screen').innerHTML=`<section class="guide-hero"><div><div class="eyebrow" style="color:#b7cba1">YOUR HANDS-ON CASE STUDY</div><h2>Learn the methods.<br>Make the project your own.</h2><p>A complete, reproducible starting point: synthetic data, a working dashboard, SQL analyses, and Power BI reference measures.</p><a class="button" href="downloads/service-intelligence-project.zip" download>${icon('download')} Download project kit</a></div><div class="guide-stats"><div><strong>2,400</strong><span>Repair claims</span></div><div><strong>900</strong><span>Fictional vehicles</span></div><div><strong>8</strong><span>Dealer locations</span></div><div><strong>9</strong><span>Months of history</span></div></div></section>
  <div class="guide-grid"><section class="panel guide-content"><h2>Your first 15 minutes</h2><div class="step"><span class="step-num">01</span><div><h3>Follow the biggest cost driver</h3><p>Start in Overview. Select a component bar. Is total cost driven by repair volume or cost per repair?</p><button class="text-button" data-go="overview">Open overview →</button></div></div><div class="step"><span class="step-num">02</span><div><h3>Investigate a repeat repair</h3><p>Filter to Cooling, compare dealer repeat rates, and open a claim. Follow its previous repair ID to understand the 30-day rule.</p><button class="text-button" id="practice-repeat">Try this investigation →</button></div></div><div class="step"><span class="step-num">03</span><div><h3>Test a practical improvement</h3><p>Model a 25% reduction in repeat repairs and a 5% parts discount. Explain why parts savings must exclude prevented repairs.</p><button class="text-button" data-go="scenario">Open scenario lab →</button></div></div><div class="step"><span class="step-num">04</span><div><h3>Rebuild and add your own finding</h3><p>Import the CSVs into Power BI, create the star schema below, and add the DAX measures. Write one finding, one hypothesis, and one validation step.</p></div></div></section><section class="panel guide-content"><h2>Everything you need</h2>${[
    ['claims.csv','Repair claims','2,400 rows · costs, dates, flags','CSV'],['dealers.csv','Dealer dimension','8 fictional dealers · regions','CSV'],['vehicles.csv','Vehicle dimension','900 vehicles · model and year','CSV'],['warranty_lab.sqlite','Ready-to-query database','Claims and dimensions · SQLite','DB'],['analysis.sql','Analysis & validation','6 SQL analyses with definitions','SQL'],['measures.dax','Power BI reference','Measures and model setup notes','DAX'],['README.md','Project walkthrough','Metric contract, limitations, build path','MD'],['generate_data.py','Synthetic data generator','Deterministic Python · seed 260926','PY']
  ].map(([file,title,desc,tag])=>`<a class="resource" href="downloads/${file}" download><span><strong>${title}</strong><small>${desc}</small></span><span class="file-badge">${tag} ↓</span></a>`).join('')}</section></div>
  <section class="panel code-panel"><div class="panel-head"><div><h2>Under the dashboard</h2><p class="panel-subtitle">Reference code you can inspect, copy, and extend</p></div><button class="button small secondary" id="copy-code">Copy code</button></div><div class="code-tabs" role="tablist" aria-label="Code examples"><button class="code-tab active" role="tab" aria-selected="true" data-code="sql">SQL analysis</button><button class="code-tab" role="tab" aria-selected="false" data-code="dax">DAX measures</button><button class="code-tab" role="tab" aria-selected="false" data-code="model">Data model</button></div><pre id="code-sample" role="tabpanel">${esc(codeSnippets.sql)}</pre></section>
  <div class="quality-grid">${qualityChecks().map(([name,ok])=>`<div class="quality-item"><strong>${ok?'✓ Passed':'! Review'} · ${name}</strong><span>Calculated from the full dataset</span></div>`).join('')}</div>
  <section class="panel metric-dictionary"><div class="panel-head table-head"><h2>Definitions, assumptions & honest boundaries</h2></div><details><summary>What exactly do the KPIs measure?</summary><p>Claimed cost is parts plus labor in USD—not approved payments. Turnaround is elapsed time from opening to closure, not labor time. Repeat rate is the share of repairs with a previously closed repair on the same vehicle and component within 30 days. January has no pre-2026 history and can undercount repeats. Filters use the repair opening month. All repair records are completed.</p></details><details><summary>How is the dealer benchmark calculated?</summary><p>Other dealers’ component repeat rates are weighted by the selected dealer’s component mix. The peer pool respects period, model, and component filters, but ignores the dealer filter. Components without peer records are excluded, and covered volume is shown. A review signal appears when observed rate is more than 2 percentage points above expected with at least 30 claims. This threshold is illustrative, not statistically validated.</p></details><details><summary>Is this predictive AI, actual uptime, or real warranty data?</summary><p>No. The dataset is generated with a fixed random seed and intentionally planted patterns. Investigation flags are deterministic rules. The scenario tool is arithmetic, not machine learning or a forecast. Repair time alone cannot establish vehicle uptime, failure risk, or warranty reserves. There is no affiliation with Volvo, Mack, or any actual manufacturer or dealer.</p></details><details><summary>How do I use this responsibly in a portfolio?</summary><p>Describe it as a synthetic warranty analytics case study. Rebuild it in Power BI and add your own analysis before presenting it as independent work. Explain the metric definitions, validation, assumptions, and limits. Never claim production savings, customer outcomes, or industry employment from this demo. This site includes reference DAX, not an executed PBIX report.</p></details></section>`;
  let activeCode='sql';
  document.querySelectorAll('[data-code]').forEach(b=>b.onclick=()=>{activeCode=b.dataset.code;document.querySelectorAll('[data-code]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-selected',String(x===b));});$('#code-sample').textContent=codeSnippets[activeCode];});
  $('#copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(codeSnippets[activeCode]);toast('Code copied');}catch{const range=document.createRange();range.selectNodeContents($('#code-sample'));const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);toast('Code selected — use Copy to copy it');}};
  $('#practice-repeat').onclick=()=>{Object.assign(filters,{period:'',dealer:'',model:'',component:'Cooling'});syncFilters();flagFilter='repeat';search='';claimPage=1;navigate('claims');};
}
function download(name, content, type) {
  const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function exportData() {
  if(!data)return;
  if(view==='guide'){const a=document.createElement('a');a.href='downloads/service-intelligence-project.zip';a.download='service-intelligence-project.zip';a.click();return;}
  const selected=view==='claims'?getClaimRows():rows;
  if(!selected.length){toast('No matching data to export');return;}
  const fields=Object.keys(data.claims[0]);
  const cell=x=>'"'+String(x).replace(/"/g,'""')+'"';
  const csv=[fields.map(cell).join(','),...selected.map(r=>fields.map(f=>cell(r[f])).join(','))].join('\r\n');
  download('synthetic-warranty-claims.csv',csv,'text/csv;charset=utf-8');toast(num(selected.length)+' synthetic claims exported');
}
function syncFilters() {Object.entries(filters).forEach(([key,v])=>$('#'+key+'-filter').value=v);}
document.addEventListener('click',e=>{
  const page=e.target.closest('[data-page],[data-go]');if(page)navigate(page.dataset.page||page.dataset.go);
  const comp=e.target.closest('[data-component]');if(comp){filters.component=comp.dataset.component;syncFilters();claimPage=1;render();}
  const dealer=e.target.closest('[data-dealer]');if(dealer){filters.dealer=dealer.dataset.dealer;syncFilters();search='';flagFilter='';claimPage=1;navigate('claims');}
  const claim=e.target.closest('[data-claim]');if(claim)openClaim(claim.dataset.claim);
  const flag=e.target.closest('[data-flag]');if(flag){flagFilter=flag.dataset.flag;search='';claimPage=1;navigate('claims');}
});
Object.keys(filters).forEach(key=>$('#'+key+'-filter').addEventListener('change',e=>{filters[key]=e.target.value;claimPage=1;render();}));
$('#reset-button').onclick=()=>{Object.keys(filters).forEach(k=>filters[k]='');search='';flagFilter='';claimPage=1;syncFilters();render();toast('Filters reset');};
$('#export-button').onclick=exportData;
$('#help-button').onclick=$('#start-guide').onclick=()=>navigate('guide');
$('#claim-dialog').addEventListener('click',e=>{if(e.target===$('#claim-dialog'))$('#claim-dialog').close();});
window.addEventListener('hashchange',()=>navigate(location.hash.slice(1)));
async function init() {
  try {
    const res=await fetch('assets/data.json');if(!res.ok)throw new Error('Data unavailable');data=await res.json();
    data.dealers.forEach(d=>$('#dealer-filter').add(new Option(d.dealer,d.dealer_id)));
    [...new Set(data.claims.map(x=>x.model))].sort().forEach(v=>$('#model-filter').add(new Option(v,v)));
    [...new Set(data.claims.map(x=>x.component))].sort().forEach(v=>$('#component-filter').add(new Option(v,v)));
    navigate(location.hash.slice(1)||'overview');
  } catch(e) {$('#screen').innerHTML='<div class="empty"><h2>The sample data could not be loaded.</h2><p>Reload this page. For local use, serve the project folder as described in the README.</p></div>';$('#result-count').textContent='Data unavailable';}
}
init();
