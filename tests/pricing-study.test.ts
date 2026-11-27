import {describe,expect,it} from 'vitest';
import {archivedPricingPairs,expectedReturn,paperSides,pricingReport,pricingSnapshot,removeMargin} from '../server/pricing-study';
import type {Board,FeedMatch,FeedQuote} from '../src/shared/board';

const at=Date.parse('2026-11-27T07:30:00Z');
const stamp=(offset=0)=>new Date(at+offset).toISOString();
const quote:FeedQuote={fixture_id:'123',group_id:'920000',market_id:'920000',sel_id:'a',
  side:'A',line:'To Win',ts:stamp(-15_000),odds_dec:2.5,suspended:false,phase:'prematch'};
const opponent:FeedQuote={...quote,side:'B',sel_id:'b',odds_dec:1.55};
const match:FeedMatch={id:'123',sport:'table_tennis',home:'A',away:'B',league:'Setka Cup',
  in_play:false,kickoff_utc:stamp(600_000),group_status:{920000:{polled_at:stamp(-10_000)}},quotes:[quote,opponent]};
const board:Board={provider:'MoviOdds',bookmakerSite:'bet365.com.au',checkedAt:stamp(),serverTime:stamp(),warming:false,matches:[match]};

describe('Setka quote research',()=>{
  it('distinguishes removal methods and settles all five possible payout states',()=>{
    const fair=removeMargin([2.5,1.55])!;
    expect(fair.proportional).toBeCloseTo(1.55/4.05);
    expect(fair.power).toBeLessThan(fair.proportional);
    expect(removeMargin([3,3])).toBeNull();
    expect(expectedReturn(2,[.1,.2,.4,.2,.1])).toBeCloseTo(0);
    expect(expectedReturn(2,[0,0,1,0,0])).toBe(0);
    expect(expectedReturn(2,[0,0,0,0,.9])).toBeNull();
  });
  it('requires complete fresh pairs and preserves the observed foreign site',()=>{
    const shot=pricingSnapshot(board,match,at,{winner:.60})!;
    expect(shot).toMatchObject({site:'bet365.com.au',availability:'feed_observed',markets:[{model:.60,target:'winner'}]});
    const [home]=paperSides(shot);
    expect(home).toMatchObject({market:'winner',trial:true,ev:.50});
    expect(home.fair).toBeCloseTo(1/.60);
    for(const q of [{...opponent,suspended:true},{...opponent,ts:stamp(1)},{...opponent,ts:stamp(-120_001)},
      {...opponent,phase:'inplay' as const},{...opponent,fixture_id:'another'}]){
      expect(pricingSnapshot(board,{...match,quotes:[quote,q]},at)).toBeNull();
    }
    expect(pricingSnapshot(board,{...match,quotes:[quote]},at)).toBeNull();
    expect(pricingSnapshot(board,{...match,quotes:[quote,opponent,{...opponent,sel_id:'extra'}]},at)).toBeNull();
  });
  it('matches the same market and line and rejects prices beyond the start guard',()=>{
    const payload={pre_close_basis:'kickoff',selections:[quote,opponent].map(q=>({...q,pre_close:q}))};
    expect(archivedPricingPairs(payload,match,at)).toHaveLength(1);
    expect(archivedPricingPairs(payload,match,at-16_000)).toHaveLength(0);
    expect(archivedPricingPairs({...payload,selections:[payload.selections[0],{...opponent,pre_close:{...opponent,line:'Total'}}]},match,at)).toHaveLength(0);
  });
  it('settles only pre-start simulations and uses later observations for the latency check',()=>{
    const shot=pricingSnapshot(board,match,at,{winner:.6})!;
    const next={...shot,observedAt:stamp(90_000)};
    const data={snapshots:[shot,next],ledger:[{paper:paperSides(shot)[0],createdAt:at+100}]};
    const sets:[[number,number],[number,number],[number,number]]=[[11,7],[11,9],[11,8]];
    const settled={home:'A',away:'B',league:'Setka Cup',actualGuard:at+500_000,invalid:false,sets};
    const report=pricingReport(data,new Map([[match.id,settled]]),at+900_000);
    expect(report.admOpportunities).toEqual([]);
    expect(report.summary[0]).toMatchObject({settled:1,exact:1,simulatedRoi:1.5,delay:1,delayedRoi:1.5});
    expect(pricingReport(data,new Map([[match.id,{...settled,actualGuard:at}]]),at).summary[0].settled).toBe(0);
    expect(pricingReport(data,new Map([[match.id,{...settled,home:'B',away:'A'}]]),at).summary[0].settled).toBe(0);
  });
});
