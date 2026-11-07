import { describe, expect, it } from 'vitest';
import { browserSupabaseConfig } from '../server/build-config';
import { isPublishableSupabaseKey, validateSupabaseClientConfig } from '../src/shared/supabase-config';
const url = 'https://test-project.supabase.co';
const key = 'sb_publishable_SYNTHETIC_TEST';
const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role })).replace(/=/g, '')}.synthetic_signature`;
describe('Supabase public configuration boundary', () => {
  it('maps native integration configuration without copying any other server data', () => {
    expect(browserSupabaseConfig({ SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key, SUPABASE_SECRET_KEY: 'sb_secret_NOT_FOR_BROWSER', oddsapi: 'PRIVATE_API_TEST' })).toEqual({ url, key });
  });
  it('supports NEXT_PUBLIC and legacy VITE anon aliases', () => {
    expect(browserSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key })).toEqual({ url, key });
    expect(browserSupabaseConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: jwt('anon') })?.key).toBe(jwt('anon'));
  });
  it('accepts legacy anon JWTs but never service-role JWTs', () => {
    expect(isPublishableSupabaseKey(jwt('anon'))).toBe(true);
    expect(isPublishableSupabaseKey(jwt('service_role'))).toBe(false);
  });
  it.each(['sb_secret_SYNTHETIC',jwt('service_role'),'PRIVATE_API_TEST','malformed', 'sb_publishable_'])('rejects non-public keys without including the value in errors', value => {
    let message = '';
    try { browserSupabaseConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: value }); } catch (error) { message = (error as Error).message; }
    expect(message).toContain('non pubblicabile'); expect(message).not.toContain(value);
  });
  it('does not use an administrative key as an automatic fallback', () => {
    expect(browserSupabaseConfig({ SUPABASE_SECRET_KEY: 'sb_secret_TEST' })).toBeNull();
    expect(() => browserSupabaseConfig({ SUPABASE_URL: url, SUPABASE_SECRET_KEY: 'sb_secret_TEST' })).toThrow('incompleta');
  });
  it.each(['http://test.supabase.co','https://example.com','https://test.supabase.co.evil.test','https://test.supabase.co?key=private','https://user:pass@test.supabase.co','https://test.supabase.co/path'])('rejects incorrect hosted project URLs', projectUrl => {
    expect(() => validateSupabaseClientConfig(projectUrl,key)).toThrow();
  });
  it('allows an unconfigured app but rejects partial configuration', () => {
    expect(browserSupabaseConfig({})).toBeNull();
    expect(() => browserSupabaseConfig({ VITE_SUPABASE_URL: url })).toThrow('incompleta');
  });
});
