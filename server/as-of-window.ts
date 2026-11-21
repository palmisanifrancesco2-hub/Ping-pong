import type {MatchResult} from '../src/domain/player-model.js';

/** Cutoff is exclusive: an outcome is usable only after its reported availability time.
 * The valid interval lets warm server instances reuse a snapshot without time-travel leakage.
 * No statistical prediction is produced by this helper.
 */
export function asOfWindow(results: readonly MatchResult[], at: number) {
  if (!Number.isFinite(at)) throw Error('INVALID_PREDICTION_CUTOFF');
  const eligible: MatchResult[] = [];
  let validAfter = Number.NEGATIVE_INFINITY;
  let validThrough = Number.POSITIVE_INFINITY;
  for (const result of results) {
    const available = Date.parse(result.availableAt);
    if (!Number.isFinite(available)) continue;
    if (available < at) {
      eligible.push(result);
      validAfter = Math.max(validAfter, available);
    } else validThrough = Math.min(validThrough, available);
  }
  eligible.sort((a,b)=>Date.parse(a.availableAt)-Date.parse(b.availableAt)||a.id.localeCompare(b.id));
  return {eligible, validAfter, validThrough};
}
export function withinWindow(window: {validAfter:number;validThrough:number}, at: number) {
  return Number.isFinite(at) && at > window.validAfter && at <= window.validThrough;
}
