import { createHash } from 'node:crypto';
export type Database = { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> };
export type Migration = { name: string; sql: string };
const checksum = (sql: string) => createHash('sha256').update(sql).digest('hex');
export function isInitialMigrationSet(names: string[]) {
  return names.join(',') === '202611040001_initial.sql,202611040002_private_membership.sql';
}
export async function applyMigrations(db: Database, migrations: Migration[]) {
  let applied = 0;
  await db.query('begin');
  try {
    await db.query("set local statement_timeout = '30s'");
    await db.query("set local lock_timeout = '10s'");
    await db.query('select pg_advisory_xact_lock(716245391)');
    const ledger = await db.query("select to_regclass('private.app_schema_migrations') as name");
    if (!ledger.rows[0]?.name) {
      const tables = await db.query("select tablename from pg_tables where schemaname='public'");
      if (tables.rows.length) throw new Error('Database già popolato: serve una verifica prima della migrazione iniziale.');
    }
    await db.query('create schema if not exists private');
    await db.query('revoke all on schema private from public');
    await db.query('create table if not exists private.app_schema_migrations(name text primary key, checksum text not null, applied_at timestamptz not null default now())');
    await db.query('revoke all on private.app_schema_migrations from public');
    const records = await db.query('select name,checksum from private.app_schema_migrations');
    const known = new Map(records.rows.map(r => [String(r.name),String(r.checksum)]));
    const names = new Set<string>();
    for (const migration of migrations) {
      if (!/^\d{12,}_[a-z0-9_]+\.sql$/.test(migration.name) || names.has(migration.name)) throw new Error('Elenco migrazioni non valido.');
      names.add(migration.name);
      const hash = checksum(migration.sql);
      if (known.has(migration.name)) {
        if (known.get(migration.name) !== hash) throw new Error('Checksum di una migrazione applicata modificato: aggiornamento interrotto.');
        continue;
      }
      // Only the outer transaction belongs to the runner; migration bodies are reviewed SQL files.
      const sql = migration.sql.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'');
      await db.query(sql);
      await db.query('insert into private.app_schema_migrations(name,checksum) values ($1,$2)', [migration.name,hash]);
      applied++;
    }
    for (const name of known.keys()) if (!names.has(name)) throw new Error('Migrazione già applicata assente dal repository: aggiornamento interrotto.');
    await db.query('commit');
    return { applied, total: migrations.length };
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
}

export async function reserveOwner(db: Database, email: string | undefined) {
  if (!email?.trim()) return { reserved: false, linkedUsers: 0 };
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Email proprietario non valida.');
  await db.query('begin');
  try {
    await db.query('insert into private.owner_emails(email) values ($1) on conflict do nothing',[normalized]);
    const rows = await db.query(`insert into public.authorized_users(user_id)
      select id from auth.users where lower(trim(email))=$1 and email_confirmed_at is not null
      on conflict do nothing returning user_id`,[normalized]);
    await db.query(`insert into public.profiles(user_id)
      select u.id from auth.users u join public.authorized_users a on a.user_id=u.id
      where lower(trim(u.email))=$1 on conflict do nothing`,[normalized]);
    await db.query('commit');
    return { reserved: true, linkedUsers: rows.rows.length };
  } catch (error) { await db.query('rollback'); throw error; }
}
