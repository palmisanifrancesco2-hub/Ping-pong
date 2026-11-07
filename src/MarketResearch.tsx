import report from '../research/report-v8.json';
import extension from '../research/report-v8-extension.json';

import {marketLabels as names} from './shared/market-labels';

const models:Record<string,string>={
  'hierarchical-eb':'Frequenze regolarizzate di giocatori e scontri diretti',
  'logistic-context':'Logistica con statistiche specifiche',
  'boosted-context':'Alberi con boosting',
  'joint-score-forest':'Foresta con pesi comuni per i risultati',
};
const decimal=(n:number)=>n.toLocaleString('it-IT',{minimumFractionDigits:5,maximumFractionDigits:5});

export function MarketResearch(){
  return <section className="panel" aria-labelledby="market-research-title">
    <h2 id="market-research-title">Nuovi test: set, punti e handicap</h2>
    <p><strong>Storico esteso a {extension.totalCases} partite verificate: {extension.additionalCases} nuove oltre le {extension.originalCases} iniziali.</strong> Stessi modelli e statistiche ferme allo snapshot precedente. È un aggiornamento descrittivo; la nuova conferma su partite future è nel pannello sopra.</p>
    <details><summary>Metriche dello storico esteso a {extension.totalCases} partite</summary><ul className="competition-list">{extension.targets.map(t=><li key={t.target}><span>{names[t.target]??t.target}<small>Brier {decimal(t.metrics.brier)} · riferimento {decimal(t.reference.brier)} · {t.metrics.n} esiti</small></span></li>)}</ul><p>Estensione decisa dopo aver visto i primi 249 esiti. Non è una nuova prova indipendente e non abilita mercati operativi.</p></details>
    <p>Quattro famiglie di modelli confrontate su {report.historicalCases} partite storiche comuni. Un candidato scelto per ciascuno dei 14 risultati, poi verificato su {report.confirmation.n} partite successive senza cambiare la scelta.</p>
    <p className="banner"><strong>Conferma ancora insufficiente.</strong> Anche le {extension.totalCases} partite dello storico esteso coprono un solo giorno. Servono altri giorni e campioni più grandi. Nessun nuovo modello attivato per le quote.</p>
    <p>I risultati più promettenti riguardano alcuni handicap. Per Over/Under e primo set il miglioramento non supera l’incertezza del campione. Servono altri giorni di verifica e quote registrate prima della partita per valutare il valore economico.</p>
    <details>
      <summary>Vedi i 14 risultati del primo campione di {report.confirmation.n} partite</summary>
      <p>Brier più basso indica probabilità migliori. Il riferimento usa le frequenze della competizione note prima della partita. La percentuale di esiti corretti qui sotto descrive il test: non è la probabilità della prossima selezione e non misura il profitto.</p>
      <ul className="competition-list">{report.confirmation.targets.map(t=><li key={t.target}>
        <span><strong>{names[t.target]??t.target}</strong><small>{models[t.selected]??t.selected}</small>
          <small>Brier {decimal(t.metrics.brier)} · riferimento {decimal(t.reference.brier)}</small>
          <small>Esiti corretti {(t.metrics.accuracy*100).toFixed(1)}% · {t.metrics.n} casi · ECE {decimal(t.metrics.ece)}</small>
          {t.pairedBrierDifference.upper<0?<small>Miglioramento Brier osservato oltre l’intervallo corretto; campione ancora insufficiente.</small>:<small>Miglioramento Brier non dimostrato oltre l’incertezza.</small>}
        </span><span className="badge">{t.temporalConfirmationPassed?'Conferma temporale preliminare':'Conferma incompleta'}</span>
      </li>)}</ul>
      <p>Intervalli appaiati per blocchi di tre ore, corretti sui 14 risultati. Addestramento: {report.finalTraining} casi; calibrazione: {report.finalCalibration}. Le statistiche dei giocatori nel campione successivo sono ferme alla raccolta del giorno precedente. Under e selezioni dell’altro giocatore sulla linea opposta si ricavano come complementi, senza contare due volte il test.</p>
      <p className="fine">Fonte: risultati riportati da MoviOdds, orari controllati sulle risposte closing. Solo partite complete al meglio dei cinque set. Le linee testate sono soglie di ricerca: la loro presenza nel report non implica che siano quotate in questo momento. Il test prospettico già in corso resta invariato.</p>
    </details>
    <details>
      <summary>Come si ottengono probabilità ed EV?</summary>
      <p>Il modello combina forza degli avversari, forma recente, vittorie e sconfitte, punti, set, riposo e scontri diretti. I pesi vengono appresi sulle partite precedenti; non si sommano semplicemente le percentuali. Per ogni mercato si verifica il risultato preciso, compresa la linea dell’Over/Under o dell’handicap.</p>
      <p>EV = probabilità stimata × quota − 1. Una stima del 58% a quota 2,00 dà EV +16%: una media teorica di 1,60 € per ogni 10 € puntati, soltanto se la probabilità è attendibile. Se quella reale fosse 45%, l’EV sarebbe −10%. Nessun guadagno garantito.</p>
    </details>
  </section>;
}
