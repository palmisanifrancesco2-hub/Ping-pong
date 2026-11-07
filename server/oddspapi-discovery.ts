import { z } from 'zod';

// Official v4 schemas: /us/docs/get-sports and /us/docs/get-bookmakers.
const sportsSchema = z.array(z.object({ sportId: z.number().int(), slug: z.string(), sportName: z.string() }));
const booksSchema = z.array(z.object({ bookmakerName: z.string(), slug: z.string(), liveOdds: z.boolean().nullable(), cloneOf: z.string().nullable() }));

/** Explicit manual diagnostic only: at most two quota requests, no retry or odds ingestion. */
export async function discoverOddsPapi(key: string, consumeFreeRequests: boolean, fetcher: typeof fetch = fetch) {
  if (!consumeFreeRequests) throw new Error('ODDSPAPI_EXPLICIT_OPT_IN_REQUIRED');
  if (!key.trim()) throw new Error('ODDSPAPI_KEY_MISSING');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const read = async (path: 'sports' | 'bookmakers'): Promise<unknown> => {
    const url = new URL(`https://api.oddspapi.io/v4/${path}`);
    url.searchParams.set('apiKey', key);
    const response = await fetcher(url, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error('provider_failure');
    return response.json();
  };
  try {
    // Stop before the second request if authentication, rate limit or schema fails.
    const sports = sportsSchema.parse(await read('sports'));
    const tableTennis = sports.filter(s => s.slug === 'table-tennis');
    if (tableTennis.length > 1) throw new Error('ambiguous_sport');
    const books = booksSchema.parse(await read('bookmakers'));
    return {
      provider: 'OddsPapi', checkedAt: new Date().toISOString(), requestsUsedByDiagnostic: 2,
      purpose: 'catalog_discovery_only', sportsCount: sports.length,
      tableTennis: tableTennis[0] ?? null,
      // Country suffix is only a discovery hint, never verification of a concession.
      italianDomainCandidates: books.filter(b => b.slug.endsWith('.it')),
      competitionsStatus: 'unverified', admStatus: 'unverified',
      liveTableTennisStatus: 'unverified', operationalComparisons: false,
    };
  } catch {
    // URLs, response bodies and thrown fetch errors can contain the query key.
    throw new Error(controller.signal.aborted ? 'ODDSPAPI_DISCOVERY_TIMEOUT' : 'ODDSPAPI_DISCOVERY_FAILED');
  } finally { clearTimeout(timeout); controller.abort(); }
}
