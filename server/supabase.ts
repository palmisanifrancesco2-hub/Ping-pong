import { createClient } from '@supabase/supabase-js';
import { validateSupabaseClientConfig } from '../src/shared/supabase-config.js';
import type { Env } from './auth.js';
export function userDatabase(token: string, env: Env, fetcher: typeof fetch = fetch) {
  const config = validateSupabaseClientConfig(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY);
  if (!config) throw new Error('DATABASE_NOT_CONFIGURED');
  return createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false }, global: {
    headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => fetcher(input, { ...init, signal: AbortSignal.timeout(12_000) }),
  } });
}
