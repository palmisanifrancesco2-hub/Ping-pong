import { createClient } from '@supabase/supabase-js';
import { validateSupabaseClientConfig } from '../src/shared/supabase-config.js';
export type Env = Record<string, string | undefined>;
export async function authorize(token: string, env: Env): Promise<string | null> {
  const allowed = new Set((env.ALLOWED_USER_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean));
  try {
    const config = validateSupabaseClientConfig(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY);
    if (!config) return null;
    const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) } });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user || (allowed.size && !allowed.has(data.user.id))) return null;
    // Membership uses the caller's token and the same database registry as RLS.
    // No service-role key, local JWT decoding, or public registration grants access.
    const membership = await client.rpc('is_authorized_user');
    return !membership.error && membership.data === true ? data.user.id : null;
  } catch { return null; }
}
