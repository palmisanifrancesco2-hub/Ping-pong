import report from '../research/report-v11.json';
import previous from '../research/report-v11-existing.json';
import {marketLabels} from './shared/market-labels';
const labels:Record<string,string>={'rally-iid-logit':'Proiezione dei punti','rally-beta-binomial':'Proiezione con variabilità','poisson-total-points':'Poisson sui punti totali'};
const score=(n:number)=>n.toLocaleString('it-IT',{minimumFractionDigits:5,maximumFractionDigits:5});

export function ProjectionResearch(){
  return<section className="panel" aria-labelledby="projection-title">
    <h2 id="projection-title">Proiezione di punti, set e partita</h2>
    <p>La proiezione applica le regole del punteggio: dalla probabilità di vincere un punto ricava set, vincente, totali e handicap. La versione con variabilità permette alla forza relativa di cambiare tra partite. Poisson è un confronto dedicato ai punti totali.</p>
    <p className="banner"><strong>Ricerca esplorativa su {report.n} partite storiche già esaminate.</strong> I nuovi candidati non dimostrano ancora un vantaggio sui migliori precedenti oltre l’incertezza. Nessun nuovo pronostico operativo attivato.</p>
    <details><summary>Proiezione e Poisson: cosa cambia?</summary>
      <p>Proiezione indica ciò che vogliamo stimare. Qui usiamo un processo di punti e set che rispetta il set a 11 con due punti di vantaggio e la partita al meglio dei cinque set. Le probabilità sono calcolate combinando i possibili sviluppi, senza estrarre pronostici casuali.</p>
      <p>Poisson stima un conteggio, come il totale dei punti. Da solo non descrive la sequenza dei set: nel tennistavolo si può vincere una partita pur avendo segnato meno punti dell’avversario. Per questo lo abbiamo testato soltanto sui totali.</p>
    </details>
    <details><summary>Risultati dei nuovi modelli sui 14 obiettivi</summary>
      <p>Stessi incontri per tutti i confronti. Addestramento e calibrazione precedono ogni finestra di test; gli esiti del nuovo studio prospettico non sono usati. Brier più basso indica probabilità migliori. Il candidato mostrato è quello con il Brier più basso in questo confronto storico, senza una scelta automatica per l’app.</p>
      <ul className="competition-list">{previous.markets.map(m=>{
        const best=[...m.candidates].sort((a,b)=>a.metrics.brier-b.metrics.brier)[0];
        return<li key={m.target}><span><strong>{marketLabels[m.target]??m.target}</strong><small>{labels[best.name]??best.name} · {best.metrics.n} esiti</small><small>Brier {score(best.metrics.brier)} · migliore precedente {score(m.reference.brier)}</small><small>Vantaggio sul precedente migliore non dimostrato oltre l’incertezza.</small></span></li>;
      })}</ul>
      <p>Il confronto con i candidati precedenti è un approfondimento esplorativo sugli stessi dati già conosciuti. Gli intervalli appaiati usano blocchi di tre giorni e una correzione prudente per i confronti multipli. La verifica futura resta separata.</p>
    </details>
    <p className="fine">Fonte: risultati riportati da MoviOdds e orari già verificati tramite closing. Mancano sequenze punto per punto e dati su chi serve: il modello ne conserva esplicitamente i limiti. Quote effettivamente eseguibili e profitto non sono valutati da questo storico. <a href="https://arxiv.org/abs/1109.6628" target="_blank" rel="noreferrer">Modelli stocastici del tennistavolo ↗</a></p>
  </section>;
}
