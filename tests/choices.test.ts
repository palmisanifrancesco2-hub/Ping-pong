import{describe,it,expect,vi}from'vitest';
import{choiceSnapshot,Choices,saveChoiceSchema}from'../server/choices';
import{quoteIdentity,type Board}from'../src/shared/board';
const now=Date.parse('2026-11-04T12:00:00Z');
const q={fixture_id:'e',group_id:'winner',sel_id:'a',label:'Test A',odds_dec:2.1,ts:new Date(now).toISOString()};
const board:Board={provider:'MoviOdds',bookmakerSite:'bet365.com.au',checkedAt:new Date(now).toISOString(),serverTime:new Date(now).toISOString(),warming:false,matches:[{id:'e',sport:'table_tennis',home:'Test A',away:'Test B',league:'Test league',in_play:false,kickoff_utc:new Date(now+3600000).toISOString(),group_status:{winner:{polled_at:new Date(now).toISOString()}},quotes:[q]}]};
const env={SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC'};
describe('personal choices and immutable price snapshots',()=>{
 it('saves the provider price and selection separately from watch-only games',()=>{
  expect(choiceSnapshot(board,'e',undefined,now).selection).toBeNull();
  expect(choiceSnapshot(board,'e',quoteIdentity(q),now).selection).toMatchObject({label:'Test A',odds:2.1,quoteAt:q.ts});
 });
 it('rejects gone events, stale or suspended prices and forged snapshot input',()=>{
  expect(()=>choiceSnapshot(board,'gone',undefined,now)).toThrow();
  expect(()=>choiceSnapshot(board,'e',quoteIdentity(q),now+180000)).toThrow();
  expect(saveChoiceSchema.safeParse({eventId:'e',odds:1000,userId:'other'}).success).toBe(false);
 });
 it('keeps the first saved price on repeat clicks and sends caller JWT and ownership',async()=>{
  let calls=0;const fetcher=vi.fn(async(input:URL|RequestInfo,init?:RequestInit)=>{expect(new Headers(init?.headers).get('authorization')).toBe('Bearer token');const url=new URL(String(input));
   if(calls++===0){expect(init?.method).toBe('POST');expect(JSON.parse(String(init?.body))).toMatchObject({user_id:'owner',event_source_id:'e'});return Response.json({code:'23505'},{status:409});}
   expect(init?.method).toBe('GET');expect(url.searchParams.get('user_id')).toBe('eq.owner');return Response.json({id:'first',snapshot:{selection:{odds:1.9}}});});
  const result=await new Choices(env,fetcher,()=>now).save('token','owner',{eventId:'e',quoteKey:quoteIdentity(q),expectedOdds:q.odds_dec,expectedUpdatedAt:q.ts,notes:''},board);
  expect(result.snapshot.selection.odds).toBe(1.9);expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('refuses a price that changed since the user selected it',async()=>{
  const fetcher=vi.fn();await expect(new Choices(env,fetcher,()=>now).save('token','owner',{eventId:'e',quoteKey:quoteIdentity(q),expectedOdds:1.8,expectedUpdatedAt:q.ts,notes:''},board)).rejects.toThrow('CHOICE_QUOTE_UNAVAILABLE');expect(fetcher).not.toHaveBeenCalled();
 });
 it('does not allow settling a watched game with no chosen selection',async()=>{
  const fetcher=vi.fn(async()=>Response.json({snapshot:{selection:null}}));
  await expect(new Choices(env,fetcher,()=>now).update('t','owner',{id:'11111111-1111-4111-8111-111111111111',status:'won',notes:''})).rejects.toThrow('CHOICE_WATCH_ONLY');
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
});
