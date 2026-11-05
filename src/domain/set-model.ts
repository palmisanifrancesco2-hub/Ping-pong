/** IID rally approximation, 11 points / win by two, analytical infinite deuce tail. */
export function pointToSet(p: number) {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) throw Error('INVALID_POINT_PROBABILITY');
  const states = Array.from({ length: 11 }, () => Array(11).fill(0) as number[]); states[0][0] = 1;
  let won = 0;
  for (let total = 0; total <= 20; total++) for (let a = 0; a <= 10; a++) {
    const b = total - a; if (b < 0 || b > 10) continue;
    const mass = states[a][b];
    if (a === 10 && b === 10) { won += mass * p * p / (p * p + (1 - p) ** 2); continue; }
    if (a === 10 && b <= 9) won += mass * p; else states[a + 1][b] += mass * p;
    if (b < 10) states[a][b + 1] += mass * (1 - p);
  }
  return won;
}
export function matchSetDistribution(p: number, bestOf: 5 | 7 = 5) {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) throw Error('INVALID_SET_PROBABILITY');
  const target = (bestOf + 1) / 2, scores: { home: number; away: number; probability: number }[] = [];
  function walk(a: number, b: number, mass: number) {
    if (a === target || b === target) {
      const found = scores.find(r => r.home === a && r.away === b);
      if (found) found.probability += mass; else scores.push({ home: a, away: b, probability: mass });
      return;
    }
    walk(a + 1, b, mass * p); walk(a, b + 1, mass * (1 - p));
  }
  walk(0, 0, 1);
  return { scores, winner: scores.filter(s => s.home > s.away).reduce((n, s) => n + s.probability, 0), over35: scores.filter(s => s.home + s.away > 3.5).reduce((n, s) => n + s.probability, 0), over45: scores.filter(s => s.home + s.away > 4.5).reduce((n, s) => n + s.probability, 0) };
}
export function totalFeatures(x: number[]) { return [1, ...x.slice(0, 7).map(Math.abs)]; }
