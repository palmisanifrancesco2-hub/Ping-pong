import{rankPredictions,type EvidenceCandidate}from'../src/domain/prediction-rankings.js';
import type{ValueReport}from'../src/shared/value.js';
import type{Board}from'../src/shared/board.js';
/** Foreign bet365 prices must never inherit the licence of bet365.it. */
export function strictPredictionPolicy(report:ValueReport,board:Board,now:number):ValueReport{
 const candidates=[...new Map([...(report.estimates??[]),...report.opportunities,...(report.experimental??[])].map(r=>[r.id,r])).values()];
 const rankings=rankPredictions(candidates.map(r=>({...r,bookmakerSite:board.bookmakerSite,admVerified:false,independentValidation:false,competitionVerified:false})) as EvidenceCandidate[],now);
 return{...report,admVerified:false,policy:'strict-adm-independent-v16',rankings,opportunities:rankings.value,status:'blocked',reasons:[...report.reasons,'La fonte corrente è bet365.com.au; le sue quote non sono verificate come quote bet365.it ADM.',...rankings.reasons]};
}
