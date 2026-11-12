import snapshot from '../research/reliability-snapshot-v18.json';
import {marketLabels} from './shared/market-labels';

const brier=(x:number|null)=>x===null?'—':x.toFixed(5);
export function ProbabilisticAudit(){
 return <section className="panel" aria-labelledby="probabilistic-audit-title">
  <span className="eyebrow">QUALITÀ PREDITTIVA · BENCHMARK V18</span>
  <h2 id="probabilistic-audit-title">Quanto sono affidabili i diversi mercati?</h2>
  <p>Confronto esplorativo su <strong>{snapshot.n.toLocaleString('it-IT')} incontri</strong> in <strong>{snapshot.observedDays} giorni</strong>. Brier score: più basso è migliore. Le colonne confrontano la frequenza di riferimento, il migliore modello precedente e il migliore candidato CatBoost/NGBoost/flow per ogni mercato: i minimi di test non costituiscono una nuova validazione.</p>
  <div className="banner" role="status"><strong>Modelli non abilitati alle puntate.</strong> Mancano conferma prospettica indipendente, quote storiche realmente eseguibili e dimostrazione di vantaggio economico. Non è stata modificata la policy che blocca le classifiche operative.</div>
  <div className="table-scroll"><table><thead><tr><th>Mercato</th><th>Riferimento</th><th>Precedente</th><th>Nuovo candidato</th></tr></thead><tbody>{snapshot.markets.map(m=><tr key={m.target}><th scope="row">{marketLabels[m.target]??m.target}</th><td>{brier(m.baseline)}</td><td>{brier(m.previous)}</td><td>{brier(m.newCandidate)}</td></tr>)}</tbody></table></div>
  <p className="fine">Ogni cifra deriva dal report di ricerca v18 del 11 novembre 2026. I candidati nuovi sono confrontati sugli stessi 1.804 incontri, già oggetto di ricerca precedente. Il modello in funzione non viene sostituito per aver ottenuto il numero più basso nello storico.</p>
 </section>;
}
