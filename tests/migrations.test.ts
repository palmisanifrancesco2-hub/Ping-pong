import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { applyMigrations, isInitialMigrationSet, reserveOwner, type Database, type Migration } from '../server/migrations';
const instances: PGlite[] = [];
afterEach(async () => { await Promise.all(instances.splice(0).map(db => db.close())); });
async function fresh() {
  const db = new PGlite(); instances.push(db);
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  const adapter: Database = { async query(sql,params) {
    if (params?.length) return db.query(sql,params);
    const results = await db.exec(sql);
    return { rows: results.at(-1)?.rows as Record<string,unknown>[] ?? [] };
  } };
  return { db, adapter };
}
async function files(): Promise<Migration[]> {
  const root = new URL('../supabase/migrations/',import.meta.url);
  const names = (await readdir(root)).filter(n => n.endsWith('.sql')).sort();
  return Promise.all(names.map(async name => ({ name,sql:await readFile(new URL(name,root),'utf8') })));
}
describe('transactional database setup', () => {
  it('limits the production bootstrap to the exact two initial migrations', () => {
    expect(isInitialMigrationSet(['202611040001_initial.sql','202611040002_private_membership.sql'])).toBe(true);
    expect(isInitialMigrationSet(['202611040001_initial.sql','202611040002_private_membership.sql','202611040003_extra.sql'])).toBe(false);
    expect(isInitialMigrationSet([])).toBe(false);
  });
  it('applies all reviewed migrations once and verifies their checksums on rerun', async () => {
    const { db,adapter } = await fresh(); const migrations = await files();
    expect(await applyMigrations(adapter,migrations)).toEqual({ applied:2,total:2 });
    expect(await applyMigrations(adapter,migrations)).toEqual({ applied:0,total:2 });
    const tables = await db.query<{ rowsecurity:boolean }>("select rowsecurity from pg_tables where schemaname='public'");
    expect(tables.rows).toHaveLength(14); expect(tables.rows.every(t => t.rowsecurity)).toBe(true);
  });
  it('refuses an existing unknown database without creating the ledger', async () => {
    const { db,adapter } = await fresh(); await db.exec('create table public.existing_data(id int)');
    await expect(applyMigrations(adapter,await files())).rejects.toThrow('già popolato');
    expect((await db.query("select to_regclass('private.app_schema_migrations') as name")).rows[0]).toEqual({ name:null });
  });
  it('rolls back an entire failed batch including newly created tables', async () => {
    const { db,adapter } = await fresh();
    const migrations = [...await files(),{ name:'202611040003_broken.sql',sql:'create table public.rollback_marker(id int); select definitely_missing_function();' }];
    await expect(applyMigrations(adapter,migrations)).rejects.toThrow();
    expect((await db.query("select tablename from pg_tables where schemaname='public'")).rows).toEqual([]);
  });
  it('rejects changed or removed applied migrations', async () => {
    const { adapter } = await fresh(); const migrations = await files(); await applyMigrations(adapter,migrations);
    await expect(applyMigrations(adapter,[{ ...migrations[0],sql:migrations[0].sql+'\n-- changed' },migrations[1]])).rejects.toThrow('Checksum');
    await expect(applyMigrations(adapter,[migrations[0]])).rejects.toThrow('assente');
  });
  it('reserves an email without creating an Auth account or sending any message', async () => {
    const { db,adapter } = await fresh(); await applyMigrations(adapter,await files());
    expect(await reserveOwner(adapter,' Owner@Example.test ')).toEqual({ reserved:true,linkedUsers:0 });
    expect((await db.query('select * from auth.users')).rows).toHaveLength(0);
    expect((await db.query('select * from public.authorized_users')).rows).toHaveLength(0);
  });
  it('grants membership only after a reserved email is verified, not for other users', async () => {
    const { db,adapter } = await fresh(); await applyMigrations(adapter,await files()); await reserveOwner(adapter,'owner@example.test');
    await db.exec(`insert into auth.users(id,email,email_confirmed_at) values
      ('11111111-1111-4111-8111-111111111111','owner@example.test',null),
      ('22222222-2222-4222-8222-222222222222','stranger@example.test',now());`);
    expect((await db.query('select * from public.authorized_users')).rows).toHaveLength(0);
    await db.exec("update auth.users set email_confirmed_at=now() where email='owner@example.test'");
    expect((await db.query('select * from public.authorized_users')).rows).toHaveLength(1);
    await db.exec("select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false); set role authenticated;");
    expect((await db.query('select public.is_authorized_user() as member')).rows[0]).toEqual({ member:false });
    await expect(db.query('select * from private.owner_emails')).rejects.toThrow();
    await db.exec('reset role');
    await db.exec("select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false); set role authenticated;");
    expect((await db.query('select public.is_authorized_user() as member')).rows[0]).toEqual({ member:true });
    await db.exec('reset role');
  });
  it('links existing verified owner accounts idempotently', async () => {
    const { db,adapter } = await fresh(); await applyMigrations(adapter,await files());
    await db.exec("insert into auth.users(id,email,email_confirmed_at) values ('11111111-1111-4111-8111-111111111111','owner@example.test',now())");
    expect(await reserveOwner(adapter,'owner@example.test')).toEqual({ reserved:true,linkedUsers:1 });
    expect(await reserveOwner(adapter,'owner@example.test')).toEqual({ reserved:true,linkedUsers:0 });
  });
});
