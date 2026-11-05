import type {winnerDiagnostic} from './domain/winner-comparison';
import type {WinnerShadow} from '../server/winner-shadow';
type Review=ReturnType<typeof winnerDiagnostic>;
type Shadow=Awaited<ReturnType<WinnerShadow['report']>>;
const score=(v:number|null)=>v===null?'in attesa':v.toFixed(5);

export function WinnerReview({review,shadow}:{review?:Review;shadow?:Shadow}){
  const reference=review?.reference.brier;
  const noBetterCandidate=!!review?.n&&reference!==undefined&&reference!==null&&review.models.every(m=>m.brier!==null&&m.brier>=reference);
  return <section aria-labelledby="winner-review-title">
    <h3 id="winner-review-title">Rivediamo il candidato del vincente</h3>
    <p>Confrontiamo il candidato delle frequenze regolarizzate, il modello completo delle quote e altre due logistiche. Il test già registrato conserva tutte le previsioni originali.</p>
    {noBetterCandidate&&<p className="banner">Su questo campione nessun candidato supera le frequenze della competizione nel Brier. La scelta di un sostituto richiede la verifica su nuovi dati.</p>}
    {review&&<details><summary>Diagnosi sugli stessi {review.n} incontri già conosciuti</summary>
      <p>Le alternative usano esattamente i dati salvati prima di ogni partita e pesi già addestrati prima degli esiti. Le loro probabilità sono ricostruite ora: questo confronto è esplorativo e serve a preparare la verifica futura.</p>
      {review.n!==review.expected&&<p role="status">Il campione attuale contiene {review.n} dei {review.expected} esiti originari; verificare eventuali revisioni della fonte.</p>}
      <ul className="competition-list">{review.models.map(m=><li key={m.id}><span><strong>{m.label}</strong><small>{m.correct} corrette · {m.wrong} sbagliate · {m.undecided} senza preferenza</small><small>Brier {score(m.brier)} · Log Loss {score(m.logLoss)} · ECE {score(m.ece)}</small></span></li>)}</ul>
      <p>Riferimento della competizione: Brier {score(review.reference.brier)}. Si valutano qualità delle probabilità e incertezza, oltre agli esiti più probabili.</p>
      <details><summary>Dove sbaglia il candidato attuale?</summary><ul>{review.confidence.map(g=><li key={g.from}>Probabilità del favorito {Math.round(g.from*100)}–{Math.min(100,Math.round(g.to*100))}%: {g.correct} corrette, {g.wrong} sbagliate, {g.n} esiti.</li>)}</ul><ul>{review.leagues.map(g=><li key={g.league}>{g.league}: {g.correct} corrette, {g.wrong} sbagliate su {g.n}. Campione descrittivo.</li>)}</ul></details>
    </details>}
    {shadow&&<>
      <h3>Confronto parallelo su partite future</h3>
      <p>{shadow.captured} partite con quattro previsioni registrate allo stesso istante · {shadow.settled} esiti verificati · {shadow.pending} in attesa · {shadow.invalid} invalidi.</p>
      <p>Nuove statistiche causali identiche per tutti i candidati e quote dei due giocatori salvate per confrontare anche le probabilità del bookmaker. La scelta di un sostituto dipende da questi nuovi dati, separati dalla diagnosi precedente.</p>
      <details><summary>Metriche del confronto futuro</summary><ul className="competition-list">{shadow.models.map(m=><li key={m.id}><span><strong>{m.label}</strong><small>{m.correct} corrette · {m.wrong} sbagliate · {m.undecided} senza preferenza</small><small>Brier {score(m.brier)} · Log Loss {score(m.logLoss)} · {m.n} esiti</small></span></li>)}</ul><p>Bookmaker senza margine: Brier {score(shadow.bookmaker.brier)}. Frequenze della competizione: Brier {score(shadow.league.brier)}.</p></details>
      <p className="fine">Controlli fissi a {shadow.protocol.checkpoints.join(', ')} nuove osservazioni, almeno {shadow.protocol.minimumDays} giorni e confronti corretti per candidati, riferimenti e controlli ripetuti. Nessuna sostituzione automatica o puntata. Questi incontri possono comparire anche nel test originario: i campioni restano separati.</p>
    </>}
  </section>;
}
