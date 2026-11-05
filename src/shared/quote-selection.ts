import type { ValueReport } from './value.js';
import type { ValueOpportunity } from '../domain/value.js';
import { isUpcomingOrLive, quoteIdentity, quoteStatus, type FeedMatch } from './board.js';

export function probabilityOrder(a: ValueOpportunity, b: ValueOpportunity) {
  return b.probability - a.probability || b.conservativeEv - a.conservativeEv
    || Math.abs(a.odds - 2) - Math.abs(b.odds - 2) || a.id.localeCompare(b.id);
}

/** Display policy only: the frozen prospective enrollment rules stay unchanged. */
export function selectedQuotes(report: ValueReport | null, matches: FeedMatch[], now: number, minOdds = 1.3) {
  if (!report || !Number.isFinite(now) || !Number.isFinite(Date.parse(report.checkedAt)) || now - Date.parse(report.checkedAt) > 120000 || Date.parse(report.checkedAt) > now + 60000) return [];
  const events = new Map(matches.map(m => [m.id, m]));
  const rows = [...report.opportunities, ...(report.experimental ?? [])].filter(o => {
    const m = events.get(o.eventId);
    if (!m || m.in_play || !isUpcomingOrLive(m, now) || !o.fresh || o.sampleSize < 30) return false;
    if (![o.odds, o.probability, o.probabilityLower].every(Number.isFinite) || o.odds < Math.max(1.3, minOdds)
      || o.probability <= 0 || o.probability >= 1 || o.probabilityLower < 0 || o.probabilityLower > o.probability) return false;
    if (o.probabilityLower * o.odds <= 1 || o.probability * o.odds <= 1) return false;
    const q = m.quotes.find(q => quoteIdentity(q) === o.quoteKey);
    return !!q && q.fixture_id === m.id && q.side === o.selection && q.group_id === '920000' && q.line === 'To Win' && q.phase !== 'inplay'
      && q.odds_dec === o.odds && q.ts === o.quoteAt && Date.parse(q.ts) <= now
      && quoteStatus(m, q, now) === 'Letta di recente dalla fonte';
  }).sort(probabilityOrder);
  const seen = new Set<string>();
  return rows.filter(o => { if (seen.has(o.eventId)) return false; seen.add(o.eventId); return true; });
}
