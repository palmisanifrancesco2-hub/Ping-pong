import model from'../models/elo-v1.json' with{type:'json'};
import type{ValueReport}from'../src/shared/value.js';
/** No synthetic candidates or substitution of bookmaker-implied prices for model estimates. */
export function currentValueReport(now=Date.now()):ValueReport{
  const reasons:string[]=[];
  if(!model.validated)reasons.push('Il modello non ha superato la validazione temporale: le probabilità operative non sono disponibili.');
  reasons.push('Il feed attuale è bet365.com.au: quote italiane e concessione ADM non verificate.');
  return{checkedAt:new Date(now).toISOString(),status:'blocked',modelValidated:model.validated,admVerified:false,reasons,opportunities:[]};
}
