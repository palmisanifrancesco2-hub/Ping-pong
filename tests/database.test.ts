import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
let db: PGlite;
const member = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202611040001_initial.sql', import.meta.url), 'utf8'));
  await db.query('insert into auth.users values ($1),($2)', [member,other]);
  await db.query('insert into public.authorized_users(user_id) values ($1)', [member]);
  await db.exec("insert into public.players(source,source_id,display_name) values ('test','synthetic-a','Test player');");
}, 30_000);
afterAll(async () => { await db?.close(); });
async function asUser(id: string, query: string) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('set role authenticated');
  try { return await db.query(query); } finally { await db.exec('reset role'); }
}
describe('PostgreSQL migration and RLS', () => {
  it('enables RLS on every application table', async () => {
    const result = await db.query<{ tablename: string; rowsecurity: boolean }>("select tablename,rowsecurity from pg_tables where schemaname='public'");
    expect(result.rows.length).toBe(14);
    expect(result.rows.every(r => r.rowsecurity)).toBe(true);
  });
  it('allows members to read sporting data and denies non-members', async () => {
    expect((await asUser(member,'select * from public.players')).rows).toHaveLength(1);
    expect((await asUser(other,'select * from public.players')).rows).toHaveLength(0);
  });
  it('prevents a browser from authorizing itself', async () => {
    await expect(asUser(other,`insert into public.authorized_users(user_id) values ('${other}')`)).rejects.toThrow();
  });
  it('isolates manual bets and rejects forged ownership', async () => {
    await asUser(member,`insert into public.manual_bets(user_id,stake,decimal_odds,placed_at) values ('${member}',10,2,now())`);
    expect((await asUser(member,'select * from public.manual_bets')).rows).toHaveLength(1);
    expect((await asUser(other,'select * from public.manual_bets')).rows).toHaveLength(0);
    await expect(asUser(member,`insert into public.manual_bets(user_id,stake,decimal_odds,placed_at) values ('${other}',10,2,now())`)).rejects.toThrow();
  });
  it('rejects invalid stakes and prevents sporting data writes by members', async () => {
    await expect(asUser(member,`insert into public.manual_bets(user_id,stake,decimal_odds,placed_at) values ('${member}',-1,2,now())`)).rejects.toThrow();
    await expect(asUser(member,"insert into public.players(source,source_id,display_name) values ('test','forged','Forged')")).rejects.toThrow();
  });
});
