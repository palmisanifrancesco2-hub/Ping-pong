import type{ModelComparisonReport}from'./shared/comparison';
const names:Record<string,string>={elo10:'Elo K=10',elo20:'Elo K=20',elo40:'Elo K=40',elo80:'Elo K=80',form20:'Forma ultime 20', 'elo40-form20':'Elo + forma'};
const label=(name:string)=>names[name]??name.replace('full:','Logistica completa · λ ').replace('scores:','Logistica punti e set · λ ').replace('form:','Logistica forma · λ ');
export function ModelComparison({report:r}:{report:ModelComparisonReport}){
 const winner=r.ranking[0],gap=r.paired[r.secondPlace];
 return<section className="panel"><h2>Classifica sullo stesso storico</h2><p>{r.ranking.length} modelli sulle stesse {r.testCases} partite già giocate: {r.days} giorni e {r.evaluatedFolds} finestre temporali. Per ogni finestra, addestramento e calibrazione usano soltanto informazioni precedenti.</p>
 <div className="banner"><strong>Primo per Brier: {label(r.winner)}</strong><p>{(winner.accuracy*100).toFixed(1)}% di esiti corretti · Brier {winner.brier?.toFixed(5)} · Log Loss {winner.logLoss?.toFixed(5)}.</p><p>{r.reason}. Dando lo stesso peso a ogni giorno, il primo diventa {label(r.equalDayWinner)}.</p></div>
 <p>La classifica privilegia la precisione delle probabilità: Brier più basso significa errore minore. Il riferimento 50–50 vale 0,25000. La percentuale di esiti corretti è una misura distinta.</p>
 <ol className="comparison-ranking">{r.ranking.map(m=><li key={m.name}><strong>{label(m.name)}</strong><span>Brier {m.brier?.toFixed(5)} · Corretti {(m.accuracy*100).toFixed(1)}%</span><small>Log Loss {m.logLoss?.toFixed(5)} · ECE {m.ece?.toFixed(4)} · {m.n} casi</small></li>)}</ol>
 <details><summary>Quanto è sicuro il primo posto?</summary><p>Differenza Brier rispetto a {label(r.secondPlace)}: intervallo diagnostico al 95% da {gap?.lower95?.toFixed(5)??'n/d'} a {gap?.upper95?.toFixed(5)??'n/d'}. Se comprende zero, non emerge un vantaggio convincente sul secondo.</p><p>Gli intervalli raggruppano le partite per giorno. Il primo classificato è stato individuato nello stesso archivio già esplorato: resta possibile un adattamento alle particolarità di questi dati. I confronti multipli e i giocatori ripetuti limitano la certezza.</p></details>
 <p className="fine">Migliore in questa classifica storica, non modello migliore in assoluto o prova di profitto. Il test non cambia le 304 osservazioni future già congelate né attiva automaticamente previsioni validate.</p>
 </section>;
}
