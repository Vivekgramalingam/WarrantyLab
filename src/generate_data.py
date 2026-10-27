"""Deterministic synthetic warranty portfolio data. Python 3, standard library only."""
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict
import random, json, csv, sqlite3, statistics

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist' / 'downloads'
OUT.mkdir(parents=True, exist_ok=True)
rng = random.Random(260926)
dealers = [
    ('D01', 'Piedmont Truck Center', 'Southeast'),
    ('D02', 'Blue Ridge Service', 'Southeast'),
    ('D03', 'Great Lakes Fleet', 'Midwest'),
    ('D04', 'Prairie Truck Works', 'Midwest'),
    ('D05', 'Cascade Commercial', 'West'),
    ('D06', 'Desert Ridge Motors', 'West'),
    ('D07', 'Atlantic Fleet Care', 'Northeast'),
    ('D08', 'Hudson Valley Trucks', 'Northeast'),
]
components = [('Cooling', 1250, 11), ('Aftertreatment', 2600, 18),
              ('Electrical', 780, 7), ('Transmission', 4300, 24),
              ('Braking', 1050, 8), ('Fuel system', 1750, 13)]
models = ['HX 440', 'HX 620', 'MD 280']
vehicles = [dict(vehicle_id=f'V{i:04}', model=rng.choices(models, [4,3,3])[0],
                 model_year=rng.choice([2023,2024,2025,2026])) for i in range(1,901)]
rows=[]
for i in range(2400):
    did, dealer, region = rng.choice(dealers)
    comp, base, hours = rng.choices(components, [24,22,20,10,14,10])[0]
    v = rng.choice(vehicles)
    day = rng.randrange(270)
    opened = datetime(2026,1,1) + timedelta(days=day, hours=rng.randrange(8,17))
    # Inject a plausible recurring issue; all repeat flags are derived afterward.
    candidates = [x for x in rows[-100:] if x['dealer_id']==did and x['component']==comp]
    if candidates and rng.random() < (0.36 if did=='D01' and comp=='Cooling' else 0.06):
        prev = rng.choice(candidates)
        v = next(x for x in vehicles if x['vehicle_id']==prev['vehicle_id'])
        opened = datetime.fromisoformat(prev['closed_at']) + timedelta(days=rng.randint(2,22))
        if opened >= datetime(2026,9,28):
            opened = datetime(2026,9,24,10)
    mult = rng.lognormvariate(-0.10, 0.40)
    parts = round(base * 0.65 * mult, 2)
    labor_hours = round(hours * rng.uniform(.55,1.5), 1)
    labor = round(labor_hours * rng.uniform(105,145), 2)
    if rng.random() < .035:
        parts = round(parts * 3.4, 2)
    repair_hours = round(labor_hours + rng.uniform(2,35) + (rng.uniform(20,55) if did=='D01' and comp=='Cooling' else 0), 1)
    if rng.random() < .04:
        repair_hours = round(repair_hours + rng.uniform(50,105), 1)
    closed = opened + timedelta(hours=repair_hours)
    rows.append(dict(claim_id=f'WC-{i+1:05}', vehicle_id=v['vehicle_id'], dealer_id=did,
                     dealer=dealer, region=region, model=v['model'], model_year=v['model_year'],
                     component=comp, opened_at=opened.isoformat(timespec='minutes'),
                     closed_at=closed.isoformat(timespec='minutes'), month=opened.strftime('%Y-%m'),
                     mileage=(2026-v['model_year'])*40000 + (int(v['vehicle_id'][1:])*41)%30000 + (opened-datetime(2026,1,1)).days*210, parts_cost=parts, labor_cost=labor,
                     total_cost=round(parts+labor,2), repair_hours=repair_hours,
                     repeat_30d=0, prior_claim_id=''))
rows.sort(key=lambda x: (x['opened_at'], x['claim_id']))
history=defaultdict(list)
for row in rows:
    key=(row['vehicle_id'],row['component'])
    opened=datetime.fromisoformat(row['opened_at'])
    eligible=[p for p in history[key] if timedelta(0) <= opened-datetime.fromisoformat(p['closed_at']) <= timedelta(days=30)]
    if eligible:
        prior=max(eligible,key=lambda p:p['closed_at'])
        row['repeat_30d']=1
        row['prior_claim_id']=prior['claim_id']
    history[key].append(row)
medians={c[0]:statistics.median(x['total_cost'] for x in rows if x['component']==c[0]) for c in components}
for row in rows:
    row['high_cost']=int(row['total_cost'] > 2.5*medians[row['component']])
    row['long_repair']=int(row['repair_hours'] > 72)
    row['flag_count']=row['repeat_30d']+row['high_cost']+row['long_repair']
payload=dict(meta=dict(seed=260926,synthetic=True,period='January – September 2026',
                       component_medians=medians,vehicle_population=900),
             dealers=[dict(dealer_id=d[0],dealer=d[1],region=d[2]) for d in dealers],
             vehicles=vehicles,claims=rows)
(ROOT/'dist/assets/data.json').write_text(json.dumps(payload,separators=(',',':')))

def export(name, data):
    with (OUT/name).open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(data[0]));w.writeheader();w.writerows(data)
export('claims.csv',rows)
export('dealers.csv',payload['dealers'])
export('vehicles.csv',vehicles)
db=OUT/'warranty_lab.sqlite'
if db.exists(): db.unlink()
con=sqlite3.connect(db)
for name,records in [('claims',rows),('dealers',payload['dealers']),('vehicles',vehicles)]:
    types={k:('INTEGER' if isinstance(v,int) else 'REAL' if isinstance(v,float) else 'TEXT') for k,v in records[0].items()}
    con.execute(f'CREATE TABLE {name} ('+', '.join(f'{k} {v}' for k,v in types.items())+')')
    con.executemany(f'INSERT INTO {name} VALUES ('+','.join('?' for _ in types)+')',[[r[k] for k in types] for r in records])
con.commit();con.close()
print(f'Generated {len(rows)} claims, {len(vehicles)} vehicles, {len(dealers)} dealers.')
