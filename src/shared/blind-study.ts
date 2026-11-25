import type { IndividualSport } from './individual-sports.js';
import type { disagreementReport } from '../domain/underdog-study.js';

export type BlindSportSummary = {
  sport:IndividualSport; recorded:number; withPrice:number; pending:number;
  exact:number; incorrect:number; verifiedExact:number; verifiedIncorrect:number; invalid:number;
  brier:number|null; marketBrier:number|null; paired:number;
};
export type BlindStudyReport = {
  checkedAt:string;
  scheduled:boolean;
  enabled:boolean;
  canRun:boolean;
  sports:BlindSportSummary[];
  weekly?:BlindSportSummary&{until:string;value:number;exactValue:number;theoreticalRoi:number|null;closingPairs:number;betterThanClosing:number};
  weeklyDisagreement?:ReturnType<typeof disagreementReport>;
};
