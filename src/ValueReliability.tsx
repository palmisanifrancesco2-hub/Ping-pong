import type {ValueReliability as Report} from './domain/value-reliability';
import {dateTime} from './shared/format';

const percent=(value:number|null)=>value===null?'—':value.toLocaleString('it-IT',{style:'percent',maximumFractionDigits:1});
const score=(value:number|null)=>value===null?'—':value.toFixed(4);

export function ValueReliability({report}:{report:Report}) {
  const sections=[{title:'Diagnosi sulle partite già verificate',data:report.historical},
    {title:`Test sulle nuove partite dal ${dateTime(report.startedAt)}`,data:report.forward}];
  return <section aria-labelledby="value-reliability-title">
    <h4 id="value-reliability-title">Quanto reggono le quote ad alto EV?</h4>
    <p>Confronto sul vincente con due quote Bet365 salvate prima dell’inizio effettivo. Il filtro valuta entrambi i lati del mercato e richiede un EV ancora positivo dopo la correzione.</p>
    {sections.map(({title,data})=><div key={title}>
      <h4>{title}</h4>
      {data.n===0?<p>Nessun esito verificato con due quote utilizzabili.</p>:<>
        <p>{data.n} partite su {data.days} giorni. Brier del modello {score(data.metrics.model.brier)} · con correzione {score(data.metrics.blend.brier)} · Bet365 senza margine {score(data.metrics.market.brier)}.</p>
        <ul className="competition-list">
          {([{label:'EV originale',...data.original},{label:'EV originale di almeno +25%',...data.high},
            {label:'Filtro prudente',...data.guarded},...(data.guardedUnderdogs?[{label:'Sfavoriti Bet365 nel filtro prudente',...data.guardedUnderdogs}]:[])]).map(row=><li key={row.label}><span>
            <strong>{row.label}</strong>
            <small>{row.n} selezioni · Esatto {row.exact} · Sbagliato {row.wrong}</small>
            <small>Successo {percent(row.accuracy)} · Probabilità media {percent(row.expected)} · Quota media {score(row.averageOdds)}</small>
            {row.n>0&&row.roi&&<small>Rendimento teorico a quota salvata {percent(row.roi.mean)} · {row.roi.lower===null?'Pochi giorni per stimare l’incertezza':`intervallo 97,5% da ${percent(row.roi.lower)} a ${percent(row.roi.upper)}`}</small>}
          </span></li>)}
        </ul>
      </>}
    </div>)}
    <h4>Quota salvata e quota prematch successiva</h4>
    {report.forward.closingValue?.n>0?<p>La quota Bet365 è scesa per {report.forward.closingValue.shortened} su {report.forward.closingValue.n} favoriti del modello. Per {report.forward.closingValue.positive} la quota iniziale superava anche la quota equa successiva. Scarto medio {percent(report.forward.closingValue.mean)}.</p>:<p>In attesa di quote prematch successive verificabili per i favoriti del modello con EV positivo.</p>}
    <p className="fine">Rendimento calcolato con una unità teorica per selezione ai prezzi salvati. Il test futuro misura sia la precisione delle probabilità sia il rendimento.</p>
  </section>;
}
