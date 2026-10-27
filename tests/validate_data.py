"""Verify data contracts, SQL examples, and derived repeat flags."""
import json, sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'dist/assets/data.json').read_text())
rows=data['claims']
assert len(rows)==2400
assert len({r['claim_id'] for r in rows})==len(rows)
vehicles={x['vehicle_id'] for x in data['vehicles']}
dealers={x['dealer_id'] for x in data['dealers']}
history=defaultdict(list)
last_mileage={}
for r in rows:
    assert r['vehicle_id'] in vehicles and r['dealer_id'] in dealers
    assert r['month']>='2026-01' and r['month']<='2026-09'
    assert abs(r['total_cost']-r['parts_cost']-r['labor_cost'])<.011
    assert r['parts_cost']>=0 and r['labor_cost']>=0
    assert r['mileage']>=last_mileage.get(r['vehicle_id'],0)
    last_mileage[r['vehicle_id']]=r['mileage']
    opened,closed=map(datetime.fromisoformat,[r['opened_at'],r['closed_at']])
    assert closed>opened
    assert abs((closed-opened).total_seconds()/3600-r['repair_hours'])<.02
    prior=[p for p in history[(r['vehicle_id'],r['component'])] if timedelta(0)<=opened-datetime.fromisoformat(p['closed_at'])<=timedelta(days=30)]
    assert r['repeat_30d']==int(bool(prior))
    if prior: assert r['prior_claim_id']==max(prior,key=lambda p:p['closed_at'])['claim_id']
    assert r['high_cost']==int(r['total_cost']>2.5*data['meta']['component_medians'][r['component']])
    assert r['long_repair']==int(r['repair_hours']>72)
    assert r['flag_count']==r['repeat_30d']+r['high_cost']+r['long_repair']
    history[(r['vehicle_id'],r['component'])].append(r)
con=sqlite3.connect(root/'dist/downloads/warranty_lab.sqlite')
sql=(root/'reference/analysis.sql').read_text()
# Strip comment lines so semicolons inside prose are not statement separators.
sql='\n'.join(line for line in sql.splitlines() if not line.strip().startswith('--'))
results=[con.execute(s).fetchall() for s in sql.split(';') if s.strip()]
assert len(results)==6
assert all(stored==calculated for _,stored,calculated in results[4])
assert all(count==0 for _,count in results[5])
db_total=con.execute('SELECT SUM(total_cost),COUNT(*) FROM claims').fetchone()
assert abs(db_total[0]-sum(x['total_cost'] for x in rows))<.001
assert db_total[1]==len(rows)
print(f'PASS: {len(rows)} records, repeat-history linkage, thresholds, timestamps, dimensions, and all 6 SQL analyses.')
