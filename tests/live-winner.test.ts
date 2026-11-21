import {describe,expect,it} from 'vitest';
import {liveWinnerEstimate} from '../server/live-winner';
import {parseBoard} from '../server/moviodds';
import artifact from '../models/live-score-only-v29.json';
import type {FeedMatch} from '../src/shared/board';
import {eventWinnerEstimate} from '../src/shared/quote-selection';
import {fairOddsText} from '../src/shared/format';
import type {ValueReport} from '../src/shared/value';

const at = '2026-11-21T14:00:00Z', now = Date.parse(at);
const match:FeedMatch = {
  id:'live',sport:'table_tennis',home:'A',away:'B',league:'Setka Cup',
  in_play:true,score:'11-8,8-11,11-7,3-5',polled_at:at,last_live_seen:at,
  group_status:{'920064':{polled_at:at}},
  quotes:[{fixture_id:'live',group_id:'920064',group_name:'Match Correct Score',sel_id:'one',
    line:'3-1',phase:'inplay',ts:at,odds_dec:2}]
};

describe('winner probabilities and fair odds in match details',()=>{
  it('uses the tested completed-set probability and retains the observed score from MoviOdds',()=>{
    const board=parseBoard({server_time:at,matches:[match]},at);
    const estimate=liveWinnerEstimate(board.matches[0],now)!;
    expect(estimate).toMatchObject({liveScore:match.score,completedSetScore:'2-1',homeProbability:artifact.probabilities['2-1']});
    const report:ValueReport={status:'blocked',checkedAt:at,opportunities:[],modelValidated:false,admVerified:false,reasons:[],
      winnerEstimates:{[match.id]:estimate}};
    expect(eventWinnerEstimate(report,match,now)).toBe(estimate);
    expect(eventWinnerEstimate(report,{...match,score:'11-8,8-11,11-7,4-5'},now)).toBeUndefined();
  });
  it('hides live probability for unconfirmed formats, stale readings, or unsupported match states',()=>{
    for (const changes of [
      {quotes:[]}, {quotes:[{...match.quotes[0],line:'4-2'}]}, {last_live_seen:undefined},
      {score:'2-1'}, {score:'8-7,11-3'}, {score:'11-6,11-6,11-6'}, {league:'Other'},
      {score:'12-4,5-1'}, {group_status:{'920064':{polled_at:at,stale:true}}},
    ]) expect(liveWinnerEstimate({...match,...changes},now)).toBeUndefined();
    expect(liveWinnerEstimate(match,now+60_001)).toBeUndefined();
  });
  it('uses the original model probability when calculating fair decimal odds',()=>{
    expect(fairOddsText(.58)).toBe('1,72');
    expect(fairOddsText(.42)).toBe('2,38');
    expect(fairOddsText(1/3)).toBe('3,00');
    for (const probability of [0,-.5,1.1,NaN,Infinity]) expect(fairOddsText(probability)).toBe('—');
  });
});
