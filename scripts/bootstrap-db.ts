import { readFile, readdir } from 'node:fs/promises';
import { Client } from 'pg';
import { applyMigrations, isInitialMigrationSet, reserveOwner } from '../server/migrations.js';
import { databaseClientConfig } from '../server/database-client.js';
async function main() {
  if (process.env.APP_DATABASE_SETUP !== '1') {
    console.info('Database setup: non richiesto per questo deployment.'); return;
  }
  if (process.env.VERCEL_ENV !== 'production') throw new Error('DB_ENVIRONMENT');
  const ca = await readFile(new URL('../certs/supabase-ca-2021.crt',import.meta.url),'utf8');
  const db = new Client(databaseClientConfig(process.env,ca));
  db.on('error', () => { /* Query/connect rejection is handled below without leaking credentials. */ });
  try {
    await db.connect();
    const identity = await db.query('select current_user as username');
    if (!identity.rows.length) throw new Error('DB_IDENTITY');
    const directory = new URL('../supabase/migrations/', import.meta.url);
    const names = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort();
    if (!isInitialMigrationSet(names)) throw new Error('DB_NEW_MIGRATIONS_NEED_APPROVAL');
    const migrations = await Promise.all(names.map(async name => ({ name,sql:await readFile(new URL(name,directory),'utf8') })));
    const result = await applyMigrations(db,migrations);
    const owner = await reserveOwner(db,process.env.APP_OWNER_EMAIL);
    const check = await db.query("select count(*)::int as tables, bool_and(rowsecurity) as rls from pg_tables where schemaname='public'");
    if (check.rows[0].tables !== 14 || check.rows[0].rls !== true) throw new Error('DB_SCHEMA_VERIFICATION');
    console.info(JSON.stringify({ databaseSetup: 'success', ...result, publicTables: check.rows[0].tables, rlsEnabledOnAllPublicTables: check.rows[0].rls, ownerReserved: owner.reserved, newlyLinkedOwnerAccounts: owner.linkedUsers }));
  } finally { await db.end().catch(() => {}); }
}
try { await main(); } catch (error) {
  // Connection errors may include passwords, URLs, SQL, user emails or server internals.
  console.error('Database setup non riuscito: controllo target, TLS o migrazione fallito. Nessuna credenziale viene mostrata.');
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : error instanceof Error ? error.message : '';
  if (/^[A-Z0-9_]{3,60}$/.test(code)) console.error(`Diagnostic code: ${code}`);
  process.exitCode = 1;
}
