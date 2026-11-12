import { z } from 'zod';
import { COMPETITIONS } from '../src/shared/contracts.js';
const leaguesSchema = z.object({
  sports: z.array(z.object({
    sport: z.string(), events: z.number().int().nonnegative(),
    leagues: z.array(z.object({ league: z.string(), events: z.number().int().nonnegative(), books: z.number().int().nonnegative() })),
  })),
});
const matrixSchema = z.object({
  generated_at: z.iso.datetime({ offset: true }), scope: z.string(),
  bookmakers: z.array(z.object({
    bookmaker: z.string(), status: z.string(),
    sports: z.array(z.object({ sport: z.string(), markets: z.array(z.object({ market: z.string() })) })),
  })),
});
export const PUBLIC_COVERAGE_URLS = {
  leagues: 'https://odss-api.com/api/v1/leagues',
  matrix: 'https://odss-api.com/api/v1/coverage/matrix',
} as const;

export function coverageReport(leaguesPayload: unknown, matrixPayload: unknown, checkedAt: string) {
  const leagues = leaguesSchema.safeParse(leaguesPayload);
  const matrix = matrixSchema.safeParse(matrixPayload);
  if (!leagues.success || !matrix.success || !Number.isFinite(Date.parse(checkedAt))) throw new Error('Schema o timestamp della verifica pubblica non valido.');
  const sport = leagues.data.sports.find(s => s.sport === 'tennistavolo');
  const books = matrix.data.bookmakers.filter(book => book.sports.some(s => s.sport === 'tennistavolo'));
  const sourceAgeSeconds = Math.round((Date.parse(checkedAt) - Date.parse(matrix.data.generated_at)) / 1000);
  return {
    provider: 'ODSS-API (odss-api.com)', purpose: 'public_coverage_only', checkedAt,
    sources: PUBLIC_COVERAGE_URLS, sourceGeneratedAt: matrix.data.generated_at,
    sourceAgeSeconds, scope: matrix.data.scope,
    // A schedule summary is not an event feed, and bookmaker count is not ADM verification.
    reportedEventCount: sport?.events ?? 0,
    competitions: COMPETITIONS.map(name => ({
      name, status: sport?.leagues.some(league => league.league === name) ? 'listed_in_public_catalog' : 'not_in_observed_catalog',
      reportedEvents: sport?.leagues.find(league => league.league === name)?.events ?? 0,
    })),
    bookmakersWithTableTennis: books.length,
    marketKeys: [...new Set(books.flatMap(book => book.sports.filter(s => s.sport === 'tennistavolo').flatMap(s => s.markets.map(m => m.market))))].sort(),
    admStatus: 'unverified', liveStatus: 'unverified', authenticatedOdds: false,
    unitsAndSettlement: 'unverified', operationalComparisons: false,
    license: { status: 'express_permission_required_for_value_platform', source: 'https://odss-api.com/termini.html' },
  };
}

export async function checkPublicCoverage(fetcher: typeof fetch = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const read = async (url: string): Promise<unknown> => {
      const response = await fetcher(url, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Public coverage unavailable');
      return response.json();
    };
    const [leagues, matrix] = await Promise.all([read(PUBLIC_COVERAGE_URLS.leagues),read(PUBLIC_COVERAGE_URLS.matrix)]);
    return coverageReport(leagues, matrix, new Date().toISOString());
  } catch {
    throw new Error(controller.signal.aborted ? 'Timeout della verifica pubblica di copertura.' : 'Verifica pubblica non riuscita: nessuna copertura confermata.');
  } finally { controller.abort(); clearTimeout(timeout); }
}
