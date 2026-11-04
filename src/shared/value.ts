import type{ValueOpportunity}from'../domain/value';
export type ValueReport={checkedAt:string;status:'blocked'|'ready';modelValidated:boolean;admVerified:boolean;reasons:string[];opportunities:ValueOpportunity[]};
