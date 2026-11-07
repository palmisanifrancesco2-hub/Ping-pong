import { isPublishableSupabaseKey, validateSupabaseClientConfig } from '../src/shared/supabase-config.js';
type Env = Record<string, string | undefined>;
const publicKeyNames = ['VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;
export function browserSupabaseConfig(env: Env) {
  // Vercel's Supabase integration emits NEXT_PUBLIC_* and SUPABASE_* names.
  // Expose only an explicitly validated publishable key, never a Secret.
  for (const name of publicKeyNames) {
    const key = env[name]?.trim();
    if (key && !isPublishableSupabaseKey(key)) throw new Error(`${name}: chiave non pubblicabile. Rimuovere la credenziale privata da questa variabile pubblica.`);
  }
  const url = env.VITE_SUPABASE_URL?.trim() || env.NEXT_PUBLIC_SUPABASE_URL?.trim() || env.SUPABASE_URL?.trim();
  const key = publicKeyNames.map(name => env[name]?.trim()).find(Boolean) || env.SUPABASE_PUBLISHABLE_KEY?.trim() || env.SUPABASE_ANON_KEY?.trim();
  return validateSupabaseClientConfig(url, key);
}
