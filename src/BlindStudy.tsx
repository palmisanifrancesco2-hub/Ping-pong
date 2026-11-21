import {useEffect,useState} from 'react';
import type {BlindStudyReport} from './shared/blind-study';
import {individualSports} from './shared/individual-sports';
import {dateTime} from './shared/format';

export function BlindStudy({token}:{token?:string}) {
  const [report,setReport]=useState<BlindStudyReport>();
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    if(!token)return;
    const controller=new AbortController();
    fetch('/api/blind-study',{headers:{Authorization:`Bearer ${token}`},signal:controller.signal})
      .then(async response=>{
        if(!response.ok)throw Error();
        const value=await response.json() as BlindStudyReport;
        if(!controller.signal.aborted){setReport(value);setError('');}
      }).catch(()=>{if(!controller.signal.aborted)setError('Stato del test a risultato coperto temporaneamente indisponibile.');});
    return()=>controller.abort();
  },[token,revision]);
  async function collect() {
    if(!token||busy)return;
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/blind-study',{method:'POST',headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(185_000)});
      if(!response.ok)throw Error();
      setRevision(value=>value+1);
    }catch{setError('Raccolta non confermata. Aggiorna lo stato per vedere i dati già salvati.');}
    finally{setBusy(false);}
  }
  return <section className="panel" aria-labelledby="blind-study-title">
    <h2 id="blind-study-title">Test a risultato coperto · Vincente</h2>
    <p>Prima dell’inizio salviamo la probabilità e le quote Bet365 quando disponibili. Gli esiti arrivano dopo la partita.</p>
    {error&&<p role="alert" className="error">{error}</p>}
    {!report&&!error&&<p role="status">Caricamento del test…</p>}
    {report&&<>
      <p>{report.scheduled?'Raccolta giornaliera attiva.':'Raccolta giornaliera non configurata.'} Ultimo controllo {dateTime(report.checkedAt)}.</p>
      <ul className="competition-list">{report.sports.map(row=><li key={row.sport}><span>
        <strong>{individualSports[row.sport]}</strong>
        <small>{row.recorded} registrati · {row.withPrice} con quota Bet365 · {row.pending} in attesa</small>
        <small>Esatto {row.exact} · Sbagliato {row.incorrect} · Esclusi {row.invalid}</small>
        <small>Con inizio effettivo verificato · Esatto {row.verifiedExact} · Sbagliato {row.verifiedIncorrect}</small>
        {row.paired>0&&<small>Brier su {row.paired} casi con entrambe le quote · Modello {row.brier?.toFixed(4)} · Bet365 {row.marketBrier?.toFixed(4)}</small>}
      </span></li>)}</ul>
      <p className="fine">Il confronto con Bet365 usa solo incontri con inizio effettivo verificato ed entrambe le quote registrate prima della partita. Le osservazioni senza esito restano in attesa.</p>
      {report.canRun&&report.enabled&&<button className="primary" disabled={busy} onClick={collect}>{busy?'Raccolta in corso…':'Registra nuove previsioni'}</button>}
    </>}
    <button className="text-button" disabled={busy} onClick={()=>setRevision(value=>value+1)}>Aggiorna stato del test</button>
  </section>;
}
