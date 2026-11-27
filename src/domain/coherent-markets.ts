/** Conditional IID rally model. Numerical coherence is not predictive validation. */
export type MatchRules = { bestOf: number; pointsToWin: number; winBy: 2 };
export type LineProbabilities = { over: number; under: number; push: number };
export type DiscreteMass = { value: number; probability: number }[];
export type CappedPoints = { probabilities: number[]; overflowFromInclusive: number; overflowProbability: number };

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
function choose(n: number, k: number) { let x = 1; for (let j = 1; j <= k; j++) x *= (n - j + 1) / j; return x; }
function checkRules(r: MatchRules, cap: number) {
  if (!Number.isInteger(r.bestOf) || r.bestOf < 1 || r.bestOf > 9 || r.bestOf % 2 !== 1 ||
    !Number.isInteger(r.pointsToWin) || r.pointsToWin < 2 || r.pointsToWin > 31 || r.winBy !== 2 ||
    !Number.isInteger(cap) || cap < 2 * r.pointsToWin || cap > 512) throw Error('UNSUPPORTED_SCORING_RULES_OR_CAP');
}
function checkPoint(p: number) { if (!Number.isFinite(p) || p < 0 || p > 1) throw Error('INVALID_POINT_PROBABILITY'); }
function addMap(to: Map<number, number>, from: Map<number, number>, weight = 1) {
  for (const [key, mass] of from) to.set(key, (to.get(key) ?? 0) + mass * weight);
}
function convolveMap(a: Map<number, number>, b: Map<number, number>) {
  const out = new Map<number, number>();
  for (const [x, px] of a) for (const [y, py] of b) out.set(x + y, (out.get(x + y) ?? 0) + px * py);
  return out;
}
function convolveCapped(a: number[], b: number[], cap: number) {
  const out = Array<number>(cap + 1).fill(0);
  for (let i = 0; i <= cap; i++) if (a[i]) for (let j = 0; j <= cap; j++) if (b[j]) out[Math.min(cap, i + j)] += a[i] * b[j];
  return out;
}
function capped(values: number[]): CappedPoints {
  return { probabilities: values.slice(0, -1), overflowFromInclusive: values.length - 1, overflowProbability: values.at(-1)! };
}
function discrete(values: Map<number, number>): DiscreteMass {
  return [...values].sort(([a], [b]) => a - b).map(([value, probability]) => ({ value, probability }));
}
function kernels(p: number, t: number, cap: number) {
  const q = 1 - p, home = Array<number>(cap + 1).fill(0), away = [...home];
  const homeMargins = new Map<number, number>(), awayMargins = new Map<number, number>();
  let expected = 0;
  for (let loser = 0; loser <= t - 2; loser++) {
    const c = choose(t - 1 + loser, loser), a = c * p ** t * q ** loser, b = c * q ** t * p ** loser;
    home[Math.min(cap, t + loser)] += a; away[Math.min(cap, t + loser)] += b;
    homeMargins.set(t - loser, a); awayMargins.set(loser - t, b);
    expected += (a + b) * (t + loser);
  }
  const reach = choose(2 * t - 2, t - 1) * p ** (t - 1) * q ** (t - 1), den = p * p + q * q, ratio = 2 * p * q;
  homeMargins.set(2, (homeMargins.get(2) ?? 0) + reach * p * p / den);
  awayMargins.set(-2, (awayMargins.get(-2) ?? 0) + reach * q * q / den);
  let j = 0;
  for (; 2 * t + 2 * j < cap; j++) { home[2 * t + 2 * j] += reach * ratio ** j * p * p; away[2 * t + 2 * j] += reach * ratio ** j * q * q; }
  // All larger totals are retained exactly in an overflow bucket, including infinite deuce play.
  home[cap] += reach * ratio ** j * p * p / den; away[cap] += reach * ratio ** j * q * q / den;
  expected += reach * (2 * (t - 1) + 2 / den);
  return { home, away, homeMargins, awayMargins, expected };
}

