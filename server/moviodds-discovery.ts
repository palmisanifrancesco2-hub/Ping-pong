import { z } from 'zod';
import { COMPETITIONS } from '../src/shared/contracts.js';

export const MOVIODDS_URL = 'https://moviodds.com/odds?sport=table_tennis';
const timestamp = z.iso.datetime({ offset: true });
const schema = z.object({
  server_time: timestamp,
  warming: z.boolean().optional(),
  matches: z.array(z.object({
    id: z.string(), sport: z.literal('table_tennis'), home: z.string(), away: z.string(),
    league: z.string(), in_play: z.boolean(), kickoff_utc: timestamp.optional(),
    quotes: z.array(z.object({
      fixture_id: z.string(), group_id: z.string(), odds_dec: z.number().nonnegative(),
      ts: timestamp, suspended: z.boolean().optional(),
    })),
  })),
});

/** Inspect the foreign board only. This does not ingest ADM odds or create forecasts. */
export function moviOddsReport(payload: unknown, checkedAt: string) {
  const data = schema.parse(payload);
  const observed = timestamp.parse(checkedAt);
  const sourceAgeSeconds = (Date.parse(observed) - Date.parse(data.server_time)) / 1000;
  if (sourceAgeSeconds < -60 || sourceAgeSeconds > 120) throw new Error('MOVIODDS_STALE_RESPONSE');
  const ids = data.matches.map(m => m.id);
  if (new Set(ids).size !== ids.length || data.matches.some(m => m.quotes.some(q => q.fixture_id !== m.id))) {
    throw new Error('MOVIODDS_AMBIGUOUS_IDENTITIES');
  }
  return {
    provider: 'MoviOdds', source: MOVIODDS_URL, checkedAt: observed,
    sourceGeneratedAt: data.server_time, sourceAgeSeconds, warming: data.warming ?? false,
    purpose: 'foreign_board_discovery_only', bookmakerSite: 'bet365.com.au',
    reportedMatches: data.matches.length, reportedLiveFlags: data.matches.filter(m => m.in_play).length,
    // Includes zero/suspended quotes and catalog entries past their scheduled start.
    // These are feed counts, never counts of currently bettable selections.
    reportedQuoteEntries: data.matches.reduce((n, m) => n + m.quotes.length, 0),
    competitions: COMPETITIONS.map(name => ({ name, observedMatches: data.matches.filter(m =>
      m.league === (name === 'Challenger Series' ? 'Challenger Series TT' : name)).length })),
    italianPricesVerified: false, admStatus: 'unverified', operationalComparisons: false,
    resultsVerified: false, usageRightsStatus: 'not_independently_verified',
  };
}

export async function checkMoviOdds(fetcher: typeof fetch = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetcher(MOVIODDS_URL, {
      signal: controller.signal, redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('upstream_error');
    return moviOddsReport(await response.json(), new Date().toISOString());
  } catch {
    throw new Error(controller.signal.aborted ? 'MOVIODDS_TIMEOUT' : 'MOVIODDS_DISCOVERY_FAILED');
  } finally { clearTimeout(timeout); controller.abort(); }
}
