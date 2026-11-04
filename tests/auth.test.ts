import { afterEach, describe, expect, it, vi } from 'vitest';
const getUser = vi.hoisted(() => vi.fn());
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser } }) }));
import { authorize } from '../server/auth';
const env = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_TEST', ALLOWED_USER_IDS: 'allowed-user' };
afterEach(() => getUser.mockReset());
describe('Supabase authorization gate', () => {
  it('requires both a verified token and explicit membership', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'allowed-user' } }, error: null });
    expect(await authorize('test-token',env)).toBe('allowed-user');
    expect(getUser).toHaveBeenCalledWith('test-token');
    getUser.mockResolvedValue({ data: { user: { id: 'stranger' } }, error: null });
    expect(await authorize('test-token',env)).toBeNull();
  });
  it('rejects expired or invalid sessions even if a user id is returned', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'allowed-user' } }, error: { message: 'expired' } });
    expect(await authorize('test-token',env)).toBeNull();
  });
  it('fails closed on authentication service failures', async () => {
    getUser.mockRejectedValue(new Error('network failure'));
    expect(await authorize('test-token',env)).toBeNull();
  });
  it('accepts the native Vercel integration publishable key', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'allowed-user' } }, error: null });
    expect(await authorize('test-token', { ...env, SUPABASE_ANON_KEY: undefined, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_TEST' })).toBe('allowed-user');
  });
  it('rejects an administrative credential before contacting Auth', async () => {
    expect(await authorize('test-token', { ...env, SUPABASE_ANON_KEY: 'sb_secret_TEST' })).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });
});
