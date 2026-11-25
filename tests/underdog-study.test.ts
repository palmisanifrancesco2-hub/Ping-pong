import {describe,expect,it} from 'vitest';
import {disagreementReport,disagreementStartAt as start} from '../src/domain/underdog-study';

describe('market and model favorite disagreements',()=>{
  it('partitions saved cases by time, honors 3.65 inclusively and preserves expected unit returns',()=>{
    const high={homeOdds:3.65,awayOdds:1.25,homeProbability:.58,homeWon:true};
    const r=disagreementReport([
      {...high,at:start-1}, {...high,at:start,peerHomeProbability:.54}, {...high,at:start,homeWon:false,peerHomeProbability:.48},
      {...high,at:start,homeProbability:.4},
      {at:start,homeOdds:1.35,awayOdds:3,homeProbability:.45,homeWon:false},
      {at:start,homeOdds:1.85,awayOdds:1.85,homeProbability:.61,homeWon:true},
      {at:start,homeOdds:2.1,awayOdds:1.55,homeProbability:.5,homeWon:true},
    ]);
    expect(r.earlier[3]).toMatchObject({available:1,n:1,exact:1});
    expect(r.forward[3]).toMatchObject({available:3,n:2,exact:1,wrong:1,days:1});
    expect(r.forward[3].roi).toBeCloseTo(.825);
    expect(r.forward[3].consensus).toMatchObject({available:2,n:1,exact:1,wrong:0,roi:2.65});
    expect(r.forward[2]).toMatchObject({available:1,n:1,exact:1,roi:2});
    expect(r.forward[1]).toMatchObject({available:1,n:0,roi:null});
    expect(r.forward[0]).toMatchObject({available:0,n:0,roi:null});
  });
});
