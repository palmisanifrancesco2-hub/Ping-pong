import {describe,expect,it} from 'vitest';
import {marketEstimateReport,marketTarget} from '../server/market-estimates';
import type {ResultsArchive} from '../server/results';
import type {MatchResult} from '../src/domain/player-model';
import {bookmakerSelectionLabel,marketPriceKey,otherBookmakerMarkets} from '../src/shared/additional-markets';
import type {FeedMatch,FeedQuote} from '../src/shared/board';

const now=Date.parse('2026-11-21T14:00:00Z'),iso=(at:number)=>new Date(at).toISOString();
const base:FeedQuote={fixture_id:'match',group_id:'240',group_name:'Match',market_id:'920066',sel_id:'over74',
  side:'Over',line:'74.5',handicap:'74.5',ts:iso(now),odds_dec:1.92};
const under:FeedQuote={...base,sel_id:'under74',side:'Under'};
const exact:FeedQuote={...base,group_id:'920064',group_name:'Match Correct Score',market_id:undefined,
  sel_id:'exact',side:'A',line:'3-0',handicap:undefined};
const match:FeedMatch={id:'match',sport:'table_tennis',home:'A',away:'B',league:'Test',in_play:false,
  kickoff_utc:iso(now+10_000),group_status:{'240':{polled_at:iso(now)},'920064':{polled_at:iso(now)}},quotes:[base,under,exact]};
const results:MatchResult[]=Array.from({length:31},(_,i)=>({id:`past-${i}`,home:'A',away:'B',league:'Test',
  finishedAt:iso(now-(60-i)*60_000),availableAt:iso(i<30 ? now-(60-i)*60_000 : now+60_000),
  sets:[[11,6],[8,11],[11,9],[11,5]],homeWon:true}));
const archive:ResultsArchive={results,source:'postgres',checkedAt:iso(now),from:results[0].finishedAt,to:results.at(-1)!.finishedAt,rejected:0};

describe('additional Bet365 markets',()=>{
  it('keeps different market periods and prices distinct and excludes stale or suspended prices',()=>{
    const others=otherBookmakerMarkets({...match,quotes:[...match.quotes,
      {...base,sel_id:'suspended',suspended:true},{...base,sel_id:'old',phase:'inplay'},
      {...base,sel_id:'first',period:'1'},{...base,sel_id:'second',period:'2'},]},now);
    expect(others).toHaveLength(4);
    expect(others.flatMap(group=>group.quotes.map(q=>q.sel_id))).not.toContain('suspended');
    expect(others.flatMap(group=>group.quotes.map(q=>q.sel_id))).not.toContain('old');
    expect(marketPriceKey({...base,line:'79.5'})).not.toBe(marketPriceKey(base));
    expect(bookmakerSelectionLabel({ ...base, side:'A',label:'Under 74.5' })).toBe('A · Under 74,5');
  });
  it('uses exact lines, exact periods, and the correct complementary away handicap',()=>{
    expect(marketTarget(match,under)).toEqual({target:'points-over-74.5',invert:true});
    expect(marketTarget(match,{...base,line:'75.5',handicap:'75.5'})).toBeUndefined();
    expect(marketTarget(match,{...base,period:'1'})).toBeUndefined();
    expect(marketTarget(match,{...base,handicap:'79.5'})).toBeUndefined();
    expect(marketTarget(match,{...base,market_id:'920134',side:'B',line:'+5.5',handicap:'+5.5'}))
      .toEqual({target:'home-point-handicap-minus-5.5',invert:true});
    expect(marketTarget(match,{...base,group_id:'238',market_id:'920055',period:'1',side:'B',line:'-2.5',handicap:'-2.5'}))
      .toBeUndefined();
  });
  it('only estimates prematch with confirmed format and prior data and pairs complementary prices',()=>{
    const {estimates}=marketEstimateReport(match,archive,now);
    expect(Object.keys(estimates)).toHaveLength(2);
    expect(estimates[marketPriceKey(base)]+estimates[marketPriceKey(under)]).toBeCloseTo(1);
    expect(marketEstimateReport({...match,quotes:[base,under]},archive,now).estimates).toEqual({});
    expect(marketEstimateReport({...match,in_play:true},archive,now).estimates).toEqual({});
    expect(marketEstimateReport(match,{...archive,results:[...results.slice(0,29),results[30]]},now).estimates).toEqual({});
  });
});
