import type {ValueReliability as Report} from './domain/value-reliability';
import {dateTime} from './shared/format';

const percent=(value:number|null)=>value===null?'—':value.toLocaleString('it-IT',{style:'percent',maximumFractionDigits:1});
const score=(value:number|null)=>value===null?'—':value.toFixed(4);

export function ValueReliability({report}:{report:Report}) {
  const sections=[{title:'Diagnosi sulle partite già verificate',data:report.historical},
    {title:`Test sulle nuove partite dal ${dateTime(report.startedAt)}`,data:report.forward}];
  return <section aria-labelledby="value-reliability-title">
    <h4 id="value-reliability-title">Quanto reggono le quote ad alto EV?</h4>
    <p>Confronto sul vincente con due quote Bet365 salvate prima dell’inizio effettivo. Il criterio prudente richiede un favorito condiviso e un vantaggio ancora positivo dopo la correzione.</p>
    {sections.map(({title,data})=><div key={title}>
      <h4>{title}</h4>
      {data.n===0?<p>Nessun esito verificato con due quote utilizzabili.</p>:<>
        <p>{data.n} partite su {data.days} giorni. Brier del modello {score(data.metrics.model.brier)} · con correzione {score(data.metrics.blend.brier)} · Bet365 senza margine {score(data.metrics.market.brier)}.</p>
        <ul className="competition-list">
          {([{label:'EV originale',...data.original},{label:'EV originale di almeno +25%',...data.high},
            {label:'Filtro prudente',...data.guarded}]).map(row=><li key={row.label}><span>
            <strong>{row.label}</strong>
            <small>{row.n} selezioni · Esatto {row.exact} · Sbagliato {row.wrong}</small>
            <small>Successo {percent(row.accuracy)} · Probabilità media {percent(row.expected)} · Quota media {score(row.averageOdds)}</small>
          </span></li>)}
        </ul>
      </>}
    </div>)}
    <p className="fine">I due criteri possono selezionare numeri diversi di partite. Il test futuro serve a verificare la precisione del filtro.</p>
  </section>;
}
