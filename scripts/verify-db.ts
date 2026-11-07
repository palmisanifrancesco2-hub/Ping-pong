import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { databaseClientConfig } from '../server/database-client.js';
import { verifyPrivateAccess } from '../server/verify-access.js';
async function main() {
  if (process.env.VERCEL_ENV !== 'production' || !process.env.POSTGRES_URL) {
    console.info('Database access verification: non richiesta per questo ambiente.'); return;
  }
  const ca = await readFile(new URL('../certs/supabase-ca-2021.crt',import.meta.url),'utf8');
  const db = new Client(databaseClientConfig(process.env,ca));
  db.on('error',()=>{});
  try { await db.connect(); console.info(JSON.stringify({ databaseAccessVerification:'success',readOnly:true,...await verifyPrivateAccess(db,process.env.APP_OWNER_EMAIL) }));
    await db.query('begin read only');
    try {
      const check=await db.query(`select
        (select rowsecurity from pg_tables where schemaname='public' and tablename='personal_choices') as rls,
        has_table_privilege('anon','public.personal_choices','select') as anonymous_read,
        has_table_privilege('authenticated','public.personal_choices','delete') as can_delete,
        has_column_privilege('authenticated','public.personal_choices','snapshot','update') as rewrite_snapshot,
        has_column_privilege('authenticated','public.personal_choices','notes','update') as edit_notes`);
      const r=check.rows[0];if(r.rls!==true||r.anonymous_read!==false||r.can_delete!==false||r.rewrite_snapshot!==false||r.edit_notes!==true)throw new Error('CHOICES_PRIVACY_FAILED');
      console.info(JSON.stringify({choicesAccessVerification:'success',readOnly:true,rls:true,anonymousDenied:true,snapshotImmutable:true,deletionDenied:true}));
    }finally{await db.query('rollback');}
  }
  finally { await db.end().catch(()=>{}); }
}
try { await main(); } catch(error) {
  console.error('Verifica accesso database non riuscita. Nessuna credenziale o dato personale viene mostrato.');
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : error instanceof Error ? error.message : '';
  if (/^[A-Z0-9_]{3,60}$/.test(code)) console.error(`Diagnostic code: ${code}`);
  process.exitCode=1;
}
