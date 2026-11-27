import {describe,expect,it} from 'vitest';
import {oddsCalibration} from '../src/domain/odds-calibration';

describe('odds calibration',()=>{
  it('includes 2 and 2.50 in the near band and places 3.65 in the long band',()=>{
    const report=oddsCalibration([
      {homeOdds:2,awayOdds:2,homeProbability:.76,candidate:.51,homeWon:true},
      {homeOdds:2.5,awayOdds:1.5,homeProbability:.4,homeWon:false},
      {homeOdds:3.65,awayOdds:1.3,homeProbability:.45,homeWon:false},
    ]);
    expect(report.map(x=>[x.matches,x.n])).toEqual([[2,3],[0,0],[1,1]]);
    expect(report[0].model?.wins).toBe(1);
    expect(report[0].prospective).toMatchObject({matches:1,n:2,model:{wins:1},candidate:{wins:1}});
    expect(report[2].model?.ev[2]).toMatchObject({selected:1,wins:0,losses:1});
  });
  it('rejects an underround and preserves a separate matched candidate sample',()=>{
    const report=oddsCalibration([
      {homeOdds:3,awayOdds:3,homeProbability:.6,candidate:.6,homeWon:true},
      {homeOdds:2.5,awayOdds:1.5,homeProbability:.6,homeWon:true},
    ]);
    expect(report[0]).toMatchObject({matches:1,n:1,prospective:{matches:0,n:0,candidate:null}});
    expect(report[0].model?.ev[1].selected).toBe(0); // Exact +50% is outside the filter.
    expect(report[1].n).toBe(0);
  });
});
