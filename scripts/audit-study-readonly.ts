/** Prepared private diagnostic; not part of build/cron/API. No remote writes.
 * Explicit approval and APP_READONLY_DATA_AUDIT=1 required before execution.
 * Explicit output contains numeric aggregates/dates. Existing report methods
 * also log protocol and competition labels. No secrets, individual rows or IDs.
 */
import {MarketStudy} from '../server/market-study.js';
import {ProspectiveStudy} from '../server/prospective-study.js';
import {AdaptiveTraining} from '../server/adaptive-training.js';

const numbers = (value: unknown): Record<string, number | null> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, v]) =>
    /^[A-Za-z][A-Za-z0-9]*$/.test(key) && (v === null || typeof v === 'number' && Number.isFinite(v))));
};

async function audit() {
  if (process.env.APP_READONLY_DATA_AUDIT !== '1') throw Error('AUDIT_NOT_EXPLICITLY_ENABLED');
  const owner = await new ProspectiveStudy(process.env).ownerId();
  const report = await new MarketStudy(process.env).report(owner);
  console.info(JSON.stringify({readOnlyStudyAudit: 'markets', checkedAt: new Date().toISOString(),
    counts: numbers(report), targets: report.descriptive.map((r, index) => ({index,
      counts: numbers(r), model: numbers(r.model), reference: numbers(r.reference)})),
    checkpointCounts: report.checkpoints.map(c => ({size: c.size, consistent: c.consistent,
      counts: numbers(c.result), passed: c.result.targets.filter(t => t.preliminaryPass).length})),
    winnerReview: report.winnerReview ? {counts: numbers(report.winnerReview),
      models: report.winnerReview.models.map((m, index) => ({index, metrics: numbers(m)}))} : null,
    winnerShadow: report.winnerShadow ? {counts: numbers(report.winnerShadow),
      models: report.winnerShadow.models.map((m, index) => ({index, metrics: numbers(m)}))} : null}));
  const training = await new AdaptiveTraining(process.env).report(owner);
  console.info(JSON.stringify({readOnlyStudyAudit: 'training', checkedAt: new Date().toISOString(),
    enabled: training.enabled, scheduled: training.scheduled,
    runs: training.runs.map(r => ({day: /^\d{4}-\d{2}-\d{2}$/.test(r.day) ? r.day : null,
      status: ['trained', 'insufficient_data', 'failed', 'claimed', 'deferred_deadline'].includes(r.status) ? r.status : 'other',
      counts: 'counts' in r ? numbers(r.counts) : null, coverage: numbers(r.coverage),
      test: 'test' in r ? numbers(r.test) : null, baseline: 'baseline' in r ? numbers(r.baseline) : null,
      differenceBrier: 'differenceBrier' in r && typeof r.differenceBrier === 'number' ? r.differenceBrier : null})),
    automaticPromotion: false}));
  console.info('READ_ONLY_AGGREGATE_AUDIT_COMPLETE');
}

audit().catch(() => {console.error('READ_ONLY_AGGREGATE_AUDIT_FAILED'); process.exitCode = 1;});
