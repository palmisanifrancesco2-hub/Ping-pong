import{rankPredictions,type EvidenceCandidate}from'../src/domain/prediction-rankings.js';
import type{ValueReport}from'../src/shared/value.js';
import type{Board}from'../src/shared/board.js';
/** Bet365 source accepted independently of ADM; independent model validation remains mandatory. */
export function strictPredictionPolicy(report:ValueReport,board:Board,now:number):ValueReport{
 const candidates=[...new Map([...(report.estimates??[]),...report.opportunities,...(report.experimental??[])].map(r=>[r.id,r])).values()];
 const rankings=rankPredictions(candidates.map(r=>({...r,bookmakerSite:board.bookmakerSite,admVerified:false,independentValidation:false,competitionVerified:false})) as EvidenceCandidate[],now);
 return{...report,admVerified:false,policy:'bet365-independent-v17',rankings,opportunities:rankings.value,status:'blocked',reasons:[...report.reasons,'Quote bet365.com.au accettate; ADM non richiesto. I prezzi mantengono il dominio di provenienza e la validazione del modello resta necessaria.',...rankings.reasons]};
}
