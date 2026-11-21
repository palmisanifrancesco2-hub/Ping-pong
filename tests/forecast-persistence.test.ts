import{PGlite}from'@electric-sql/pglite';import{readFile}from'node:fs/promises';import{beforeAll,afterAll,it,expect,vi}from'vitest';import{ForecastStore}from'../server/forecast-store';import type{Forecast}from'../src/shared/analysis';import type{FeedMatch}from'../src/shared/board';
let db:PGlite;const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
beforeAll(async()=>{db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid()to authenticated;`);for(const name of['202611040001_initial.sql','202611040002_private_membership.sql','202611040003_personal_choices.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));await db.exec(`insert into auth.users(id)values('${a}'),('${b}');insert into public.authorized_users(user_id)values('${a}'),('${b}');`);},30000);
afterAll(async()=>{vi.unstubAllGlobals();await db?.close();});
const now=Date.parse('2026-11-05T01:00:00Z');let predictionId:string;
it('persists an experimental snapshot through the real store against actual SQL constraints and preserves first probability',async()=>{
 vi.stubGlobal('fetch',async(input:string|URL|Request,init?:RequestInit)=>{const u=new URL(String(input)),table=u.pathname.split('/').at(-1)!;if(!['competitions','players','events','markets','bookmakers','quotes','model_versions','predictions'].includes(table))throw Error('Unexpected database request');
 const filters=[...u.searchParams.entries()].filter(([,v])=>v.startsWith('eq.'));const values=filters.map(([,v])=>v.slice(3)),where=filters.length?'where '+filters.map(([k],i)=>`"${k}"=$${i+1}`).join(' and '):'';
 if(init?.method==='POST'){const body=JSON.parse(String(init.body));const keys=Object.keys(body);const sql=`insert into public.${table}(${keys.map(k=>`"${k}"`).join(',')})values(${keys.map((_,i)=>'$'+(i+1)).join(',')})on conflict(id)do nothing returning id`;const r=await db.query(sql,keys.map(k=>typeof body[k]==='object'&&body[k]!==null?JSON.stringify(body[k]):body[k]));return new Response(JSON.stringify(r.rows),{status:201});}
 let sql:string;
 if(table==='predictions')sql=`select p.id,p.predicted_at,p.probability,json_build_object('decimal_odds',q.decimal_odds)as quote from public.predictions p join public.quotes q on q.id=p.quote_id ${where.replaceAll('"id"','p."id"').replaceAll('"user_id"','p."user_id"')}`;
 else sql=`select ${table==='events'?'home_id,away_id,starts_at,state':'decimal_odds'} from public.${table} ${where}`;
 const r=await db.query(sql,values);return new Response(JSON.stringify(r.rows[0]??null),{status:200});
 });
 const q={fixture_id:'future-synthetic',group_id:'920000',sel_id:'home',side:'A',line:'To Win',odds_dec:2.1,ts:new Date(now-1000).toISOString()};
 const m:FeedMatch={id:'future-synthetic',sport:'table_tennis',home:'A',away:'B',league:'Synthetic league',in_play:false,kickoff_utc:new Date(now+3600000).toISOString(),quotes:[q]};
 const f:Forecast={selection:'A',homeProbability:.6,probability:.6,probabilityLower:.5,sampleSize:40,quote:q,modelVersion:'synthetic-experimental',trainingCutoff:new Date(now-86400000).toISOString(),featuresAvailableAt:new Date(now-60000).toISOString(),validation:{n:3000,brier:.248,logLoss:.69,ece:.02},reliability:'synthetic test',modelValidated:false,modelName:'Synthetic score model',modelParameters:{synthetic:true}};
 const store=new ForecastStore({SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC',SUPABASE_SECRET_KEY:'sb_secret_SYNTHETIC'},()=>now);
 const first=await store.record(a,m,f);predictionId=first.id;expect(first.probability).toBe(.6);expect(first.created).toBe(true);
 const again=await store.record(a,m,{...f,probability:.9});expect(again.probability).toBe(.6);expect(again.created).toBe(false);
 const trial=await store.record(a,m,f,{studyId:'synthetic-protocol'});expect(trial.created).toBe(true);expect(trial.id).not.toBe(first.id);const trialAgain=await store.record(a,m,{...f,selection:'B',probability:.8},{studyId:'synthetic-protocol'});expect(trialAgain.id).toBe(trial.id);expect(trialAgain.created).toBe(false);expect(trialAgain.probability).toBe(.6);
 const rows=await db.query<{validated:boolean;features_available_at:string;probability:string}>(`select m.validated,p.features_available_at::text,p.probability::text from predictions p join model_versions m on m.id=p.model_id`);expect(rows.rows[0].validated).toBe(false);expect(Number(rows.rows[0].probability)).toBe(.6);expect(Date.parse(rows.rows[0].features_available_at)).toBe(now-60000);
});
it('isolates manual bets and enforces the prediction owner relationship in SQL',async()=>{
 async function as(user:string,sql:string){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');try{return await db.query(sql);}finally{await db.exec('reset role');}}
 await as(a,`insert into manual_bets(user_id,prediction_id,stake,decimal_odds,placed_at,notes)values('${a}','${predictionId}',10,2.1,now(),'synthetic')`);
 expect((await as(a,'select * from manual_bets')).rows).toHaveLength(1);expect((await as(b,'select * from manual_bets')).rows).toHaveLength(0);
 await expect(as(b,`insert into manual_bets(user_id,prediction_id,stake,decimal_odds,placed_at)values('${b}','${predictionId}',10,2,now())`)).rejects.toThrow();
 await expect(as(a,`insert into manual_bets(user_id,stake,decimal_odds,placed_at)values('${b}',10,2,now())`)).rejects.toThrow();
});
