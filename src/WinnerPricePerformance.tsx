import {useState} from 'react';
import type {WinnerPricePerformance as PriceReport, PricePolicy} from './domain/winner-price-performance';
import {dateTime} from './shared/format';

const decimal = (n: number | null) => n === null ? 'Non disponibile' : n.toLocaleString('it-IT', {minimumFractionDigits:2, maximumFractionDigits:2});
const signed = (n: number | null) => n === null ? 'Non disponibile' : `${n >= 0 ? '+' : ''}${decimal(n)}`;
const labels: Record<PricePolicy, string> = {all:'Tutte le scelte', minimum:'Quota ≥ 1,30', value:'Quota ≥ 1,30 ed EV positivo'};

export function WinnerPricePerformance({report}: {report: PriceReport}) {
  const [period, setPeriod] = useState('30'), [policy, setPolicy] = useState<PricePolicy>('value');
  const window = report.windows.find(w => w.key === period);
  return <section aria-labelledby="winner-price-title">
    <h3 id="winner-price-title">Quote dei pronostici corretti e sbagliati</h3>
    <p>Prezzi originali registrati insieme alle previsioni del confronto futuro. Analizziamo il lato indicato come più probabile da ciascun modello, non la quota del vincitore scelta dopo il risultato.</p>
    <label>Periodo della previsione <select value={period} onChange={e => setPeriod(e.target.value)}>
      {report.windows.map(w => <option key={w.key} value={w.key}>{w.days === null ? 'Storico completo' : w.days === 1 ? 'Ultime 24 ore' : `Ultimi ${w.days} giorni`}</option>)}
    </select></label>
    <div className="quote-tabs" aria-label="Filtro delle quote registrate">
      {(Object.keys(labels) as PricePolicy[]).map(key => <button className={policy === key ? 'primary' : 'secondary'} key={key} aria-pressed={policy === key} onClick={() => setPolicy(key)}>{labels[key]}</button>)}
    </div>
    {window && <>
      <p>{window.registered} incontri nel periodo · {window.settled} esiti disponibili · {window.pending} in attesa · {window.invalid} non validi.</p>
      <p>{window.eligibleSettled} esiti con quote utilizzabili. Quote mancanti/non verificabili: {window.unavailableQuotes}; duplicati esclusi: {window.duplicateSettled}.</p>
      {(window.invalidSettledOutcomes > 0 || report.invalidOrFutureForecastTimes > 0) && <p role="status">Ulteriori record esclusi dai controlli: {window.invalidSettledOutcomes} esiti e {report.invalidOrFutureForecastTimes} timestamp.</p>}
      {!window.eligibleSettled ? <p role="status">Ancora nessun esito con quote originali utilizzabili in questo periodo.</p> :
        <ul className="competition-list">{window.models.map(model => {
          const s = model.policies[policy];
          return <li key={model.id}><span><strong>{model.label}</strong>
            <small>{s.selected} scelte nel filtro · {s.correct.n} corrette · {s.wrong.n} sbagliate</small>
            {s.selected ? <>
              <small>Quota media corrette: <b>{decimal(s.correct.mean)}</b> · mediana {decimal(s.correct.median)}</small>
              <small>Quota media sbagliate: <b>{decimal(s.wrong.mean)}</b> · mediana {decimal(s.wrong.median)}</small>
              <small>Differenza media sbagliate − corrette: {signed(s.meanWrongMinusCorrect)}</small>
              <small>Saldo ipotetico con 1 unità per scelta: {signed(s.theoreticalNetUnits)} unità</small>
            </> : <small>Nessuna scelta corrisponde al filtro.</small>}
            <small>Senza preferenza: {s.undecided} · escluse per quota: {s.excludedByMinimum} · per EV: {s.excludedByEV} · probabilità non valida: {s.invalidProbability}</small>
          </span></li>;
        })}</ul>}
    </>}
    <p className="fine">Nessun massimo di quota. Il filtro EV usa stime ancora in verifica e non approva pronostici operativi. Il saldo è un calcolo teorico ai prezzi salvati: nessuna puntata reale o eseguibilità della quota è certificata. Modelli diversi possono selezionare lati e incontri diversi. Nessuna nuova validazione o ROI dimostrato.</p>
    <p className="fine">Riepilogo aggiornato: {dateTime(report.checkedAt)}. Per rileggerlo usa “Ricarica stato nuovi test”.</p>
  </section>;
}
