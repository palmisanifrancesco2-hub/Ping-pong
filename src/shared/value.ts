import type{PredictionRankings}from'../domain/prediction-rankings.js';
import type{ValueOpportunity}from'../domain/value.js';
export type WinnerEstimate={homeProbability:number;modelName:string} & (
  {sampleSize:number;liveScore?:never} | {liveScore:string;completedSetScore:string}
);
type ModelSelections={estimates?:ValueOpportunity[];experimental?:ValueOpportunity[];opportunities:ValueOpportunity[];modelValidated:boolean;winnerEstimates?:Record<string,WinnerEstimate>};
export type ValueReport=ModelSelections&{policy?:string;rankings?:PredictionRankings;ensemble?:(ModelSelections&{modelName:string});checkedAt:string;status:'blocked'|'ready'|'experimental';admVerified:boolean;reasons:string[]};
