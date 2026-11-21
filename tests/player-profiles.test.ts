import {expect,it,vi} from 'vitest';
import {PlayerProfiles,profileCandidates} from '../server/player-profiles';
const item=(id:string)=>({mainsnak:{snaktype:'value',datavalue:{value:{id}}}});
const player={id:'Q123',labels:{en:{value:'Test Athlete'}},claims:{P31:[item('Q5')],P641:[item('Q3930')],P569:[{mainsnak:{snaktype:'value',datavalue:{value:{time:'+1990-01-02T00:00:00Z',precision:11,calendarmodel:'http://www.wikidata.org/entity/Q1985727'}}}}],P27:[item('Q38')]}};
it('requires exact name, human and table-tennis identity and excludes homonyms in other sports',()=>{
 expect(profileCandidates({entities:{Q123:player}},'test athlete')).toHaveLength(1);
 expect(profileCandidates({entities:{Q123:player}},'Test Athlet')).toEqual([]);
 expect(profileCandidates({entities:{Q123:{...player,claims:{P31:[item('Q5')],P641:[item('Q2736')]}}}},'Test Athlete')).toEqual([]);
 expect(profileCandidates({entities:{Q123:{...player,claims:{P641:[item('Q3930')]}}}},'Test Athlete')).toEqual([]);
});
it('uses documented read-only endpoints, caches results, and labels the match as a candidate',async()=>{
 let time=Date.parse('2026-11-05T00:00:00Z');
 const fetcher=vi.fn(async(input:URL|RequestInfo)=>{const u=new URL(String(input));expect(u.origin).toBe('https://www.wikidata.org');expect(u.pathname).toBe('/w/api.php');
  if(u.searchParams.get('action')==='wbsearchentities')return Response.json({search:[{id:'Q123'}]});
  return Response.json({entities:u.searchParams.get('props')==='labels'?{Q38:{id:'Q38',labels:{it:{value:'Italia'}}}}:{Q123:player}});
 });
 const p=new PlayerProfiles(fetcher,()=>time+=1000);const r=await p.lookup('Test Athlete');expect(r.status).toBe('candidate');expect(r.candidates[0]).toMatchObject({id:'Q123',birthDate:'1990-01-02',countries:['Italia'],url:'https://www.wikidata.org/wiki/Q123'});expect(r.license).toBe('CC0');
 await p.lookup('TEST ATHLETE');expect(fetcher).toHaveBeenCalledTimes(3);
});
it('does not invent fields, resolve ambiguous names or conceal provider failure',async()=>{
 let time=Date.parse('2026-11-05T00:00:00Z');const clock=()=>time+=1000;
 const fetcher=vi.fn(async(input:URL|RequestInfo)=>new URL(String(input)).searchParams.get('action')==='wbsearchentities'?Response.json({search:[{id:'Q123'},{id:'Q456'}]}):Response.json({entities:{Q123:{...player,claims:{P31:[item('Q5')],P641:[item('Q3930')]}},Q456:{...player,id:'Q456',claims:{P31:[item('Q5')],P641:[item('Q3930')]}}}}));
 const p=await new PlayerProfiles(fetcher,clock).lookup('Test Athlete');expect(p.status).toBe('ambiguous');expect(p.candidates).toHaveLength(2);expect(p.candidates[0].birthDate).toBeNull();expect(p.candidates[0].countries).toEqual([]);
 expect((await new PlayerProfiles(async()=>Response.json({search:[]}),clock).lookup('Test Athlete')).status).toBe('not_found');
 expect((await new PlayerProfiles(async()=>new Response('rate limit',{status:429}),clock).lookup('Test Athlete')).status).toBe('unavailable');
});
