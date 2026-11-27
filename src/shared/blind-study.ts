import type { IndividualSport } from './individual-sports.js';
import type { disagreementReport } from '../domain/underdog-study.js';

export type BlindSportSummary = {
  sport:IndividualSport; recorded:number; withPrice:number; pending:number;
  exact:number; incorrect:number; verifiedExact:number; verifiedIncorrect:number; invalid:number;
  brier:number|null; marketBrier:number|null; paired:number;
};
export type BlindHistoryWeek = BlindSportSummary & {
  from:string;
  until:string;
  peer:{count:number;modelBrier:number;eloBrier:number;marketBrier:number}|null;
  candidate:{count:number;brier:number;marketBrier:number}|null;
  disagreements:ReturnType<typeof disagreementReport>['forward'];
};
export type BlindHistory = {
  startsAt:string;
  older:string|null;
  newer:string|null;
  weeks:BlindHistoryWeek[];
  recent:{
    id:string;home:string;away:string;league:string;model:string;seenAt:number;
    homeProbability:number;peerHomeProbability?:number;marketBlend25HomeProbability?:number;homeOdds:number|null;awayOdds:number|null;
    winner:'home'|'away';finishedAt:string;sets?:[number,number][];
    status:'verified'|'reported';prediction:'exact'|'wrong'|null;
  }[];
};
export type BlindStudyReport = {
  checkedAt:string;
  scheduled:boolean;
  enabled:boolean;
  canRun:boolean;
  sports:BlindSportSummary[];
  weekly?:BlindSportSummary&{until:string;value:number;exactValue:number;theoreticalRoi:number|null;closingPairs:number;betterThanClosing:number};
  weeklyDisagreement?:ReturnType<typeof disagreementReport>;
  history:BlindHistory;
};
