import type{ValueOpportunity}from'../domain/value';
export type ValueReport={checkedAt:string;status:'blocked'|'ready'|'experimental';modelValidated:boolean;admVerified:boolean;reasons:string[];opportunities:ValueOpportunity[];experimental?:ValueOpportunity[]};
