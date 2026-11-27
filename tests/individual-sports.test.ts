import {describe,expect,it,vi} from 'vitest';
import {IndividualSports,sportDetail} from '../server/individual-sports';
import type { FeedMatch,FeedQuote } from '../src/shared/board';

const at='2026-11-21T18:00:00Z';
const now=Date.parse(at);
const quote:FeedQuote={fixture_id:'123',group_id:'67',group_name:'To Win Match',market_id:'1',sel_id:'same',label:'A',odds_dec:1.7,ts:at,phase:'inplay'};
const event:FeedMatch<'tennis'>={id:'123',sport:'tennis',home:'A',away:'B',league:'ATP Example',in_play:true,polled_at:at,
  group_status:{67:{polled_at:at}},quotes:[quote],stats:{sport:'tennis',home:{aces:2},away:{aces:3}}};

describe('individual sport quote coverage',()=>{
  it('uses only the configured sport and excludes doubles and completed events',async()=>{
    const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      expect(String(input)).toBe('https://moviodds.com/odds?sport=tennis&stats=1');
      expect(new Headers(init?.headers).get('x-api-key')).toBe('fixture-only');
      return Response.json({server_time:at,markets:'main',matches:[event,
        {...event,id:'124',home:'A / C',quotes:[]},
        {...event,id:'125',league:'ATP Doubles',quotes:[]},
        {...event,id:'126',in_play:false,kickoff_utc:at,quotes:[]},
      ]});
    });
    const sports=new IndividualSports({MOVIODDS_API_KEY:'fixture-only'},()=>now,fetcher);
    const [board,detail]=await Promise.all([sports.board('tennis'),sports.event('tennis','123')]);
    expect(board.events.map(row=>row.id)).toEqual(['123']);
    expect(board.events[0]).not.toHaveProperty('quotes');
    expect(board.mainLinesOnly).toBe(true);
    expect(detail?.stats).toEqual([{label:'Ace',first:'2',second:'3'}]);
    expect(detail?.groups[0].quotes[0].status).toBe('Letta di recente dalla fonte');
    expect(await sports.event('tennis','124')).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keeps market periods distinct and flags stale and future prices',()=>{
    const detail=sportDetail({...event,quotes:[quote,{...quote,period:'Set 1',ts:new Date(now+1000).toISOString()}]},at,now);
    expect(detail.groups).toHaveLength(2);
    expect(detail.groups[1].quotes[0].status).toBe('Orario quota da verificare');
    const stale=sportDetail({...event,group_status:undefined},at,now);
    expect(stale.groups[0].quotes[0].status).toBe('Aggiornamento non confermato');
  });
});