export function coherentMatchMarkets(pointProbability: number, rules: MatchRules, totalPointCap = 256) {
  checkPoint(pointProbability); checkRules(rules, totalPointCap);
  const p = pointProbability, target = (rules.bestOf + 1) / 2, cap = totalPointCap, k = kernels(p, rules.pointsToWin, cap), setP = Math.min(1, Math.max(0, sum(k.home)));
  type State = { mass: number; points: number[]; margins: Map<number, number>; firstLost: number };
  const states = new Map<string, State>();
  const initial = Array<number>(cap + 1).fill(0); initial[0] = 1;
  states.set('0:0', { mass: 1, points: initial, margins: new Map([[0, 1]]), firstLost: 0 });
  const scores: { home: number; away: number; probability: number }[] = [], totalSets = new Map<number, number>();
  const totalPoints = Array<number>(cap + 1).fill(0), pointMargins = new Map<number, number>();
  const reach = Array<number>(rules.bestOf).fill(0); let comeback = 0;
  for (let played = 0; played <= rules.bestOf; played++) for (let home = 0; home <= Math.min(target, played); home++) {
    const away = played - home; if (away > target) continue;
    const state = states.get(`${home}:${away}`); if (!state) continue;
    if (home === target || away === target) {
      scores.push({ home, away, probability: state.mass }); totalSets.set(played, (totalSets.get(played) ?? 0) + state.mass);
      state.points.forEach((mass, i) => { totalPoints[i] += mass; }); addMap(pointMargins, state.margins);
      if (home === target) comeback += state.firstLost;
      continue;
    }
    reach[played] += state.mass;
    for (const won of [true, false]) {
      const nextHome = home + Number(won), nextAway = away + Number(!won), key = `${nextHome}:${nextAway}`, chance = won ? setP : 1 - setP;
      const points = convolveCapped(state.points, won ? k.home : k.away, cap), margins = convolveMap(state.margins, won ? k.homeMargins : k.awayMargins);
      const firstLost = played === 0 ? (won ? 0 : state.mass * chance) : state.firstLost * chance;
      const old = states.get(key);
      if (old) { old.mass += state.mass * chance; old.firstLost += firstLost; points.forEach((mass, i) => { old.points[i] += mass; }); addMap(old.margins, margins); }
      else states.set(key, { mass: state.mass * chance, points, margins, firstLost });
    }
  }
  const homeWinner = Math.min(1, Math.max(0, scores.filter(s => s.home === target).reduce((s, x) => s + x.probability, 0)));
  const massChecks = [scores.reduce((s, x) => s + x.probability, 0), sum(totalPoints), sum([...pointMargins.values()])];
  if (massChecks.some(x => !Number.isFinite(x) || Math.abs(x - 1) > 1e-9)) throw Error('PROBABILITY_MASS_NOT_CONSERVED');
  return {
    status: 'structural-experimental' as const, operationallyValidated: false as const,
    assumptions: ['Caller-supplied point probability is not validated here.', 'Independent rallies with constant probability; no service, fatigue or live-score effect.', 'Independent identically distributed sets, conditional on the supplied point probability.'],
    pointProbability: p, rules: { ...rules }, setHomeProbability: setP,
    winner: { home: homeWinner, away: 1 - homeWinner }, exactMatchScores: scores,
    totalSets: discrete(totalSets), matchPoints: capped(totalPoints), pointMargin: discrete(pointMargins),
    setPoints: capped(k.home.map((x, i) => x + k.away[i])), setPointMargin: discrete(new Map([...k.homeMargins, ...k.awayMargins])),
    expectedMatchPoints: k.expected * sum(reach), expectedSetPoints: k.expected,
    sets: reach.map((playedProbability, index) => ({ number: index + 1, playedProbability,
      homeGivenPlayed: playedProbability > 0 ? setP : null, awayGivenPlayed: playedProbability > 0 ? 1 - setP : null,
      homeAndPlayed: playedProbability * setP, awayAndPlayed: playedProbability * (1 - setP), notPlayed: 1 - playedProbability })),
    sweep: { home: setP ** target, away: (1 - setP) ** target },
    winsAtLeastOneSet: { home: 1 - (1 - setP) ** target, away: 1 - setP ** target },
    comeback: { definition: 'Home wins match after losing first set' as const, probability: comeback, homeWinGivenFirstSetLost: setP < 1 ? comeback / (1 - setP) : null },
  };
}
export type CoherentMatchMarkets = ReturnType<typeof coherentMatchMarkets>;

function splitLine(masses: DiscreteMass, line: number): LineProbabilities {
  if (!Number.isFinite(line)) throw Error('INVALID_LINE');
  return masses.reduce((s, x) => { s[x.value > line ? 'over' : x.value < line ? 'under' : 'push'] += x.probability; return s; }, { over: 0, under: 0, push: 0 });
}
export function totalSetsLine(result: CoherentMatchMarkets, line: number) { return splitLine(result.totalSets, line); }
export function totalPointsLine(distribution: CappedPoints, line: number): LineProbabilities {
  if (!Number.isFinite(line) || line >= distribution.overflowFromInclusive) throw Error('LINE_REQUIRES_UNRESOLVED_OVERFLOW');
  const result = splitLine(distribution.probabilities.map((probability, value) => ({ value, probability })), line);
  return { ...result, over: result.over + distribution.overflowProbability };
}
/** Handicap is added to the chosen player's score: home -1.5 means margin > 1.5. */
export function setHandicap(result: CoherentMatchMarkets, side: 'home' | 'away', handicap: number) {
  const sign = side === 'home' ? 1 : -1;
  return splitLine(result.exactMatchScores.map(s => ({ value: sign * (s.home - s.away), probability: s.probability })), -handicap);
}
export function pointHandicap(distribution: DiscreteMass, side: 'home' | 'away', handicap: number) {
  return splitLine(distribution.map(x => ({ value: (side === 'home' ? 1 : -1) * x.value, probability: x.probability })), -handicap);
}
/** Exact terminal set score; zero for illegal/nonterminal scores. */
export function exactSetScoreProbability(result: CoherentMatchMarkets, home: number, away: number) {
  if (!Number.isInteger(home) || !Number.isInteger(away) || Math.min(home, away) < 0) throw Error('INVALID_SET_SCORE');
  const t = result.rules.pointsToWin, p = result.pointProbability, q = 1 - p, high = Math.max(home, away), low = Math.min(home, away);
  if (high < t || high - low < 2 || (high > t && high - low !== 2)) return 0;
  if (high === t) return choose(t - 1 + low, low) * (home > away ? p ** t * q ** low : q ** t * p ** low);
  const loops = low - (t - 1), reach = choose(2 * t - 2, t - 1) * p ** (t - 1) * q ** (t - 1);
  return reach * (2 * p * q) ** loops * (home > away ? p * p : q * q);
}
