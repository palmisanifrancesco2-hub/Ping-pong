import{expect,it}from'vitest';
import report from'../research/report-v18-probabilistic.json';
import snapshot from'../research/reliability-snapshot-v18.json';
it('publishes only an auditable digest of the frozen research report, not operational predictions',()=>{
 expect(snapshot.version).toBe(report.version);
 expect(snapshot.n).toBe(report.n);
 expect(snapshot.observedDays).toBe(report.observedDays);
 expect(snapshot.independentValidation).toBe(false);
 expect(snapshot.operationallyValidated).toBe(false);
 expect(snapshot.automaticPromotion).toBe(false);
 expect(snapshot.markets).toHaveLength(14);
 expect(snapshot.markets.map(m=>m.target)).toEqual(report.markets.map(m=>m.target));
 for(const row of snapshot.markets){
  const src=report.markets.find(m=>m.target===row.target)!;
  expect(row.baseline).toBe(src.reference.brier);
  expect(row.previous).toBe(Math.min(...Object.values(src.previous).map(v=>v.brier)));
  expect(row.newCandidate).toBe(Math.min(...src.candidates.map(v=>v.metrics.brier)));
 }
});
