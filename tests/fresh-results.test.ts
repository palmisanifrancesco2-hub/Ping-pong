import {describe,expect,it} from 'vitest';
import {benchmarkFreshResults} from '../scripts/benchmark-fresh-results';
import type {MatchResult} from '../src/domain/player-model';
import type {ResultsArchive} from '../server/results';
import {bookmakerOddsText,fairOddsText} from '../src/shared/format';

const make=(id:string,finishedAt:string,availableAt=finishedAt):MatchResult=>({
  id,finishedAt,availableAt,league:'QA only',home:'A',away:'B',homeWon:true,sets:[[11,8],[11,7],[11,5]],
});

describe('new chronological test cohort',()=>{
  it('waits for prior outcomes to be available and excludes dates outside the test',()=>{
    const past=Array.from({length:30},(_,i)=>make(`history-${i}`,'2026-11-04T13:00:00Z',
      i===29?'2026-11-06T00:00:00Z':'2026-11-04T13:00:00Z'));
    const archive:ResultsArchive={source:'postgres',checkedAt:'2026-11-21T18:00:00Z',from:null,to:null,rejected:0,
      results:[...past,make('early','2026-11-06T12:00:00Z'),make('later','2026-11-07T10:00:00Z'),
        make('outside','2026-11-21T12:00:00Z')]};
    const result=benchmarkFreshResults(archive);
    expect(result.combined.n).toBe(2);
    expect(result.logistic.n).toBe(1);
    expect(result.elo.n).toBe(1);
    expect(result.testDays).toBe(2);
  });
  it('formats the offered bookmaker price separately from the model inverse probability',()=>{
    expect(bookmakerOddsText(2.125)).toBe('2,125');
    expect(fairOddsText(.58)).toBe('1,72');
    expect(bookmakerOddsText(undefined)).toBe('—');
    expect(fairOddsText(0)).toBe('—');
  });
});
