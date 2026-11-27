import {useEffect,useState} from 'react';
import type {BlindHistory, BlindStudyReport} from './shared/blind-study';
import {individualSports} from './shared/individual-sports';
import {dateTime} from './shared/format';

const probability=new Intl.NumberFormat('it-IT',{style:'percent',maximumFractionDigits:1});
const odds=new Intl.NumberFormat('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});
const weekDate=new Intl.DateTimeFormat('it-IT',{dateStyle:'medium',timeZone:'UTC'});

function StudyHistory({history,scheduled,checkedAt,selectWeek}:{history:BlindHistory;scheduled:boolean;checkedAt:string;selectWeek:(week:string)=>void}){
  return <div>
    <h3>Storico e confronto nel tempo · Tennis tavolo</h3>
    {scheduled&&<p>{checkedAt<history.startsAt?`Dal ${dateTime(history.startsAt)} la raccolta prosegue ogni due ore.`:'Raccolta programmata ogni due ore.'}</p>}
    <p>Periodi di 12 settimane UTC, per data della previsione. Il punteggio Brier confronta le probabilità sulle stesse partite con inizio verificato. Più è basso, meglio è.</p>
    {history.older&&<button className="text-button" onClick={()=>selectWeek(history.older!)}>Settimane precedenti</button>}
    {history.newer&&<button className="text-button" onClick={()=>selectWeek(history.newer!)}>Settimane successive</button>}
    {history.weeks.map((row,index)=><details key={row.from} open={index===0}>
      <summary>Settimana del {weekDate.format(new Date(row.from))} · {row.recorded} registrate</summary>
      <p>Esatto {row.exact} · Sbagliato {row.incorrect} · In attesa {row.pending} · Esclusi {row.invalid}</p>
      <p>Con inizio verificato · Esatto {row.verifiedExact} · Sbagliato {row.verifiedIncorrect}</p>
      {row.paired>0&&<p>Brier su {row.paired} partite · Modello {row.brier?.toFixed(4)} · Bet365 {row.marketBrier?.toFixed(4)}</p>}
      {row.peer&&<p>Brier su {row.peer.count} partite comuni ai tre metodi · Modello {row.peer.modelBrier.toFixed(4)} · Elo {row.peer.eloBrier.toFixed(4)} · Bet365 {row.peer.marketBrier.toFixed(4)}</p>}
      {row.candidate&&<p>Brier su {row.candidate.count} partite del nuovo test · Bet365 con correzione sportiva 25% {row.candidate.brier.toFixed(4)} · Bet365 {row.candidate.marketBrier.toFixed(4)}</p>}
      {row.disagreements.some(band=>band.available>0)&&<ul className="competition-list">
        {row.disagreements.filter(band=>band.available>0).map(band=><li key={band.minimum}><span>
          <strong>Sfavorito Bet365 da {odds.format(band.minimum)}{band.maximum===null?' in su':` a meno di ${odds.format(band.maximum)}`}</strong>
          <small>{band.available} confrontabili · {band.n} selezionate dal modello · Esatto {band.exact} · Sbagliato {band.wrong}</small>
          {band.roi!==null&&<small>Rendimento teorico {probability.format(band.roi)} · Quota media esatti {band.meanExactOdds===null?'—':odds.format(band.meanExactOdds)} · Sbagliati {band.meanWrongOdds===null?'—':odds.format(band.meanWrongOdds)}</small>}
          {band.consensus.available>0&&<small>Confermate da Elo · {band.consensus.n} su {band.consensus.available} valutabili · Esatto {band.consensus.exact} · Sbagliato {band.consensus.wrong}</small>}
        </span></li>)}
      </ul>}
    </details>)}
    <details>
      <summary>Ultimi risultati salvati ({history.recent.length})</summary>
      {history.recent.length===0&&<p>In attesa dei primi esiti.</p>}
      <ul className="competition-list">{history.recent.map(row=><li key={row.id}><span>
        <strong>{row.home} – {row.away}</strong>
        <small>{row.league} · Fine {dateTime(row.finishedAt)} · Vincitore {row[row.winner]}</small>
        {row.sets&&<small>Set in ordine {row.sets.map(([home,away])=>`${home}–${away}`).join(', ')}</small>}
        <small>{row.prediction==='exact'?'Esatto':row.prediction==='wrong'?'Sbagliato':'Parità di stima'} · {row.status==='verified'?'Inizio verificato':'Esito ricevuto, inizio da verificare'}</small>
        <small>Previsione del {dateTime(new Date(row.seenAt).toISOString())} · {row.model} · {probability.format(row.homeProbability)} / {probability.format(1-row.homeProbability)}</small>
        {row.peerHomeProbability!==undefined&&<small>Elo · {probability.format(row.peerHomeProbability)} / {probability.format(1-row.peerHomeProbability)}</small>}
        {row.marketBlend25HomeProbability!==undefined&&<small>Test con correzione sportiva 25% · {probability.format(row.marketBlend25HomeProbability)} / {probability.format(1-row.marketBlend25HomeProbability)}</small>}
        <small>Bet365 · {row.homeOdds===null?'Quota assente':odds.format(row.homeOdds)} / {row.awayOdds===null?'Quota assente':odds.format(row.awayOdds)}</small>
      </span></li>)}</ul>
    </details>
  </div>;
}

export function BlindStudy({token}:{token?:string}) {
  const [report,setReport]=useState<BlindStudyReport>();
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [revision,setRevision]=useState(0);
  const [historyWeek,setHistoryWeek]=useState('');
  useEffect(()=>{
    if(!token)return;
    const controller=new AbortController();
    fetch(historyWeek?`/api/blind-study?historyWeek=${encodeURIComponent(historyWeek)}`:'/api/blind-study',
      {headers:{Authorization:`Bearer ${token}`},signal:controller.signal})
      .then(async response=>{
        if(!response.ok)throw Error();
        const value=await response.json() as BlindStudyReport;
        if(!controller.signal.aborted){setReport(value);setError('');}
      }).catch(()=>{if(!controller.signal.aborted)setError('Stato del test a risultato coperto temporaneamente indisponibile.');});
    return()=>controller.abort();
  },[token,revision,historyWeek]);
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
      {report.history&&<StudyHistory history={report.history} scheduled={report.scheduled} checkedAt={report.checkedAt} selectWeek={setHistoryWeek}/>}
      <h3>Riepilogo per sport nel periodo mostrato</h3>
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
