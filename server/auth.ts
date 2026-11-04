import { createClient } from '@supabase/supabase-js';
export type Env = Record<string, string | undefined>;
export async function authorize(token: string, env: Env): Promise<string | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.ALLOWED_USER_IDS) return null;
  const allowed = new Set(env.ALLOWED_USER_IDS.split(',').map(s => s.trim()).filter(Boolean));
  try {
    const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) } });
    const { data, error } = await client.auth.getUser(token);
    return !error && data.user && allowed.has(data.user.id) ? data.user.id : null;
  } catch { return null; }
}
