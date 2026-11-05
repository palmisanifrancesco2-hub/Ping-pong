import type{FeedQuote}from'./board.js';
import type{playerStats}from'../domain/player-model.js';
export type Forecast={featureEvidence?:Record<string,unknown>;components?:{name:string;probability:number}[];featuresAvailableAt?:string;modelValidated?:boolean;modelName?:string;modelParameters?:Record<string,unknown>;selection:string;homeProbability:number;probability:number;probabilityLower:number;sampleSize:number;quote:FeedQuote;modelVersion:string;trainingCutoff:string;validation:{n:number;brier:number;logLoss:number;ece:number};reliability:string};
export type PlayerAnalysis={ensemble?:Forecast[];eventId:string;checkedAt:string;home:ReturnType<typeof playerStats>;away:ReturnType<typeof playerStats>;h2h:{matches:number;homeWins:number;awayWins:number};coverage:{from:string|null;to:string|null;source:string;rejected:number;archive:string};identity:string;
 model:{version:string;validated:boolean;trainingCutoff:string|null;validation:{n:number;brier:number|null;logLoss:number|null;ece:number|null}};forecast:Forecast|null;experimental?:Forecast[];reason:string;
 recorded?:{id:string;at:string;probability:number;odds:number}|null};
