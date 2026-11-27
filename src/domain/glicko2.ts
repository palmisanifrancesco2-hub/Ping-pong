import { playerKey, type MatchResult } from './player-model.js';
export type GlickoRating = { rating: number; rd: number; sigma: number };
const scale = 173.7178;
const initial = (): GlickoRating => ({ rating: 1500, rd: 350, sigma: .06 });
const g = (phi: number) => 1 / Math.sqrt(1 + 3 * phi * phi / Math.PI ** 2);
export function glickoUpdate(r: GlickoRating, games: { opponent: GlickoRating; score: number }[], tau = .5): GlickoRating {
  const mu = (r.rating - 1500) / scale, phi = r.rd / scale;
  if (!games.length) return { ...r, rd: scale * Math.sqrt(phi * phi + r.sigma ** 2) };
  let information = 0, difference = 0;
  for (const game of games) {
    const weight = g(game.opponent.rd / scale), e = 1 / (1 + Math.exp(-weight * (mu - (game.opponent.rating - 1500) / scale)));
    information += weight ** 2 * e * (1 - e); difference += weight * (game.score - e);
  }
  const v = 1 / information, delta = v * difference, a = Math.log(r.sigma ** 2);
  const f = (x: number) => { const ex = Math.exp(x); return ex * (delta ** 2 - phi ** 2 - v - ex) / (2 * (phi ** 2 + v + ex) ** 2) - (x - a) / tau ** 2; };
  let A = a, B: number;
  if (delta ** 2 > phi ** 2 + v) B = Math.log(delta ** 2 - phi ** 2 - v);
  else { let k = 1; while (f(a - k * tau) < 0 && k < 1000) k++; B = a - k * tau; }
  let fa = f(A), fb = f(B), iteration = 0;
  while (Math.abs(B - A) > 1e-6 && iteration++ < 200) {
    const C = A + (A - B) * fa / (fb - fa), fc = f(C);
    if (fc * fb <= 0) { A = B; fa = fb; } else fa /= 2;
    B = C; fb = fc;
  }
  if (iteration >= 200) throw Error('GLICKO_CONVERGENCE_FAILED');
  const sigma = Math.exp(A / 2), star = Math.sqrt(phi ** 2 + sigma ** 2), nextPhi = 1 / Math.sqrt(1 / star ** 2 + 1 / v);
  return { rating: 1500 + scale * (mu + nextPhi ** 2 * difference), rd: scale * nextPhi, sigma };
}
export function glickoProbability(a: GlickoRating, b: GlickoRating) {
  return 1 / (1 + Math.exp(-g(Math.hypot(a.rd, b.rd) / scale) * (a.rating - b.rating) / scale));
}
/** UTC-day periods, simultaneous updates, exclusively outcomes available in closed days. */
export class DailyGlicko {
  private ratings = new Map<string, GlickoRating>();
  private groups = new Map<number, MatchResult[]>();
  private day: number;
  constructor(results: MatchResult[]) {
    for (const m of results) { const day = Math.floor(Date.parse(m.availableAt) / 86400000); this.groups.set(day, [...(this.groups.get(day) ?? []), m]); }
    this.day = Math.min(...this.groups.keys());
  }
  at(m: Pick<MatchResult, 'home' | 'away' | 'league'>, at: number) {
    const target = Math.floor(at / 86400000);
    while (this.day < target) {
      const games = new Map<string, { opponent: GlickoRating; score: number }[]>();
      for (const row of this.groups.get(this.day) ?? []) {
        const ak = playerKey(row.league, row.home), bk = playerKey(row.league, row.away);
        games.set(ak, [...(games.get(ak) ?? []), { opponent: this.ratings.get(bk) ?? initial(), score: Number(row.homeWon) }]);
        games.set(bk, [...(games.get(bk) ?? []), { opponent: this.ratings.get(ak) ?? initial(), score: Number(!row.homeWon) }]);
      }
      const next = new Map<string, GlickoRating>();
      for (const key of new Set([...this.ratings.keys(), ...games.keys()])) next.set(key, glickoUpdate(this.ratings.get(key) ?? initial(), games.get(key) ?? []));
      this.ratings = next; this.day++;
    }
    const a = this.ratings.get(playerKey(m.league, m.home)) ?? initial(), b = this.ratings.get(playerKey(m.league, m.away)) ?? initial();
    return { p: glickoProbability(a, b), home: a, away: b };
  }
}
