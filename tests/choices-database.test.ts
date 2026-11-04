import{PGlite}from'@electric-sql/pglite';import{readFile}from'node:fs/promises';import{beforeAll,afterAll,describe,it,expect}from'vitest';
let db:PGlite;const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
beforeAll(async()=>{db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid()to authenticated;`);
 for(const name of['202611040001_initial.sql','202611040002_private_membership.sql','202611040003_personal_choices.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 await db.exec(`insert into auth.users(id)values('${a}'),('${b}'),('${c}');insert into public.authorized_users(user_id)values('${a}'),('${b}');`);
},30000);afterAll(async()=>db?.close());
async function as(id:string,sql:string){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');try{return await db.query(sql);}finally{await db.exec('reset role');}}
describe('new personal choices RLS',()=>{
 it('isolates two authorized users and denies nonmembers and forged ownership',async()=>{
  await as(a,`insert into public.personal_choices(user_id,event_source_id,choice_key,snapshot)values('${a}','e','event','{}')`);
  expect((await as(a,'select * from public.personal_choices')).rows).toHaveLength(1);expect((await as(b,'select * from public.personal_choices')).rows).toHaveLength(0);expect((await as(c,'select * from public.personal_choices')).rows).toHaveLength(0);
  await expect(as(a,`insert into public.personal_choices(user_id,event_source_id,choice_key,snapshot)values('${b}','f','event','{}')`)).rejects.toThrow();
 });
 it('permits notes and manual outcome but prevents rewriting the price snapshot or deleting history',async()=>{
  await as(a,"update public.personal_choices set notes='test',manual_status='won',manual_settled_at=now()");
  await expect(as(a,"update public.personal_choices set snapshot='{}'")).rejects.toThrow();await expect(as(a,'delete from public.personal_choices')).rejects.toThrow();
  await expect(db.exec('set role anon;select * from public.personal_choices')).rejects.toThrow();await db.exec('reset role');
 });
});
