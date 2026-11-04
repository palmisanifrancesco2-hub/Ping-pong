import { useEffect, useState } from 'react';
import { PeriodSelect } from './History';
import { dateTime } from './shared/format';
import { OUTCOME_LABELS, type HistoryPeriod } from './shared/history';
import type { ChoicesReport, PersonalChoice } from './shared/choices';

export function SaveChoice({ token,eventId,quoteKey,expectedOdds,expectedUpdatedAt }: {token?:string;eventId:string;quoteKey?:string;expectedOdds?:number;expectedUpdatedAt?:string}) {
  const [state,setState]=useState<'idle'|'saving'|'saved'>('idle'); const [error,setError]=useState('');
  async function save() {
    if(!token)return;setState('saving');setError('');
    try { const response=await fetch('/api/choices',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({eventId,quoteKey,expectedOdds,expectedUpdatedAt}),signal:AbortSignal.timeout(30_000)});
      if(!response.ok)throw new Error(response.status===409?'Partita o quota cambiata: aggiorna e riprova.':'Salvataggio non disponibile. La scelta non è stata confermata.');
      const saved=await response.json() as {id?:unknown};if(typeof saved.id!=='string')throw new Error('Salvataggio non confermato. Riprova.');
      setState('saved');
    } catch(e){setState('idle');setError(e instanceof Error?e.message:'Salvataggio non riuscito.');}
  }
  return <div><button className="text-button" disabled={!token || state!=='idle'} onClick={save}>{state==='saved'?'✓ Salvata nelle mie scelte':state==='saving'?'Salvataggio…':quoteKey?'☆ Scelgo questa selezione':'☆ Segna questa partita'}</button>{error&&<p role="alert" className="error">{error}</p>}</div>;
}
export function PersonalChoices({token,demo,period,onPeriod}:{token?:string;demo:boolean;period:HistoryPeriod;onPeriod:(p:HistoryPeriod)=>void}) {
  const [report,setReport]=useState<ChoicesReport|null>(null);const [page,setPage]=useState(1);const [status,setStatus]=useState('all');const [revision,setRevision]=useState(0);const [error,setError]=useState('');const [loading,setLoading]=useState(false);
  useEffect(()=>{setReport(null);setError('');if(!token||demo)return;let active=true;const controller=new AbortController();setLoading(true);
    const params=new URLSearchParams({period,page:String(page),status});
    fetch(`/api/choices?${params}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20_000)])})
      .then(async response=>{if(!response.ok)throw new Error('Scelte personali non disponibili. Riprova.');return response.json() as Promise<ChoicesReport>;})
      .then(value=>{if(active)setReport(value);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Errore di lettura.');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;controller.abort();};
  },[token,demo,period,page,status,revision]);
  return <section className="panel"><div className="panel-heading"><div><span className="eyebrow">SCELTE PERSONALI · SEPARATE DAL MODELLO</span><h2>Le mie scelte e il loro storico</h2></div><PeriodSelect value={period} onChange={onPeriod}/></div>
    <p>Segna una partita per seguirla, oppure scegli una selezione con la sua quota. Il primo prezzo salvato rimane nello storico anche quando la partita finisce. Non registra automaticamente una puntata reale.</p>
    <div className="history-controls"><label>Esito personale<select aria-label="Esito personale" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);setReport(null);}}>{['all','pending','won','lost','void'].map(v=><option value={v} key={v}>{v==='all'?'Tutti':OUTCOME_LABELS[v as keyof typeof OUTCOME_LABELS]}</option>)}</select></label><button className="primary" disabled={loading||demo||!token} onClick={()=>setRevision(v=>v+1)}>Aggiorna le mie scelte</button></div>
    {demo?<p>Anteprima senza scelte: nessun accesso al database.</p>:loading?<p role="status">Caricamento delle tue scelte…</p>:error?<p role="alert" className="error">{error}</p>:report&&<><p className="fine">{report.total} scelte nel periodo · Da {report.from?dateTime(report.from):'inizio storico'} a {dateTime(report.to)}. Esiti e note sono inseriti da te, non verificati dal modello.</p>
      {!report.entries.length?<div className="empty"><h3>Nessuna scelta nel periodo</h3><p>In Partite e mercati premi “Segna questa partita” oppure “Scelgo questa selezione”.</p></div>:<div className="prediction-list">{report.entries.map(entry=><ChoiceCard key={entry.id} entry={entry} token={token!} onSaved={()=>setRevision(v=>v+1)}/>)}</div>}
      {report.total>50&&<div className="history-pages"><button className="primary" disabled={page===1} onClick={()=>setPage(v=>v-1)}>← Precedenti</button><span>Pagina {page} di {Math.ceil(report.total/50)}</span><button className="primary" disabled={page*50>=report.total} onClick={()=>setPage(v=>v+1)}>Successive →</button></div>}
    </>}
  </section>;
}
function ChoiceCard({entry,token,onSaved}:{entry:PersonalChoice;token:string;onSaved:()=>void}) {
  const [status,setStatus]=useState(entry.manual_status);const [notes,setNotes]=useState(entry.notes);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const s=entry.snapshot,q=s.selection;
  async function update(){setBusy(true);setError('');try{const response=await fetch('/api/choices',{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({id:entry.id,status,notes}),signal:AbortSignal.timeout(20_000)});if(!response.ok)throw new Error('Aggiornamento non riuscito.');const saved=await response.json() as {id?:unknown};if(saved.id!==entry.id)throw new Error('Aggiornamento non confermato.');onSaved();}catch{setError('Esito non salvato. Riprova.');}finally{setBusy(false);}}
  return <article className="prediction-card"><div className="panel-heading"><div><small>{s.competition} · Salvata {dateTime(entry.saved_at)}</small><h3>{s.home} — {s.away}</h3></div><span className={`outcome-badge ${entry.manual_status}`}>{q?OUTCOME_LABELS[entry.manual_status]:'Partita osservata'}</span></div>
    <p>{q?`${q.market} · ${q.label}${q.line===null?'':` · Linea ${q.line}`}${q.handicap===null?'':` · Handicap ${q.handicap}`}`:'Nessuna selezione: solo osservazione.'}</p>
    <dl><dt>Inizio registrato</dt><dd>{dateTime(s.startsAt??undefined)}</dd><dt>Quota scelta / fonte</dt><dd>{q?`${q.odds.toLocaleString('it-IT')} · bet365.com.au`:'Non registrata'}</dd><dt>Quota rilevata / salvata</dt><dd>{q?dateTime(q.quoteAt):'—'} / {dateTime(entry.saved_at)}</dd><dt>Esito personale registrato</dt><dd>{dateTime(entry.manual_settled_at??undefined)} · Manuale, non certificato</dd></dl>
    <div className="filters"><label>Il mio esito<select aria-label="Il mio esito" value={status} disabled={!q} onChange={e=>setStatus(e.target.value as typeof status)}>{['pending','won','lost','void'].map(v=><option key={v} value={v}>{OUTCOME_LABELS[v as keyof typeof OUTCOME_LABELS]}</option>)}</select></label><label>Le mie note<input aria-label="Le mie note" maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}/></label></div><button className="text-button" disabled={busy} onClick={update}>{busy?'Salvataggio…':'Salva note ed esito personale'}</button>{error&&<p role="alert" className="error">{error}</p>}
  </article>;
}
