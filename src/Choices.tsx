import { useEffect, useState } from 'react';
import { PeriodSelect } from './History';
import { QuoteComparison } from './QuoteComparison';
import { dateTime } from './shared/format';
import { OUTCOME_LABELS, type HistoryPeriod } from './shared/history';
import type{BetPrefill}from'./shared/bets';
import type { ChoicesReport, PersonalChoice } from './shared/choices';

function SavedPrices({entry}:{entry:PersonalChoice}) {
  const forecast=entry.comparison?.forecast;
  const price=forecast?.prices ? forecast.prices.bet365 : entry.snapshot.selection;
  return <div className="saved-choice-prices">
    <QuoteComparison odds={price?.odds} probability={forecast?.probability} fairOdds={forecast?.prices?.fairOdds}/>
    <p className="fine">{price ? `Quota Bet365 rilevata il ${dateTime(price.quoteAt)}` : 'Quota Bet365 non registrata'}</p>
  </div>;
}

export function SaveChoice({ token,eventId,quoteKey,expectedOdds,expectedUpdatedAt,modelChoice,expectedForecast }: {token?:string;eventId:string;quoteKey?:string;expectedOdds?:number;expectedUpdatedAt?:string;modelChoice?:'study'|'ensemble';expectedForecast?:{selection:string;probability:number;model?:string}}) {
  const [state,setState]=useState<'idle'|'saving'|'saved'>('idle'); const [error,setError]=useState('');
  const [savedChoice,setSavedChoice]=useState<PersonalChoice>();
  async function save() {
    if(!token)return;setState('saving');setError('');
    try { const response=await fetch('/api/choices',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({eventId,quoteKey,expectedOdds,expectedUpdatedAt,modelChoice,expectedForecast}),signal:AbortSignal.timeout(30_000)});
      if(!response.ok)throw new Error(response.status===409?'Partita, quota o pronostico cambiati. Aggiorna i dati e riprova.':'Salvataggio non disponibile. La scelta non è stata confermata.');
      const saved=await response.json() as PersonalChoice;if(typeof saved.id!=='string'||!saved.snapshot)throw new Error('Salvataggio non confermato. Riprova.');
      setSavedChoice(saved);
      setState('saved');
    } catch(e){setState('idle');setError(e instanceof Error?e.message:'Salvataggio non riuscito.');}
  }
  return <div><button className="text-button" disabled={!token || state!=='idle'} onClick={save}>{state==='saved'?'✓ Salvata nelle mie scelte':state==='saving'?'Salvataggio…':quoteKey?'☆ Scelgo questa selezione':'☆ Segna questa partita'}</button>{savedChoice && <div role="status"><SavedPrices entry={savedChoice}/></div>}{error&&<p role="alert" className="error">{error}</p>}</div>;
}
export function PersonalChoices({token,demo,period,onPeriod,onBet}:{token?:string;demo:boolean;period:HistoryPeriod;onPeriod:(p:HistoryPeriod)=>void;onBet?:(p:BetPrefill)=>void}) {
  const [report,setReport]=useState<ChoicesReport|null>(null);const [page,setPage]=useState(1);const [status,setStatus]=useState('all');const [revision,setRevision]=useState(0);const [error,setError]=useState('');const [loading,setLoading]=useState(false);
  useEffect(()=>{setReport(null);setError('');if(!token||demo)return;let active=true;const controller=new AbortController();setLoading(true);
    const params=new URLSearchParams({period,page:String(page),status});
    fetch(`/api/choices?${params}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20_000)])})
      .then(async response=>{if(!response.ok)throw new Error('Scelte personali non disponibili. Riprova.');return response.json() as Promise<ChoicesReport>;})
      .then(value=>{if(active)setReport(value);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Errore di lettura.');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;controller.abort();};
  },[token,demo,period,page,status,revision]);
  return <section className="panel"><div className="panel-heading"><div><span className="eyebrow">STORICO PERSONALE</span><h2>Le mie scelte e il loro storico</h2></div><PeriodSelect value={period} onChange={onPeriod}/></div>
    <p>Per ogni pronostico trovi le quote del momento in cui l’hai salvato. Quando arriva il risultato, qui vedi chi ha vinto e se il pronostico era giusto.</p>
    <div className="history-controls"><label>Esito inserito a mano<select aria-label="Esito inserito a mano" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);setReport(null);}}>{['all','pending','won','lost','void'].map(v=><option value={v} key={v}>{v==='all'?'Tutti':OUTCOME_LABELS[v as keyof typeof OUTCOME_LABELS]}</option>)}</select></label><button className="primary" disabled={loading||demo||!token} onClick={()=>setRevision(v=>v+1)}>Aggiorna le mie scelte</button></div>
    {demo?<p>Anteprima senza scelte: nessun accesso al database.</p>:loading?<p role="status">Caricamento delle tue scelte…</p>:error?<p role="alert" className="error">{error}</p>:report&&<><p className="fine">{report.total} scelte nel periodo · Da {report.from?dateTime(report.from):'inizio storico'} a {dateTime(report.to)}.</p>
      {!report.entries.length?<div className="empty"><h3>Nessuna scelta nel periodo</h3><p>In Partite e mercati premi “Segna questa partita” oppure “Scelgo questa selezione”.</p></div>:<div className="prediction-list">{report.entries.map(entry=><ChoiceCard key={entry.id} entry={entry} token={token!} onSaved={()=>setRevision(v=>v+1)} onBet={onBet}/>)}</div>}
      {report.total>50&&<div className="history-pages"><button className="primary" disabled={page===1} onClick={()=>setPage(v=>v-1)}>← Precedenti</button><span>Pagina {page} di {Math.ceil(report.total/50)}</span><button className="primary" disabled={page*50>=report.total} onClick={()=>setPage(v=>v+1)}>Successive →</button></div>}
    </>}
  </section>;
}
function ChoiceCard({entry,token,onSaved,onBet}:{onBet?:(p:BetPrefill)=>void;entry:PersonalChoice;token:string;onSaved:()=>void}) {
  const [status,setStatus]=useState(entry.manual_status);const [notes,setNotes]=useState(entry.notes);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const s=entry.snapshot,q=s.selection;
  const {forecast,result}=entry.comparison??{};
  const verdict = forecast
    ? result ? result.winner===forecast.selection ? {label:'Esatto',css:'won'} : {label:'Sbagliato',css:'lost'}
      : {label:'In attesa del risultato',css:'pending'}
    : {label:'Pronostico non registrato',css:'pending'};
  async function update(){setBusy(true);setError('');try{const response=await fetch('/api/choices',{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({id:entry.id,status,notes}),signal:AbortSignal.timeout(20_000)});if(!response.ok)throw new Error('Aggiornamento non riuscito.');const saved=await response.json() as {id?:unknown};if(saved.id!==entry.id)throw new Error('Aggiornamento non confermato.');onSaved();}catch{setError('Esito non salvato. Riprova.');}finally{setBusy(false);}}
  return <article className="prediction-card personal-choice"><div className="panel-heading"><div><small>{s.competition} · Salvata {dateTime(entry.saved_at)}</small><h3>{s.home} — {s.away}</h3></div><span className={`outcome-badge ${verdict.css}`}>{verdict.label}</span></div>
    <p>{q?`${q.market} · ${q.label}${q.line===null?'':` · Linea ${q.line}`}${q.handicap===null?'':` · Handicap ${q.handicap}`}`:'Vincente partita'}</p>
    <SavedPrices entry={entry}/>
    {forecast && <dl><dt>Pronostico dell’app</dt><dd>{forecast.selection} · {(forecast.probability*100).toLocaleString('it-IT',{minimumFractionDigits:1,maximumFractionDigits:1})}%</dd>
      <dt>Modello e momento</dt><dd>{forecast.model} · {forecast.phase==='live'?'Live':'Prematch'} · {dateTime(s.observedAt)}</dd>
      {result && <><dt>Risultato finale (MoviOdds)</dt><dd><strong>{result.sets.filter(([a,b])=>a>b).length}–{result.sets.filter(([a,b])=>a<b).length}</strong> · Vince {result.winner}<br/><small>Set: {result.sets.map(([a,b])=>`${a}–${b}`).join(', ')} · {dateTime(result.finishedAt)}</small></dd></>}
    </dl>}
    <dl><dt>Inizio registrato</dt><dd>{dateTime(s.startsAt??undefined)}</dd><dt>Esito personale registrato</dt><dd>{dateTime(entry.manual_settled_at??undefined)} · Manuale, non certificato</dd></dl>
    {q&&onBet&&<button className="primary" onClick={()=>onBet({odds:q.odds,notes:`${s.home} — ${s.away} · ${q.market} · ${q.label}`})}>Inserisci puntata reale nel diario</button>}
    <div className="filters"><label>Il mio esito<select aria-label="Il mio esito" value={status} disabled={!q} onChange={e=>setStatus(e.target.value as typeof status)}>{['pending','won','lost','void'].map(v=><option key={v} value={v}>{OUTCOME_LABELS[v as keyof typeof OUTCOME_LABELS]}</option>)}</select></label><label>Le mie note<input aria-label="Le mie note" maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}/></label></div><button className="text-button" disabled={busy} onClick={update}>{busy?'Salvataggio…':'Salva note ed esito personale'}</button>{error&&<p role="alert" className="error">{error}</p>}
  </article>;
}
