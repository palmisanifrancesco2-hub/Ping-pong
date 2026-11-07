import { useEffect, useRef, useState } from 'react';
import { dateTime } from './shared/format';
import type { ProspectiveStudy as StudyService } from '../server/prospective-study';

type Report = Awaited<ReturnType<StudyService['report']>>;
const percent = (v: number | null) => v === null ? 'In attesa' : `${(v * 100).toFixed(2)}%`;
const score = (v: number | null) => v === null ? 'In attesa' : v.toFixed(4);

export function ProspectiveStudy({ token, demo }: { token?: string; demo: boolean }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const action = useRef<AbortController | null>(null);
  useEffect(() => () => { action.current?.abort(); action.current = null; }, [token, demo]);
  useEffect(() => {
    setReport(null); setError('');
    if (!token || demo) return;
    const c = new AbortController();
    fetch('/api/study', { headers: { Authorization: `Bearer ${token}` }, signal: c.signal })
      .then(async r => { if (!r.ok) throw Error(); return r.json() as Promise<Report>; })
      .then(setReport).catch(() => { if (!c.signal.aborted) setError('Stato del test non disponibile. Le altre sezioni restano utilizzabili.'); });
    return () => c.abort();
  }, [token, demo, revision]);
  async function update() {
    if (!token || busy) return;
    const c = new AbortController(); action.current = c;
    const timeout = setTimeout(() => c.abort(), 290000);
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/study', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, signal: c.signal });
      if (!r.ok) throw Error();
      setRevision(v => v + 1);
    } catch { if (action.current === c) setError('Aggiornamento non confermato. Ricarica lo stato: le osservazioni già salvate sono conservate.'); }
    finally { clearTimeout(timeout); if (action.current === c) { action.current = null; setBusy(false); } }
  }
  return <section className="panel" aria-labelledby="prospective-title">
    <span className="eyebrow">TEST CON PREVISIONI REGISTRATE PRIMA DEGLI ESITI</span>
    <h2 id="prospective-title">Il modello trova quote di valore?</h2>
    <p>Il test usa un modello e regole fissati in anticipo. Puoi continuare a consultare quote, percentuali, giocatori e storico, salvare le tue scelte e usare il diario delle puntate manuali.</p>
    {demo ? <p>Accedi per seguire il test reale. Nessun risultato simulato.</p> : error && !report ? <div><p role="alert">{error}</p><button className="text-button" onClick={() => setRevision(v => v + 1)}>Riprova stato del test</button></div> : !report ? <p role="status">Caricamento stato del test…</p> : <>
      <span className="badge">{report.captured ? 'Raccolta avviata' : 'In attesa delle prime osservazioni'} · {report.productionValidated ? 'Validazione disponibile' : 'Modello sperimentale'}</span>
      <p>{report.scheduled ? 'Raccolta cloud programmata ogni giorno nella fascia 04:00–05:00 UTC.' : 'Raccolta automatica non configurata.'} Fino a {report.protocol.maximumPerDay} nuove selezioni al giorno; un tentativo giornaliero, senza riempire i lotti parziali. Le quote visibili nell’app continuano ad aggiornarsi ogni 30 secondi.</p>
      <dl><dt>Previsioni del nuovo test</dt><dd>{report.captured}</dd><dt>Protocollo fissato</dt><dd>{dateTime(report.protocol.createdAt)}</dd><dt>Ultimo controllo dello stato</dt><dd>{dateTime(report.checkedAt)}</dd><dt>Ultimo lotto di raccolta</dt><dd>{report.batches[0] ? String((report.batches[0].parameters as Record<string, unknown>).state) : 'Nessun lotto registrato'}</dd></dl>
      <div className="two-columns">{report.phases.map((phase, i) => <article key={phase.from}>
        <h3>{i === 0 ? 'Prima verifica' : 'Seconda verifica temporale'}</h3>
        <p>{dateTime(phase.from)} → {dateTime(phase.to)}</p>
        <p>{phase.settled} / {report.protocol.minimumPhaseSettled} esiti valutabili · {phase.observedDays} giorni osservati · {phase.pending} in attesa · {phase.invalid} esclusi per inizio non coerente.</p>
        <dl><dt>Corrette / sbagliate / annullate</dt><dd>{phase.won} / {phase.lost} / {phase.void}</dd><dt>Rendimento virtuale (1 unità per previsione)</dt><dd>{percent(phase.roi)}</dd><dt>Intervallo prudente al 97,5%</dt><dd>{phase.roiInterval.lower === null ? 'Campione temporale insufficiente' : `${percent(phase.roiInterval.lower)} → ${percent(phase.roiInterval.upper)}`}</dd><dt>Brier modello / bookmaker</dt><dd>{score(phase.model.brier)} / {score(phase.market.brier)}</dd><dt>Log Loss modello / bookmaker</dt><dd>{score(phase.model.logLoss)} / {score(phase.market.logLoss)}</dd><dt>Errore di calibrazione</dt><dd>{score(phase.model.ece)}</dd></dl>
        <details><summary>Requisiti della verifica</summary><ul>{phase.checks.map(check => <li key={check.label}>{check.passed ? '✓' : '○'} {check.label}</li>)}</ul></details>
      </article>)}</div>
      <p>{report.preliminaryPass ? 'Entrambe le fasi superano i criteri preliminari sulla fonte. Serve una revisione prima di usare il modello come validato.' : 'Il test non ha ancora dimostrato un vantaggio affidabile. Nessuna promozione automatica del modello.'}</p>
      <p className="fine">Esiti MoviOdds riportati e inizio effettivo verificato sulla fonte. Le quote osservate non certificano una puntata eseguibile. I precedenti 3000 casi storici e il campione di 304 previsioni restano separati. Due fasi di 14 giorni e almeno 1000 esiti ciascuna: se mancano osservazioni, il risultato resta inconcludente.</p>
      {error && <p role="alert">{error}</p>}
      <button className="text-button" disabled={busy} onClick={() => setRevision(v => v + 1)}>Ricarica stato</button>
      {report.canRun && report.enabled && <button className="primary" disabled={busy} onClick={update}>{busy ? 'Aggiornamento in corso (fino a 5 minuti)…' : 'Aggiorna raccolta ed esiti'}</button>}
    </>}
  </section>;
}
