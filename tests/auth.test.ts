import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const getUser = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser },rpc }) }));
import { authorize } from '../server/auth';
const env = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_TEST', ALLOWED_USER_IDS: 'allowed-user' };
beforeEach(() => rpc.mockResolvedValue({ data: true, error: null }));
afterEach(() => { getUser.mockReset(); rpc.mockReset(); });
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
  it('uses database membership when the optional UUID restriction is absent', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'database-member' } }, error: null });
    expect(await authorize('test-token',{ ...env, ALLOWED_USER_IDS: '' })).toBe('database-member');
    expect(rpc).toHaveBeenCalledWith('is_authorized_user');
  });
  it('denies valid sessions that are not database members', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'allowed-user' } }, error: null });
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await authorize('test-token',env)).toBeNull();
  });
  it('denies access when membership schema is missing or the database is unreachable', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'allowed-user' } }, error: null });
    rpc.mockResolvedValue({ data: null, error: { message: 'function missing' } });
    expect(await authorize('test-token',env)).toBeNull();
  });
});
