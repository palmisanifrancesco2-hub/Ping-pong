export type BetPrefill={notes:string;odds:number;predictionId?:string};
export type ManualBet={id:string;prediction_id:string|null;stake:number|string;decimal_odds:number|string;currency:'EUR';placed_at:string;status:'pending'|'won'|'lost'|'void';actual_profit:number|string|null;notes:string|null};
export type BetsReport={entries:ManualBet[];total:number;page:number;pageSize:number};
