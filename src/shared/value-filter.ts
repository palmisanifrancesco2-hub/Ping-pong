/**
 * A fixed research policy. The blend guards against treating disagreements
 * with the market as evidence of value on their own.
 */
export const marketWeight = 0.5;

export function fairMarketProbability(odds: number, oppositeOdds: number) {
  if (![odds,oppositeOdds].every(value=>Number.isFinite(value)&&value>1)) return null;
  const total=1/odds+1/oppositeOdds;
  if (total<1-1e-12) return null;
  return (1/odds)/total;
}

export function guardedValue(probability:number, lower:number, odds:number, oppositeOdds:number) {
  const market=fairMarketProbability(odds,oppositeOdds);
  if (market===null || ![probability,lower].every(Number.isFinite) ||
      probability<=0 || probability>=1 || lower<0 || lower>probability || odds<1.3) return null;
  const blended=(1-marketWeight)*probability+marketWeight*market;
  const guardedLower=(1-marketWeight)*lower+marketWeight*market;
  if (lower*odds<=1+1e-12 || guardedLower*odds<=1+1e-12) return null;
  return {market,blended,guardedLower,guardedEv:guardedLower*odds-1};
}
