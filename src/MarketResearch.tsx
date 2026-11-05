import report from '../research/report-v8.json';

const names:Record<string,string>={
  winner:'Vincente partita', 'first-set':'Vincente primo set',
  'first-set-points-over-19.5':'Primo set: Over 19,5 punti',
  'sets-over-3.5':'Over 3,5 set', 'sets-over-4.5':'Over 4,5 set',
  'points-over-74.5':'Over 74,5 punti', 'points-over-79.5':'Over 79,5 punti', 'points-over-84.5':'Over 84,5 punti',
  'home-set-handicap-minus-1.5':'Primo giocatore: handicap −1,5 set',
  'home-set-handicap-plus-1.5':'Primo giocatore: handicap +1,5 set',
  'home-point-handicap-minus-5.5':'Primo giocatore: handicap −5,5 punti',
  'home-point-handicap-plus-5.5':'Primo giocatore: handicap +5,5 punti',
  'home-point-handicap-minus-9.5':'Primo giocatore: handicap −9,5 punti',
  'home-point-handicap-plus-9.5':'Primo giocatore: handicap +9,5 punti',
};
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
    <p>Quattro famiglie di modelli confrontate su {report.historicalCases} partite storiche comuni. Un candidato scelto per ciascuno dei 14 risultati, poi verificato su {report.confirmation.n} partite successive senza cambiare la scelta.</p>
    <p className="banner"><strong>Conferma ancora insufficiente.</strong> Sono disponibili {report.confirmation.n} delle {report.protocol.freshTargetCases} partite richieste, distribuite su un solo giorno. Nessun nuovo modello attivato per le quote.</p>
    <p>I risultati più promettenti riguardano alcuni handicap. Per Over/Under e primo set il miglioramento non supera l’incertezza del campione. Servono altri giorni di verifica e quote registrate prima della partita per valutare il valore economico.</p>
    <details>
      <summary>Vedi tutti i 14 risultati del campione successivo</summary>
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
