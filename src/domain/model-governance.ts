export type RetrainingPolicy={enabled:boolean;intervalDays:number;minimumNewResults:number;driftMinimumCases:number};
export const defaultRetrainingPolicy:RetrainingPolicy={enabled:false,intervalDays:30,minimumNewResults:500,driftMinimumCases:200};
export function monitorModel(input:{now:number;trainedAt:string;newResults:number;recent?:{n:number;brier:number;referenceBrier:number;logLoss:number;referenceLogLoss:number}},policy:RetrainingPolicy=defaultRetrainingPolicy){
 if(!Number.isFinite(input.now)||!Number.isFinite(Date.parse(input.trainedAt))||!Number.isInteger(input.newResults)||input.newResults<0||![policy.intervalDays,policy.minimumNewResults,policy.driftMinimumCases].every(x=>Number.isInteger(x)&&x>0))throw Error('INVALID_MONITOR_INPUT');
 const ageDays=(input.now-Date.parse(input.trainedAt))/86400000;if(ageDays<0)throw Error('MODEL_FROM_FUTURE');
 const r=input.recent;if(r&&(![r.n,r.brier,r.referenceBrier,r.logLoss,r.referenceLogLoss].every(Number.isFinite)||r.n<0||r.brier<0||r.brier>1||r.referenceBrier<0||r.referenceBrier>1||r.logLoss<0||r.referenceLogLoss<0))throw Error('INVALID_DRIFT_METRICS');
 const drift=r&&r.n>=policy.driftMinimumCases?r.brier>r.referenceBrier&&r.logLoss>r.referenceLogLoss:null;
 const reasons=[...(ageDays>=policy.intervalDays?['Intervallo di revisione raggiunto']:[]),...(input.newResults>=policy.minimumNewResults?['Nuovi risultati sufficienti per una revisione']:[]),...(drift?['Brier e Log Loss recenti peggiori del riferimento']:[])];
 return{ageDays,reviewDue:reasons.length>0,reasons,drift,automaticTrainingEnabled:policy.enabled,automaticPromotion:false,jobStarted:false,policy,limits:'Soglie operative configurabili; un avviso non dimostra deterioramento statistico né autorizza la promozione di un modello.'};
}
