import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { databaseClientConfig } from '../server/database-client.js';
import { applyMigrations } from '../server/migrations.js';
async function main() {
  if (process.env.APP_CHOICES_SETUP !== '1') { console.info('Choices setup: non richiesto.'); return; }
  if (process.env.VERCEL_ENV !== 'production') throw new Error('CHOICES_PRODUCTION_ONLY');
  const ca = await readFile(new URL('../certs/supabase-ca-2021.crt',import.meta.url),'utf8');
  const db = new Client(databaseClientConfig(process.env,ca)); db.on('error',()=>{});
  try {
    await db.connect();
    const names = ['202611040001_initial.sql','202611040002_private_membership.sql','202611040003_personal_choices.sql'];
    const migrations = await Promise.all(names.map(async name=>({name,sql:await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8')})));
    const result = await applyMigrations(db,migrations);
    const check = await db.query("select rowsecurity from pg_tables where schemaname='public' and tablename='personal_choices'");
    if (check.rows[0]?.rowsecurity !== true) throw new Error('CHOICES_RLS_FAILED');
    console.info(JSON.stringify({choicesSetup:'success',...result,rls:true}));
  } finally { await db.end().catch(()=>{}); }
}
try { await main(); } catch { console.error('CHOICES_SETUP_FAILED'); process.exitCode=1; }
