import { describe, expect, it, vi } from 'vitest';
import { checkPublicCoverage, coverageReport } from '../server/public-coverage';
const checkedAt = '2026-01-01T12:00:00Z';
// Entirely synthetic catalog fixtures: never shown by the application.
const leagues = { sports: [{ sport: 'tennistavolo', events: 3, leagues: [{ league: 'TT Cup', events: 3, books: 2 }] }] };
const matrix = { generated_at: '2026-01-01T11:59:00Z', scope: 'prematch', bookmakers: [{ bookmaker: 'synthetic-test-book', status: 'active', sports: [{ sport: 'tennistavolo', markets: [{ market: 'moneyline' },{ market: 'ou' }] }] }] };
describe('public catalog verification (not an odds connector)', () => {
  it('distinguishes an observed catalog listing from operational coverage', () => {
    const report = coverageReport(leagues,matrix,checkedAt);
    expect(report.competitions.find(c => c.name === 'TT Cup')).toMatchObject({ status: 'listed_in_public_catalog', reportedEvents: 3 });
    expect(report.competitions.find(c => c.name === 'Challenger Series')?.status).toBe('not_in_observed_catalog');
    expect(report.marketKeys).toEqual(['moneyline','ou']);
    expect(report.admStatus).toBe('unverified'); expect(report.liveStatus).toBe('unverified');
    expect(report.operationalComparisons).toBe(false); expect(report.authenticatedOdds).toBe(false);
    expect(report.license.status).toBe('express_permission_required_for_value_platform');
    expect(report.sourceAgeSeconds).toBe(60);
  });
  it('does not infer table tennis from tennis', () => {
    const report = coverageReport({ sports: [{ ...leagues.sports[0], sport: 'tennis' }] },{ ...matrix, bookmakers: [] },checkedAt);
    expect(report.reportedEventCount).toBe(0); expect(report.bookmakersWithTableTennis).toBe(0);
  });
  it('rejects malformed payloads instead of treating them as empty coverage', () => {
    expect(() => coverageReport({},matrix,checkedAt)).toThrow();
    expect(() => coverageReport(leagues,{ ...matrix, generated_at: 'invalid' },checkedAt)).toThrow();
  });
  it('uses public endpoints without sending an API key', async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      expect(String(url)).not.toContain('apiKey'); expect(init?.headers).toEqual({ Accept: 'application/json' });
      return new Response(JSON.stringify(String(url).endsWith('/leagues') ? leagues : matrix));
    });
    const report = await checkPublicCoverage(fetcher as typeof fetch);
    expect(report.purpose).toBe('public_coverage_only'); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('sanitizes errors and does not publish false success', async () => {
    await expect(checkPublicCoverage(vi.fn(async () => new Response('not available',{ status: 429 })))).rejects.toThrow('nessuna copertura confermata');
    await expect(checkPublicCoverage(vi.fn(async () => { throw new Error('sensitive upstream message'); }))).rejects.not.toThrow('sensitive');
  });
});
