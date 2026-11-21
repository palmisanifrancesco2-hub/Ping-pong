import {useState} from 'react';
import {SportSelect} from './SportSelect';
import {ValueTracker} from './ValueTracker';
import {individualSports,type IndividualSport} from './shared/individual-sports';
import type {SportTraining} from './shared/sport-training';
import {dateTime} from './shared/format';
import research from '../models/individual-sport-training.json';
import walkForward from '../research/report-sports-walk-forward-v2.json';

const reports=research as SportTraining[];
const atpTest={n:2273,accuracy:'64,45%',logLoss:'0,62281'};

export function BestOdds({token,onMarkets,onSportPrices}:{token:string;onMarkets:()=>void;onSportPrices:(sport:IndividualSport)=>void}) {
  const [sport,setSport]=useState<IndividualSport>('table_tennis');
  const results=reports.filter(item=>item.sport===sport);
  return <>
    <section className="panel"><SportSelect sport={sport} onSelect={setSport}/><WalkForwardEvidence sport={sport}/></section>
    {sport==='table_tennis' ? <ValueTracker token={token} demo={false} onMarkets={onMarkets}/> : <section className="panel">
      <h2>Quote selezionate · {individualSports[sport]}</h2>
      <p>Nessuna quota con affidabilità adeguatamente dimostrata. Per entrare in classifica servono una probabilità verificata fuori campione e un EV prudente positivo su una quota aggiornata di almeno 1,30.</p>
      <button className="secondary" onClick={()=>onSportPrices(sport)}>Vedi le quote Bet365 di {individualSports[sport]}</button>
      {results.map(report=><TrainingEvidence key={report.source} report={report}/>)}
      {sport==='tennis'&&<section className="sport-training">
        <h3>Test storico ATP singolare</h3>
        <p>Logistica con Elo e superficie · {atpTest.accuracy} di esiti corretti su {atpTest.n.toLocaleString('it-IT')} incontri del 2025 · Log Loss {atpTest.logLoss}.</p>
        <p className="fine">Il test riguarda il vincente prematch ATP singolare. Per applicarlo al feed attuale servono identità degli atleti verificate e quote storiche confrontabili.</p>
      </section>}
    </section>}
  </>;
}

function WalkForwardEvidence({sport}:{sport:IndividualSport}) {
  const report=walkForward[sport];
  const interval=report.familyInterval95;
  const verdict=interval[1]<0
    ? 'Il candidato ha probabilità più accurate rispetto al riferimento in questo storico.'
    : interval[0]>0
      ? 'Il riferimento ha probabilità più accurate in questo storico.'
      : 'La differenza resta incerta nei test.';
  const number=(value:number)=>value.toLocaleString('it-IT',{maximumFractionDigits:4});
  return <details className="sport-training">
    <summary>Nuovo test cronologico sul vincente · {report.scope}</summary>
    <p>{verdict}</p>
    <dl>
      <dt>Pronostici corretti del candidato</dt>
      <dd>{number(report.candidate.correct)} su {number(report.candidate.test)}</dd>
      <dt>Log Loss · riferimento / candidato</dt>
      <dd>{number(report.reference.logLoss)} / {number(report.candidate.logLoss)}</dd>
      <dt>Errore di calibrazione · riferimento / candidato</dt>
      <dd>{(report.reference.ece10*100).toLocaleString('it-IT',{maximumFractionDigits:2})}% / {(report.candidate.ece10*100).toLocaleString('it-IT',{maximumFractionDigits:2})}%</dd>
    </dl>
    <p className="fine">La Log Loss è migliore quando è più bassa. Studio esplorativo su archivi già usati in ricerca. La verifica sulle quote Bet365 resta separata.</p>
  </details>;
}

function TrainingEvidence({report}:{report:SportTraining}) {
  const selected=report.candidates.find(candidate=>candidate.name===report.selected);
  const historical=report.source==='historical';
  const period=report.from&&report.to
    ? report.timeline==='season' ? `Stagioni ${report.from.slice(0,4)}–${report.to.slice(0,4)}`
      : `${report.from.slice(0,10)} – ${report.to.slice(0,10)}`
    : 'Nessun esito disponibile';
  return <section className="sport-training">
    <h3>{report.label??'Archivio MoviOdds · studio del vincente'}</h3>
    {report.error ? <p>Archivio dei risultati indisponibile alla verifica del {dateTime(report.checkedAt)}.</p> : <>
      <dl>
        <dt>Esiti singoli utilizzabili</dt><dd>{report.complete.toLocaleString('it-IT')}</dd>
        <dt>Finestra storica</dt><dd>{period}</dd>
        {!historical&&<><dt>Incontri con inizio documentato</dt><dd>{report.withScheduledStart.toLocaleString('it-IT')}</dd></>}
      </dl>
      {selected ? <>
        <p><strong>{selected.name}</strong> · selezionato in validazione temporale · {report.train.toLocaleString('it-IT')} incontri in addestramento.</p>
        <dl>
          <dt>Test successivo</dt><dd>{selected.test.hits.toLocaleString('it-IT')} corretti su {selected.test.n.toLocaleString('it-IT')}</dd>
          <dt>Accuratezza</dt><dd>{selected.test.accuracy.toLocaleString('it-IT',{style:'percent',minimumFractionDigits:1})}</dd>
          <dt>Brier / Log Loss</dt><dd>{selected.test.brier.toLocaleString('it-IT',{maximumFractionDigits:4})} / {selected.test.logLoss.toLocaleString('it-IT',{maximumFractionDigits:4})}</dd>
        </dl>
        <p className="fine">Studio esplorativo. {historical?'Il test si basa sulle date dell’archivio.':'Lo storico è ordinato per disponibilità dei risultati.'} La verifica prematch con quote Bet365 è in attesa.</p>
      </> : <p>Campione insufficiente per addestrare e testare un candidato su periodi distinti.</p>}
    </>}
  </section>;
}
