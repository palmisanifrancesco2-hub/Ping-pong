import report from '../research/report-v11.json';
import previous from '../research/report-v11-existing.json';
import combinations from '../research/report-v12.json';
import {marketLabels} from './shared/market-labels';
const labels:Record<string,string>={'rally-iid-logit':'Proiezione dei punti','rally-beta-binomial':'Proiezione con variabilità','poisson-total-points':'Poisson sui punti totali'};
const poolLabels:Record<string,string>={'projection-with-reference':'Proiezione + candidato precedente','projection-with-reference-and-poisson':'Proiezione + candidato precedente + Poisson','projection-with-full':'Proiezione + modello completo'};
const score=(n:number)=>n.toLocaleString('it-IT',{minimumFractionDigits:5,maximumFractionDigits:5});
const hitRate=(m:{correct:number;n:number})=>(m.correct/m.n).toLocaleString('it-IT',{style:'percent',minimumFractionDigits:2,maximumFractionDigits:2});

export function ProjectionResearch(){
  return<section className="panel" aria-labelledby="projection-title">
    <h2 id="projection-title">Proiezione di punti, set e partita</h2>
    <p>La proiezione applica le regole del punteggio: dalla probabilità di vincere un punto ricava set, vincente, totali e handicap. La versione con variabilità permette alla forza relativa di cambiare tra partite. Poisson è un confronto dedicato ai punti totali.</p>
    <p className="banner"><strong>Ricerca esplorativa su {report.n} partite storiche già esaminate.</strong> I nuovi candidati non dimostrano ancora un vantaggio sui migliori precedenti oltre l’incertezza. Nessun nuovo pronostico operativo attivato.</p>
    <h3>Novità: combinare la proiezione con altri modelli</h3>
    <p>Testate 18 combinazioni a pesi fissi sugli stessi 1.804 incontri, senza cercare i pesi migliori sugli esiti. Per il vincente, completo + proiezione migliora il completo ma indovina meno partite della proiezione da sola. Nessuna combinazione supera contemporaneamente tutti i componenti e i riferimenti oltre l’incertezza nel Brier di questo confronto storico.</p>
    <details><summary>Confronto sul vincente: corretti, sbagliati e qualità delle percentuali</summary>
      <p>Stesse partite per ogni riga. Più pronostici corretti e probabilità meglio stimate sono due misure distinte. Il Brier valuta le percentuali: più basso è meglio.</p>
      <ul className="competition-list">{(()=>{
        const winner=combinations.markets.find(m=>m.target==='winner')!;
        const full=winner.candidates.find(c=>c.name==='projection-with-full')!;
        const pooled=winner.candidates.find(c=>c.name==='projection-with-reference')!;
        const fullMetrics='full-logistic' in full.components?full.components['full-logistic']:undefined;
        if(!fullMetrics)return<li>Metriche del modello completo non disponibili.</li>;
        return [
          {name:'Modello completo',metrics:fullMetrics},
          {name:'Proiezione con variabilità',metrics:full.components.projection},
          {name:'Completo + proiezione (50% / 50%)',metrics:full.metrics},
          {name:'Ensemble precedente + proiezione (50% / 50%)',metrics:pooled.metrics},
        ].map(c=><li key={c.name}><span><strong>{c.name}</strong><small>{c.metrics.correct} corretti · {c.metrics.wrong} sbagliati su {c.metrics.n} · {hitRate(c.metrics)}</small><small>Brier {score(c.metrics.brier)}</small></span></li>);
      })()}</ul>
      <p>Quando completo e proiezione concordano, in questo archivio indovinano 826 partite su 1.489, cioè il 55,47%. Essere d’accordo non rende automaticamente affidabile il pronostico. Mancano una verifica indipendente e quote eseguibili per valutare il profitto.</p>
    </details>
    <details><summary>Combinazioni per set, punti e handicap: tutti i risultati</summary>
      <p>Proiezione e candidato precedente hanno peso 50% ciascuno. Nei tre totali di punti è provata anche una miscela con Poisson, con un terzo del peso ciascuno. Ogni mercato è combinato separatamente: non è un unico modello congiunto coerente per tutti i mercati.</p>
      <ul className="competition-list">{combinations.markets.flatMap(m=>m.candidates.map(c=><li key={`${m.target}-${c.name}`}><span><strong>{marketLabels[m.target]??m.target}</strong><small>{poolLabels[c.name]??c.name}</small><small>{c.metrics.correct} corretti · {c.metrics.wrong} sbagliati · {hitRate(c.metrics)}</small><small>Brier {score(c.metrics.brier)} · candidato precedente {score(m.reference.brier)}</small></span></li>))}</ul>
      <p>Sono dati esplorativi su nove giorni già studiati. Gli intervalli appaiati considerano blocchi di tre giorni e 58 confronti. Alcune miscele migliorano il candidato precedente, senza dimostrare di superare anche la proiezione. Il consenso e le percentuali alte su selezioni molto frequenti non provano un vantaggio sulle quote.</p>
    </details>
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
