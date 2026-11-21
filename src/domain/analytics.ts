function finite(value: number) { if (!Number.isFinite(value)) throw new Error('Valore non finito'); }
function probability(p: number) { finite(p); if (p < 0 || p > 1) throw new Error('Probabilità non valida'); }
export function impliedProbability(odds: number) { finite(odds); if (odds <= 1) throw new Error('Quota decimale non valida'); return 1 / odds; }
export function expectedValue(p: number, odds: number) { probability(p); impliedProbability(odds); return p * odds - 1; }
// Only exhaustive, mutually exclusive outcomes of ONE bookmaker and ONE market.
export function overround(prices: number[], complete: boolean) {
  if (!complete || prices.length < 2) return null;
  return prices.reduce((sum, price) => sum + impliedProbability(price), 0) - 1;
}
export function fractionalKelly(input: { enabled: boolean; bankroll: number; pLowerBound: number; odds: number; fraction: number; maxStakeFraction: number; validated: boolean }) {
  if (!input.enabled || !input.validated) return 0;
  probability(input.pLowerBound); impliedProbability(input.odds);
  finite(input.bankroll); finite(input.fraction); finite(input.maxStakeFraction);
  if (input.bankroll < 0 || input.fraction < 0 || input.fraction > 1 || input.maxStakeFraction < 0 || input.maxStakeFraction > 0.02) throw new Error('Limiti bankroll non validi');
  const kelly = expectedValue(input.pLowerBound, input.odds) / (input.odds - 1);
  return Math.floor(input.bankroll * Math.max(0, Math.min(kelly * input.fraction, input.maxStakeFraction)) * 100) / 100;
}
export function binaryMetrics(rows: { probability: number; outcome: 0 | 1 }[]) {
  if (!rows.length) return null;
  let brier = 0, logLoss = 0;
  for (const row of rows) {
    probability(row.probability);
    if (row.outcome !== 0 && row.outcome !== 1) throw new Error('Esito non binario');
    brier += (row.probability - row.outcome) ** 2;
    const p = Math.max(1e-15, Math.min(1 - 1e-15, row.probability));
    logLoss -= row.outcome * Math.log(p) + (1 - row.outcome) * Math.log(1 - p);
  }
  return { count: rows.length, brier: brier / rows.length, logLoss: logLoss / rows.length };
}
