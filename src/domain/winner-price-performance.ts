import {winnerProtocol, winnerLabels, type WinnerCase} from './winner-comparison.js';

const DAY = 86400000;
export const pricePeriods = [1, 7, 14, 21, 30, 90, 180, 365] as const;
export type PricePolicy = 'all' | 'minimum' | 'value';
const policies: PricePolicy[] = ['all', 'minimum', 'value'];
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

function prices(values: number[]) {
  const sorted = [...values].sort((a, b) => a-b), n = sorted.length;
  return {n, mean: n ? sorted.reduce((a, b) => a+b, 0)/n : null,
    median: n ? (sorted[Math.floor((n-1)/2)]+sorted[Math.floor(n/2)])/2 : null};
}

export function quoteIsUsable(c: WinnerCase) {
  const f = c.forecast, read = Date.parse(f.readAt), home = Date.parse(f.homeQuoteAt), away = Date.parse(f.awayQuoteAt);
  // Quote change time is not a freshness indicator: a stable price can be old.
  // The original collector separately checked the market's read freshness.
  return finite(f.homeOdds) && finite(f.awayOdds) && f.homeOdds > 1 && f.awayOdds > 1
    && [read, home, away].every(Number.isFinite) && read <= f.at && f.at-read <= 30000
    && home <= f.at && away <= f.at && f.featuresAvailable < f.at;
}

function summarize(cases: WinnerCase[], id: string, policy: PricePolicy) {
  const correct: number[] = [], wrong: number[] = [];
  let undecided = 0, excludedByMinimum = 0, excludedByEV = 0, invalidProbability = 0;
  for (const c of cases) {
    const p = c.forecast.probabilities[id];
    if (!finite(p) || p < 0 || p > 1) {invalidProbability++; continue;}
    if (p === .5) {undecided++; continue;}
    const side = Number(p > .5), odds = side ? c.forecast.homeOdds : c.forecast.awayOdds;
    const probability = side ? p : 1-p;
    if (policy !== 'all' && odds < 1.3) {excludedByMinimum++; continue;}
    if (policy === 'value' && probability*odds-1 <= 1e-12) {excludedByEV++; continue;}
    (side === c.outcome.y ? correct : wrong).push(odds);
  }
  const wins = prices(correct), losses = prices(wrong), selected = correct.length+wrong.length;
  return {eligibleSettled: cases.length, selected, correct: wins, wrong: losses, undecided,
    excludedByMinimum, excludedByEV, invalidProbability, accuracy: selected ? correct.length/selected : null,
    meanWrongMinusCorrect: wins.mean !== null && losses.mean !== null ? losses.mean-wins.mean : null,
    theoreticalNetUnits: selected ? correct.reduce((s, q) => s+q, 0)-selected : null,
    realBets: false, verifiedROI: null};
}

/** Aggregates only. Original cases, hashes, study selection and outcomes stay unchanged. */
export function winnerPricePerformance(cases: WinnerCase[], now: number) {
  if (!Number.isFinite(now)) throw Error('PRICE_PERFORMANCE_INVALID_TIME');
  const ids = new Map<string, number>();
  for (const c of cases) ids.set(c.forecast.id, (ids.get(c.forecast.id) ?? 0)+1);
  const timeValid = cases.filter(c => finite(c.forecast.at) && c.forecast.at <= now);
  const ranges = [...pricePeriods.map(days => ({key: String(days), days: days as number | null})), {key:'all', days:null}];
  return {version:'prospective-price-performance-v23', checkedAt:new Date(now).toISOString(),
    scope:'Recorded match-winner selections, not live prices or real wagers',
    invalidOrFutureForecastTimes:cases.length-timeValid.length,
    windows:ranges.map(({key, days}) => {
      const from = days === null ? null : now-days*DAY;
      const registered = timeValid.filter(c => from === null || c.forecast.at >= from);
      const settled = registered.filter(c => c.outcome.status === 'settled' && [0, 1].includes(c.outcome.y!));
      const duplicates = settled.filter(c => ids.get(c.forecast.id)! > 1);
      const usable = settled.filter(c => ids.get(c.forecast.id) === 1 && quoteIsUsable(c));
      return {key, days, from:from === null ? null : new Date(from).toISOString(),
        registered:registered.length, settled:settled.length,
        pending:registered.filter(c => c.outcome.status === 'pending').length,
        invalid:registered.filter(c => c.outcome.status === 'invalid').length,
        invalidSettledOutcomes:registered.filter(c => c.outcome.status === 'settled' && ![0, 1].includes(c.outcome.y!)).length,
        duplicateSettled:duplicates.length, unavailableQuotes:settled.length-duplicates.length-usable.length,
        eligibleSettled:usable.length,
        models:winnerProtocol.candidates.map(id => ({id, label:winnerLabels[id],
          policies:Object.fromEntries(policies.map(policy => [policy, summarize(usable, id, policy)])) as Record<PricePolicy, ReturnType<typeof summarize>>}))};
    }), operationallyValidated:false, automaticPromotion:false};
}

export type WinnerPricePerformance = ReturnType<typeof winnerPricePerformance>;
