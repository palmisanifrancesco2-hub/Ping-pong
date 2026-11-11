import{PredictionSystem}from'./PredictionSystem';
import{ModelAlternatives}from'./ModelAlternatives';
import{MarketResearch}from'./MarketResearch';
import{MarketForwardStudy}from'./MarketForwardStudy';
import{ProjectionResearch}from'./ProjectionResearch';
import{useEffect,useState}from'react';
import{dateTime}from'./shared/format';
import{ProspectiveStudy}from'./ProspectiveStudy';
import{RegisteredStats}from'./RegisteredStats';
import type{HistoryPeriod}from'./shared/history';
import{ModelComparison}from'./ModelComparison';
import type{ModelComparisonReport}from'./shared/comparison';
import{ResearchStats}from'./ResearchStats';
import{ScoreResearchStats}from'./ScoreResearchStats';
import type{ScoreResearchReport,ForwardManifest}from'./shared/score-research';
import type{ResearchReport}from'./shared/research';
type Metrics={n:number;brier:number|null;logLoss:number|null;ece:number|null};
type Report={comparison?:ModelComparisonReport;scoreResearch?:ScoreResearchReport;forwardStudy?:ForwardManifest;research?:ResearchReport;version:string;validated:boolean;generatedAt:string|null;trainingCutoff:string|null;validation:Metrics;leagues:Record<string,Metrics&{eligible:boolean}>};
export function ModelStats({token,demo,period='30',onPeriod=()=>{}}:{token?:string;demo:boolean;period?:HistoryPeriod;onPeriod?:(p:HistoryPeriod)=>void}){
 const[report,setReport]=useState<Report|null>(null),[error,setError]=useState('');
 useEffect(()=>{setReport(null);setError('');if(!token||demo)return;const c=new AbortController();fetch('/api/model',{headers:{Authorization:`Bearer ${token}`},signal:c.signal}).then(async r=>{if(!r.ok)throw new Error();return r.json();}).then(setReport).catch(()=>{if(!c.signal.aborted)setError('Statistiche modello non disponibili.');});return()=>c.abort();},[token,demo]);
 return<><PredictionSystem token={token} demo={demo}/><MarketForwardStudy token={token} demo={demo}/><ProjectionResearch/><MarketResearch/><ModelAlternatives/><ProspectiveStudy token={token} demo={demo}/><RegisteredStats token={token} demo={demo} period={period} onPeriod={onPeriod}/><section className="panel"><h2>Validazione temporale del modello</h2>{demo?<p>Anteprima senza dati di validazione.</p>:error?<p role="alert" className="error">{error}</p>:!report?<p>Caricamento…</p>:<>{report.comparison&&<ModelComparison report={report.comparison}/>} {report.scoreResearch&&<details><summary>Ricerca precedente e campione futuro registrato</summary><ScoreResearchStats report={report.scoreResearch} forward={report.forwardStudy}/></details>} {report.research&&<details><summary>Primo confronto dei sei modelli</summary><ResearchStats report={report.research}/></details>}<h3>Modello attualmente usato nelle stime sperimentali</h3><span className="badge">{report.validated?'Controlli preliminari superati sulla fonte':'Stime sperimentali · validazione indipendente mancante'}</span><p>{report.version} · Dati per addestramento/calibrazione fino a {dateTime(report.trainingCutoff??undefined)} · Verifica {dateTime(report.generatedAt??undefined)}</p><dl><dt>Casi nel confronto storico esplorativo</dt><dd>{report.validation.n}</dd><dt>Brier Score</dt><dd>{report.validation.brier?.toFixed(4)??'Non disponibile'}</dd><dt>Log Loss</dt><dd>{report.validation.logLoss?.toFixed(4)??'Non disponibile'}</dd><dt>Errore di calibrazione ECE</dt><dd>{report.validation.ece?.toFixed(4)??'Non disponibile'}</dd></dl><ul className="competition-list">{Object.entries(report.leagues).map(([name,m])=><li key={name}><span>{name} · {m.n} test</span><small>{m.eligible?'Controlli preliminari superati':'Dati insufficienti / controlli non superati'}</small></li>)}</ul><p>Le previsioni di test servono alla validazione e non sono inserite retroattivamente nello storico dell’app. Risultati riportati da MoviOdds, identità per nome esatto nella competizione e campione limitato: nessuna garanzia di esito.</p><p className="fine">Solo vincente partita prematch. Pronostici live e modelli degli altri mercati non attivi. Le statistiche delle previsioni registrate sono nello Storico pronostici.</p></>}</section></>;
}
