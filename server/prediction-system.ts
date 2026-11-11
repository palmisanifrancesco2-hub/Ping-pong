import oddsSlices from'../research/report-v16-odds-slices.json'with{type:'json'};
import oddsComparison from'../research/report-v16-odds.json'with{type:'json'};
import inventory from'../research/data-inventory-v16.json'with{type:'json'};
import benchmark from'../research/report-v16-benchmark.json'with{type:'json'};
import wtt from'../research/report-v15.json'with{type:'json'};
import runtime from'../models/score-runtime-v1.json'with{type:'json'};
import{monitorModel,defaultRetrainingPolicy}from'../src/domain/model-governance.js';
export function predictionSystemReport(now:number){
 return{version:'prediction-system-v16',checkedAt:new Date(now).toISOString(),operationallyValidated:false,
 datasets:[...inventory.moviodds.map(d=>({name:d.source,rows:d.rows,players:d.playersWithinCompetitionByNormalizedName,competitions:Object.keys(d.competitions).length,from:d.finishedRange.from,to:d.finishedRange.to,complete:d.counts.completeCoherentScore})),...inventory.wtt.map(d=>({name:`WTT ${d.cohort}`,rows:d.rows,players:d.uniqueNamesWithinCohort,competitions:Object.keys(d.competitions).length,from:d.dateRange.from,to:d.dateRange.to,complete:d.counts.coherentCompleteScoreWithoutTrustingBestOf})),{name:'Setka SCORE',rows:inventory.setka.rows,players:inventory.setka.playersByNormalizedName,competitions:1,from:inventory.setka.dateRange.from,to:inventory.setka.dateRange.to,complete:inventory.setka.counts.coherentScoreAndWinner}],
 oddsComparison:{bins:oddsSlices.oddsBins,n:oddsComparison.test,training:oddsComparison.training,calibration:oddsComparison.calibration,days:oddsComparison.observedTestDays,models:oddsComparison.models,marketOnly:oddsComparison.marketOnly,roi:null},
 historicalQuotes:inventory.historicalClosingCache,blockingRequirements:inventory.blockingRequirements,
 benchmark:{generatedAt:benchmark.generatedAt,n:benchmark.n,days:benchmark.observedDays,markets:benchmark.markets,seconds:benchmark.totalSeconds,independentValidation:false,operationallyValidated:false,optionalLibraries:benchmark.protocol.optionalLibraries},
 wtt:{n:wtt.totalTestCases,metrics:wtt.aggregate,scope:'WTT separato dai campionati attuali; date della fonte con ritardo convenzionale, non validazione operativa.'},
 lifecycle:{activeVersion:runtime.version,activeName:runtime.name,validationScope:'Esplorativo; nessuna promozione indipendente',rollback:'Artefatti precedenti conservati in Git; ripristino di un commit verificato.',monitor:monitorModel({now,trainedAt:runtime.generatedAt,newResults:0},defaultRetrainingPolicy),newResultCountAvailable:false,recentDriftMetricsAvailable:false,trainingExecution:'Python offline; raccolta e valutazione prospettica usano il cron esistente. Nessun job di training avviato da questa richiesta.'},
 markets:{structuralEngineImplemented:true,bestOfSupported:[1,3,5,7,9],pointProbabilitySourceVerified:false,prematchFormatVerified:false,operationalMarkets:[],reason:'Il motore coerente richiede probabilità del punto e regole verificate prima dell’evento. Coerenza matematica non equivale a validazione predittiva.'},
 rankingPolicy:{minimumOdds:1.3,maximumOdds:null,admOnly:true,independentValidationRequired:true,observedBookmakerSite:'bet365.com.au',italianPricesVerified:false},
 };
}
