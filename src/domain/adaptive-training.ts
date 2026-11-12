import runtime from '../../models/score-runtime-v1.json' with {type:'json'};
import {featureGroups,fitScore,predictScore,type LogisticModel} from './score-model.js';
import {modelMetrics} from './player-model.js';

const DAY=86400000;
export const adaptiveTrainingProtocol={id:'adaptive-candidates-v17',minimumTraining:200,minimumCalibration:50,minimumTest:50,maximumTraining:1000,temperatures:[.5,.75,1,1.25,1.5],candidates:[{id:'full',lambda:.001},{id:'scores',lambda:.01}],automaticPromotion:false,operationallyValidated:false,retry:'Once per UTC day; failed, insufficient and deferred attempts retained. Retry on next UTC day.',scope:'Prematch winner candidate only; not the operational model.',evaluationScope:'Exploratory retrospective replay: candidate fitted today on earlier frozen observations, not a candidate forecast registered before yesterday’s matches.'} as const;
export const adaptiveTrainingEnabled=(env:Record<string,string|undefined>)=>env.APP_FORWARD_STUDY_ENABLED==='1'&&env.APP_ADAPTIVE_TRAINING_DISABLED!=='1';
export type AdaptiveTrainingRow={id:string;at:number;available:number;x:number[];y:number};
export type AdaptiveWindows={trainingBefore:string;calibrationFrom:string;calibrationBefore:string;testFrom:string;testBefore:string};
export type AdaptiveMetrics=ReturnType<typeof adaptiveMetrics>;
export type AdaptiveCounts={input:number;trainEligible:number;train:number;calibration:number;test:number;lateTraining:number;lateCalibration:number;outsideWindows:number};
export type AdaptiveTrainingSummary={status:'trained'|'insufficient_data'|'deferred_deadline';day:string;checkedAt:string;windows:AdaptiveWindows;counts:AdaptiveCounts;minimums:{train:number;calibration:number;test:number};selected?:string;candidateMetrics?:{id:string;temperature:number;calibration:AdaptiveMetrics}[];test?:AdaptiveMetrics;baseline?:AdaptiveMetrics;differenceBrier?:number;trainingSeconds?:number;automaticPromotion:false;operationallyValidated:false;reason:string};
export type AdaptiveArtifact={model:LogisticModel;temperature:number;selected:string;trainingCutoff:string;calibrationCutoff:string;validated:false};

export function adaptiveWindows(now:number):AdaptiveWindows{
  if(!Number.isFinite(now))throw Error('ADAPTIVE_TIME_INVALID');
  const today=Math.floor(now/DAY)*DAY,cal=today-2*DAY,test=today-DAY;
  return{trainingBefore:new Date(cal).toISOString(),calibrationFrom:new Date(cal).toISOString(),calibrationBefore:new Date(test).toISOString(),testFrom:new Date(test).toISOString(),testBefore:new Date(today).toISOString()};
}

export function splitAdaptiveRows(rows:AdaptiveTrainingRow[],now:number){
  const windows=adaptiveWindows(now),cal=Date.parse(windows.calibrationFrom),test=Date.parse(windows.testFrom),end=Date.parse(windows.testBefore),seen=new Set<string>();
  for(const r of rows){if(!r.id||seen.has(r.id)||!Number.isFinite(r.at)||!Number.isFinite(r.available)||r.at>=r.available||r.available>now||r.x.length!==8||!r.x.every(x=>Number.isFinite(x)&&Math.abs(x)<=1000)||![0,1].includes(r.y))throw Error('ADAPTIVE_ROW_INVALID');seen.add(r.id);}
  const ordered=[...rows].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
  const eligible=ordered.filter(r=>r.at<cal&&r.available<cal);let train=[...eligible];
  // Retain complete UTC capture days. Never truncate a match/day to fill a cap.
  while(train.length>adaptiveTrainingProtocol.maximumTraining){const oldest=Math.floor(train[0].at/DAY);train=train.filter(r=>Math.floor(r.at/DAY)!==oldest);}
  const calibration=ordered.filter(r=>r.at>=cal&&r.at<test&&r.available<test),testing=ordered.filter(r=>r.at>=test&&r.at<end&&r.available<=now);
  const counts:AdaptiveCounts={input:rows.length,trainEligible:eligible.length,train:train.length,calibration:calibration.length,test:testing.length,lateTraining:ordered.filter(r=>r.at<cal&&r.available>=cal).length,lateCalibration:ordered.filter(r=>r.at>=cal&&r.at<test&&r.available>=test).length,outsideWindows:ordered.filter(r=>r.at>=end).length};
  return{windows,train,calibration,test:testing,counts};
}

