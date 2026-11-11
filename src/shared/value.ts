import type{PredictionRankings}from'../domain/prediction-rankings.js';
import type{ValueOpportunity}from'../domain/value.js';
export type ValueReport={policy?:string;rankings?:PredictionRankings;ensemble?:{modelName:string;estimates:ValueOpportunity[];experimental:ValueOpportunity[];opportunities:ValueOpportunity[];modelValidated:boolean};estimates?:ValueOpportunity[];checkedAt:string;status:'blocked'|'ready'|'experimental';modelValidated:boolean;admVerified:boolean;reasons:string[];opportunities:ValueOpportunity[];experimental?:ValueOpportunity[]};
