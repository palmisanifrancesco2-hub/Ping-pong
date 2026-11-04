import { createClient } from '@supabase/supabase-js';
import { HISTORY_SELECT } from '../server/history.js';
import { validateSupabaseClientConfig } from '../src/shared/supabase-config.js';

// Build-only diagnostic: no private rows returned, no insert/update or user impersonation.
async function main() {
  if (process.env.VERCEL_ENV !== 'production') { console.info('History schema verification: non richiesta in questo ambiente.'); return; }
  const config = validateSupabaseClientConfig(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY);
  const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !serverKey) throw new Error('HISTORY_SCHEMA_NOT_CONFIGURED');
  const client = createClient(config.url, serverKey, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(12_000) }) } });
  const result = await client.from('predictions').select(HISTORY_SELECT).limit(0);
  if (result.error || !Array.isArray(result.data) || result.data.length !== 0) throw new Error('HISTORY_SCHEMA_QUERY_FAILED');
  const choices = await client.from('personal_choices').select('id,snapshot,saved_at,notes,manual_status,manual_settled_at').limit(0);
  if(choices.error||!Array.isArray(choices.data)||choices.data.length!==0)throw new Error('CHOICES_SCHEMA_QUERY_FAILED');
  console.info(JSON.stringify({ historySchemaVerification: 'success', readOnly: true, returnedRows: 0 }));
  console.info(JSON.stringify({ choicesSchemaVerification: 'success', readOnly: true, returnedRows: 0 }));
}
try { await main(); } catch { console.error('HISTORY_SCHEMA_VERIFICATION_FAILED'); process.exitCode = 1; }