function adaptiveMetrics(rows:{p:number;y:number}[]){
  let correct=0,wrong=0,undecided=0;
  for(const r of rows){if(!Number.isFinite(r.p)||r.p<0||r.p>1||![0,1].includes(r.y))throw Error('ADAPTIVE_METRICS_INVALID');if(r.p===.5)undecided++;else if(Number(r.p>.5)===r.y)correct++;else wrong++;}
  return{...modelMetrics(rows),correct,wrong,undecided,accuracy:correct+wrong?correct/(correct+wrong):null};
}

export function trainAdaptiveCandidate(rows:AdaptiveTrainingRow[],now:number,clock=Date.now,deadline=Infinity):{summary:AdaptiveTrainingSummary;artifact?:AdaptiveArtifact}{
  const started=clock(),split=splitAdaptiveRows(rows,now),minimums={train:adaptiveTrainingProtocol.minimumTraining,calibration:adaptiveTrainingProtocol.minimumCalibration,test:adaptiveTrainingProtocol.minimumTest};
  const common={day:new Date(now).toISOString().slice(0,10),checkedAt:new Date(now).toISOString(),windows:split.windows,counts:split.counts,minimums,automaticPromotion:false as const,operationallyValidated:false as const};
  const deferred=()=>({summary:{...common,status:'deferred_deadline' as const,reason:'Tempo insufficiente per completare e salvare il candidato; nuovo tentativo nel prossimo giorno UTC.'}});
  if(deadline-clock()<12000)return deferred();
  if(split.train.length<minimums.train||split.calibration.length<minimums.calibration||split.test.length<minimums.test)return{summary:{...common,status:'insufficient_data',reason:'Campioni temporali insufficienti: richiesti almeno 200 training, 50 calibrazione e 50 test su giorni distinti.'}};
  if(split.test.some(r=>r.at<Date.parse(runtime.calibrationCutoff)))throw Error('ADAPTIVE_BASELINE_FUTURE_DATA');
  const candidates: {id:string;model:LogisticModel;temperature:number;calibration:AdaptiveMetrics}[]=[];
  for(const candidate of adaptiveTrainingProtocol.candidates){
    if(deadline-clock()<12000)return deferred();
    const model=fitScore(split.train,featureGroups[candidate.id],candidate.lambda);
    if(!model.weights.every(Number.isFinite))throw Error('ADAPTIVE_MODEL_INVALID');
    const choices=adaptiveTrainingProtocol.temperatures.map(temperature=>({temperature,calibration:adaptiveMetrics(split.calibration.map(r=>({p:predictScore(model,r.x,temperature),y:r.y})))}));
    choices.sort((a,b)=>a.calibration.brier!-b.calibration.brier!||Math.abs(a.temperature-1)-Math.abs(b.temperature-1));
    candidates.push({id:candidate.id,model,...choices[0]});
  }
  if(deadline-clock()<12000)return deferred();
  candidates.sort((a,b)=>a.calibration.brier!-b.calibration.brier!||a.id.localeCompare(b.id));const selected=candidates[0];
  const test=adaptiveMetrics(split.test.map(r=>({p:predictScore(selected.model,r.x,selected.temperature),y:r.y}))),baseline=adaptiveMetrics(split.test.map(r=>({p:predictScore(runtime.model,r.x,runtime.temperature),y:r.y})));
  return{summary:{...common,status:'trained',selected:selected.id,candidateMetrics:candidates.map(({id,temperature,calibration})=>({id,temperature,calibration})),test,baseline,differenceBrier:test.brier!-baseline.brier!,trainingSeconds:Math.max(0,(clock()-started)/1000),reason:'Replay retrospettivo sperimentale: candidato addestrato oggi e valutato sul giorno successivo al fitting storico; non una previsione registrata prima del test. Nessuna promozione automatica.'},artifact:{model:selected.model,temperature:selected.temperature,selected:selected.id,trainingCutoff:split.windows.trainingBefore,calibrationCutoff:split.windows.calibrationBefore,validated:false}};
}
