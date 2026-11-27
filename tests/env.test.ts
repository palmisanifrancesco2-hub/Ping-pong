import { describe, expect, it } from 'vitest';
import { oddsApiKey } from '../server/env';
describe('server-only provider configuration', () => {
  it('accepts the existing Vercel secret alias', () => {
    expect(oddsApiKey({ oddsapi: ' TEST_ALIAS ' })).toBe('TEST_ALIAS');
  });
  it('gives the documented name precedence when both exist', () => {
    expect(oddsApiKey({ THE_ODDS_API_KEY: 'TEST_PRIMARY', oddsapi: 'TEST_ALIAS' })).toBe('TEST_PRIMARY');
  });
  it('falls back if the documented variable is blank', () => {
    expect(oddsApiKey({ THE_ODDS_API_KEY: ' ', oddsapi: 'TEST_ALIAS' })).toBe('TEST_ALIAS');
  });
  it('never takes an API key from a browser-public variable', () => {
    expect(oddsApiKey({ VITE_THE_ODDS_API_KEY: 'TEST_PUBLIC' })).toBeUndefined();
    expect(oddsApiKey({})).toBeUndefined();
  });
});
