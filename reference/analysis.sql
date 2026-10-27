-- Warranty & Service Intelligence Lab | SQLite 3
-- Synthetic data. Open downloads/warranty_lab.sqlite to run these queries.
-- All costs are submitted claim amounts, not approved payments or reserves.

-- 1. Monthly performance (completed repairs by opened month)
SELECT month, COUNT(*) AS claims, ROUND(SUM(total_cost),2) AS claimed_cost,
       ROUND(AVG(total_cost),2) AS cost_per_claim,
       ROUND(AVG(repair_hours),1) AS mean_repair_hours,
       ROUND(100.0*AVG(repeat_30d),2) AS repeat_repair_pct
FROM claims GROUP BY month ORDER BY month;

-- 2. Dealer comparison; counts make small populations visible.
SELECT dealer, COUNT(*) AS claims, ROUND(SUM(total_cost),2) AS claimed_cost,
       ROUND(AVG(repair_hours),1) AS mean_repair_hours,
       ROUND(100.0*AVG(repeat_30d),2) AS repeat_repair_pct,
       SUM(CASE WHEN flag_count>0 THEN 1 ELSE 0 END) AS flagged_claims
FROM claims GROUP BY dealer ORDER BY repeat_repair_pct DESC;

-- 3. Component-mix benchmark, leave-one-dealer-out.
-- Expected repeat rate applies peer component rates to each dealer's mix.
-- This is descriptive standardization, not a causal or significance test.
WITH mix AS (
  SELECT dealer_id, component, COUNT(*) AS n, SUM(repeat_30d) AS repeats
  FROM claims GROUP BY dealer_id,component
), totals AS (
  SELECT component, COUNT(*) AS n, SUM(repeat_30d) AS repeats
  FROM claims GROUP BY component
)
SELECT m.dealer_id, SUM(m.n) AS claims,
       ROUND(100.0*SUM(m.repeats)/SUM(m.n),2) AS observed_pct,
       ROUND(100.0*SUM(m.n*1.0*(t.repeats-m.repeats)/NULLIF(t.n-m.n,0))/
         SUM(CASE WHEN t.n>m.n THEN m.n ELSE 0 END),2) AS peer_expected_pct
FROM mix m JOIN totals t USING(component) GROUP BY m.dealer_id;

-- 4. Investigation list: deterministic flags, NOT fraud predictions.
SELECT claim_id,dealer,component,total_cost,repair_hours,
       repeat_30d,high_cost,long_repair,prior_claim_id
FROM claims WHERE flag_count>0 ORDER BY flag_count DESC,total_cost DESC;

-- 5. Recalculate repeat flags using the full available history before filtering.
-- A prior repair must have closed 0–30 days before this repair opened.
SELECT c.claim_id, c.repeat_30d AS stored_flag,
       EXISTS(SELECT 1 FROM claims p
         WHERE p.vehicle_id=c.vehicle_id AND p.component=c.component
           AND p.claim_id<>c.claim_id
           AND julianday(c.opened_at)-julianday(p.closed_at) BETWEEN 0 AND 30
       ) AS calculated_flag
FROM claims c;

-- 6. Data quality checks: all should return zero violations.
SELECT 'duplicate_claim_id' AS check_name, COUNT(*)-COUNT(DISTINCT claim_id) AS violations FROM claims
UNION ALL SELECT 'invalid_cost', COUNT(*) FROM claims
 WHERE parts_cost<0 OR labor_cost<0 OR ABS(total_cost-parts_cost-labor_cost)>0.011
UNION ALL SELECT 'invalid_dates', COUNT(*) FROM claims WHERE closed_at<=opened_at
UNION ALL SELECT 'missing_dealer', COUNT(*) FROM claims c LEFT JOIN dealers d USING(dealer_id) WHERE d.dealer_id IS NULL
UNION ALL SELECT 'missing_vehicle', COUNT(*) FROM claims c LEFT JOIN vehicles v USING(vehicle_id) WHERE v.vehicle_id IS NULL;
