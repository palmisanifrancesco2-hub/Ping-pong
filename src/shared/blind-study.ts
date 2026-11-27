import type { IndividualSport } from './individual-sports.js';
import type { disagreementReport } from '../domain/underdog-study.js';

export type BlindSportSummary = {
  sport:IndividualSport; recorded:number; withPrice:number; pending:number;
  exact:number; incorrect:number; verifiedExact:number; verifiedIncorrect:number; invalid:number;
  brier:number|null; marketBrier:number|null; paired:number;
};
export type AgreementBenchmark={count:number;disagreements:number;brier:number;marketBrier:number;sportsBrier:number};
export type BlindHistoryWeek = BlindSportSummary & {
  from:string;
  until:string;
  peer:{count:number;modelBrier:number;eloBrier:number;marketBrier:number}|null;
  candidate:{count:number;brier:number;marketBrier:number}|null;
  external:{count:number;brier:number;eloBrier:number;marketBrier:number}|null;
  agreement?:AgreementBenchmark|null;
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
  weekly?:BlindSportSummary&{until:string;value:number;exactValue:number;theoreticalRoi:number|null;closingPairs:number;betterThanClosing:number;agreement?:AgreementBenchmark|null};
  weeklyDisagreement?:ReturnType<typeof disagreementReport>;
  history:BlindHistory;
  pricing?:PricingReport|null;
};

export type PricingReport = {
  coverage:{market:string;fixtures:number;snapshots:number;withModel:number}[];
  admOpportunities:unknown[];
  recent:{event:string;eventId:string;market:string;marketKey:string;side:string;line:string;source:string;site:string;observedAt:string;quotedAt:string;
    odds:number;marketProbability:number;power:number;model:number;fair:number;ev:number;stressed:number;trial:boolean}[];
  summary:{market:string;records:number;settled:number;exact:number;simulatedRoi:number|null;roiLower:number|null;roiUpper:number|null;drawdown:number|null;closing:number;clv:number|null;delay:number;delayedRoi:number|null;brier:number|null;logLoss:number|null;ece:number|null}[];
};

export type BlindHighEv = {
  eligible:number;registered:number;favorites:number;favoritesExact:number;favoritesWrong:number;exact:number;wrong:number;pending:number;unverified:number;invalid:number;roi:number|null;
};
export type BlindAudit = BlindSportSummary & {
  from:string|null;until:string|null;highEv:BlindHighEv;
  models:{model:string;n:number;highEv:BlindHighEv}[];
};
