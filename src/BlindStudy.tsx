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
      {report.weekly&&<div>
        <h3>Studio settimanale di tennis tavolo</h3>
        <p>Partite in programma fino al {dateTime(report.weekly.until)}.</p>
        <p>{report.weekly.recorded} registrate · {report.weekly.withPrice} con quote Bet365 · {report.weekly.pending} in attesa</p>
        <p>Esatto {report.weekly.exact} · Sbagliato {report.weekly.incorrect}. Con inizio verificato, {report.weekly.verifiedExact} esatti e {report.weekly.verifiedIncorrect} sbagliati.</p>
        {report.weekly.value>0&&<p>Favoriti del modello con EV positivo e inizio verificato · {report.weekly.exactValue} esatti su {report.weekly.value} · Rendimento teorico {report.weekly.theoreticalRoi?.toLocaleString('it-IT',{style:'percent',maximumFractionDigits:1})}.</p>}
        {report.weekly.closingPairs>0&&<p>{report.weekly.betterThanClosing} su {report.weekly.closingPairs} con quota iniziale sopra la quota equa successiva.</p>}
        {report.weeklyDisagreement&&<div>
          <h4>Quando modello e Bet365 indicano favoriti diversi</h4>
          <p>Solo esiti con inizio verificato, entrambe le quote e valore atteso positivo. La quota più alta identifica lo sfavorito Bet365.</p>
          {[{title:`Nuove previsioni dal ${dateTime(report.weeklyDisagreement.startsAt)}`,rows:report.weeklyDisagreement.forward},
            {title:'Previsioni raccolte prima di questo test',rows:report.weeklyDisagreement.earlier}].map(({title,rows})=><details key={title}>
            <summary>{title}</summary>
            <ul className="competition-list">{rows.map(row=><li key={row.minimum}><span>
              <strong>Da {row.minimum.toFixed(2).replace('.',',')}{row.maximum===null?' in su':` a meno di ${row.maximum.toFixed(2).replace('.',',')}`}</strong>
              <small>{row.available} quote confrontabili · {row.n} selezionate · {row.exact} esatte · {row.wrong} sbagliate</small>
              {row.roi!==null&&<small>Rendimento teorico {row.roi.toLocaleString('it-IT',{style:'percent',maximumFractionDigits:1})} · {row.days} {row.days===1?'giorno':'giorni'}</small>}
              {row.consensus.available>0&&<small>Confermate anche da Elo · {row.consensus.n} su {row.consensus.available} valutabili · {row.consensus.exact} esatte · {row.consensus.wrong} sbagliate{row.consensus.roi!==null?` · Rendimento teorico ${row.consensus.roi.toLocaleString('it-IT',{style:'percent',maximumFractionDigits:1})}`:''}</small>}
            </span></li>)}</ul>
          </details>)}
        </div>}
      </div>}
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
