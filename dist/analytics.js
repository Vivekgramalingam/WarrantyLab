(function (root) {
  const sum = (xs, field) => xs.reduce((n, x) => n + x[field], 0);
  function metrics(rows) {
    const n = rows.length, cost = sum(rows, 'total_cost'), hours = sum(rows, 'repair_hours');
    const repeats = rows.filter(x => x.repeat_30d);
    return { n, cost, hours, avgCost: n ? cost / n : 0, avgHours: n ? hours / n : 0,
      repeats: repeats.length, repeatRate: n ? repeats.length / n : 0,
      repeatCost: sum(repeats, 'total_cost'), repeatParts: sum(repeats, 'parts_cost'),
      repeatHours: sum(repeats, 'repair_hours'), parts: sum(rows, 'parts_cost'),
      flagged: rows.filter(x => x.flag_count > 0).length };
  }
  function filter(rows, f, ignoreDealer = false) {
    return rows.filter(x => (!f.period || x.month.startsWith(f.period) ||
      (f.period === 'Q1' && x.month <= '2026-03') ||
      (f.period === 'Q2' && x.month >= '2026-04' && x.month <= '2026-06') ||
      (f.period === 'Q3' && x.month >= '2026-07')) &&
      (!f.dealer || ignoreDealer || x.dealer_id === f.dealer) &&
      (!f.model || x.model === f.model) && (!f.component || x.component === f.component));
  }
  function group(rows, field) {
    const groups = new Map();
    rows.forEach(x => { if (!groups.has(x[field])) groups.set(x[field], []); groups.get(x[field]).push(x); });
    return [...groups].map(([name, items]) => ({ name, items, ...metrics(items) }));
  }
  function benchmark(dealerRows, peerRows) {
    let weighted = 0, covered = 0;
    group(dealerRows, 'component').forEach(g => {
      const peers = peerRows.filter(x => x.component === g.name);
      if (peers.length) { weighted += g.n * metrics(peers).repeatRate; covered += g.n; }
    });
    return { rate: covered ? weighted / covered : null, covered, total: dealerRows.length };
  }
  function scenario(rows, repeatReduction, partsReduction, timeReduction, implementationCost) {
    const m = metrics(rows), repeatSavings = m.repeatCost * repeatReduction;
    const remainingParts = m.parts - m.repeatParts * repeatReduction;
    const partsSavings = remainingParts * partsReduction;
    const avoidedHours = m.repeatHours * repeatReduction + (m.hours - m.repeatHours * repeatReduction) * timeReduction;
    const gross = repeatSavings + partsSavings;
    return { ...m, repeatSavings, partsSavings, gross, net: gross - implementationCost,
      projectedCost: m.cost - gross, avoidedHours, remainingHours: m.hours - avoidedHours };
  }
  const api = { sum, metrics, filter, group, benchmark, scenario };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Lab = api;
})(typeof window !== 'undefined' ? window : globalThis);
