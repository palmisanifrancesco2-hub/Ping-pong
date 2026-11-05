import {useEffect,useRef,useState} from 'react';
import type {MarketStudy} from '../server/market-study';
import {dateTime} from './shared/format';
import {marketLabels} from './shared/market-labels';
type Report=Awaited<ReturnType<MarketStudy['report']>>;

export function MarketForwardStudy({token,demo}:{token?:string;demo:boolean}){
  const [report,setReport]=useState<Report|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
  const action=useRef<AbortController|null>(null);
  useEffect(()=>{setBusy(false);return()=>{action.current?.abort();action.current=null;};},[token,demo]);
  useEffect(()=>{
    setReport(null);setError('');if(!token||demo)return;
    const c=new AbortController();
    fetch('/api/market-study',{headers:{Authorization:`Bearer ${token}`},signal:c.signal})
      .then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<Report>;})
      .then(setReport).catch(()=>{if(!c.signal.aborted)setError('Stato della nuova raccolta non disponibile. I risultati storici restano consultabili.');});
    return()=>c.abort();
  },[token,demo,revision]);
  async function update(){
    if(!token||busy)return;const c=new AbortController();action.current=c;setBusy(true);setError('');setNotice('');
    const timeout=setTimeout(()=>c.abort(),270000);
    try{
      const r=await fetch('/api/market-study',{method:'POST',headers:{Authorization:`Bearer ${token}`},signal:c.signal});if(!r.ok)throw Error();
      const result=await r.json() as {status:string};
      if(action.current===c){setNotice(['recent_run','cooldown'].includes(result.status)?'Un controllo recente o una pausa della fonte limita le richieste. Puoi ricaricare lo stato; il controllo manuale ha intervalli di almeno 15 minuti.':'Controllo completato. Le probabilità già registrate restano fisse.');setRevision(v=>v+1);}
    }catch{if(action.current===c)setError('Controllo non confermato. Ricarica lo stato: i dati già salvati sono conservati.');}
    finally{clearTimeout(timeout);if(action.current===c){action.current=null;setBusy(false);}}
  }
  return<section className="panel" aria-labelledby="market-forward-title">
    <span className="eyebrow">NUOVA CONFERMA SU PARTITE FUTURE</span>
    <h2 id="market-forward-title">Continuiamo oltre le 249 partite</h2>
    <p>Le 249 partite già analizzate restano nel test storico qui sotto. Questa raccolta salva nuove probabilità prima degli incontri, per tutti i 14 risultati di vincente, set, punti e handicap.</p>
    {demo?<p>Accedi per leggere lo stato reale.</p>:!report?<p role="status">{error||'Caricamento della nuova raccolta…'}</p>:<>
      <p>{report.scheduled?'Raccolta cloud giornaliera nella fascia 04:00–05:00 UTC, anche quando l’app è chiusa.':'Programmazione automatica non confermata in questo ambiente.'} Fino a {report.protocol.maximumPerDay} nuove partite al giorno. Il pulsante esegue anche il controllo degli esiti disponibili.</p>
      <dl><dt>Nuove partite con probabilità salvate</dt><dd>{report.captured}</dd><dt>Nuovi esiti verificati</dt><dd>{report.settled}</dd><dt>In attesa / non validi</dt><dd>{report.pending} / {report.invalid}</dd><dt>Giorni con osservazioni</dt><dd>{report.observedDays} / almeno {report.protocol.minimumDays}</dd><dt>Ultimo controllo dello stato</dt><dd>{dateTime(report.checkedAt)}</dd></dl>
      <p>Controlli fissati a {report.protocol.checkpoints.join(', ')} partite, con almeno {report.protocol.minimumDays} giorni e il 95% di esiti verificabili. I modelli restano quelli già scelti: nessuna modifica per inseguire un risultato favorevole. Il controllo di ogni campione si chiude una sola volta, almeno sette giorni dopo l’ultimo inizio previsto.</p>
      <p className="banner">Nessun nuovo mercato diventa operativo automaticamente. Se i criteri non vengono superati, il test resta inconcludente. Queste verifiche misurano la qualità delle probabilità; per dimostrare EV e rendimento servono anche quote osservate utilizzabili.</p>
      {report.checkpoints.length>0?<ul>{report.checkpoints.map(c=><li key={c.size}>{c.size} partite: {!c.consistent?'dati successivamente cambiati, revisione necessaria':`${c.result.targets.filter(t=>t.preliminaryPass).length} risultati con criteri preliminari superati su 14`}. Nessuna attivazione automatica.</li>)}</ul>:<p>Primo controllo formale ancora da raggiungere.</p>}
      <details><summary>Pronostici corretti e sbagliati per mercato</summary><p>Contiamo l’esito indicato come più probabile al momento della registrazione: il vincente favorito, Over oppure Under, o il lato più probabile dell’handicap. Una stima esattamente al 50% resta senza preferenza e non conta come corretta o sbagliata. Le partite in attesa e non valide restano separate.</p><ul className="competition-list">{report.descriptive.map(t=><li key={t.target}><span><strong>{marketLabels[t.target]??t.target}</strong><small>Corrette: {t.correct} · Sbagliate: {t.wrong} · Senza preferenza: {t.undecided}</small><small>Esiti corretti: {t.accuracy===null?'in attesa':`${(t.accuracy*100).toFixed(1)}%`} · {t.n} partite verificate</small><small>Brier {t.model.brier?.toFixed(5)??'in attesa'} · riferimento {t.reference.brier?.toFixed(5)??'in attesa'}</small></span></li>)}</ul><p>Questo riepilogo riguarda tutte le osservazioni del test, anche quando non esiste una quota con EV positivo. Misura l’accuratezza degli esiti più probabili, non il profitto. I criteri di validazione restano Brier, Log Loss e calibrazione. Ogni partita conta una volta per risultato; 14 mercati non equivalgono a 14 partite indipendenti.</p></details>
      {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
      <button className="text-button" disabled={busy} onClick={()=>setRevision(v=>v+1)}>Ricarica stato nuovi test</button>
      {report.canRun&&report.enabled&&<button className="primary" disabled={busy} onClick={update}>{busy?'Controllo in corso…':'Aggiorna nuovi test'}</button>}
    </>}
    <p className="fine">Risultati riportati da MoviOdds e inizio effettivo verificato. Nessuna puntata o previsione retroattiva aggiunta al tuo storico personale. Il precedente test del vincente partita continua con le proprie regole.</p>
  </section>;
}
