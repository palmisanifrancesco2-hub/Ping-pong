import { useEffect, useState } from 'react';
import { HISTORY_PERIODS, OUTCOME_LABELS, type HistoryPeriod, type HistoryReport, type OutcomeStatus } from './shared/history';
import type{BetPrefill}from'./shared/bets';
import { dateTime } from './shared/format';

export function PeriodSelect({ value, onChange }: { value: HistoryPeriod; onChange: (v: HistoryPeriod) => void }) {
  return <label>Intervallo<select aria-label="Intervallo storico" value={value} onChange={e => onChange(e.target.value as HistoryPeriod)}>{HISTORY_PERIODS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>;
}
export function PredictionHistory({ token, demo, period, onPeriod,onBet }: { token?: string; demo: boolean; period: HistoryPeriod; onPeriod: (v: HistoryPeriod) => void;onBet?:(p:BetPrefill)=>void }) {
  const [report, setReport] = useState<HistoryReport | null>(null);
  const[origin,setOrigin]=useState('all');
  const [status, setStatus] = useState<OutcomeStatus | 'all'>('all');
  const [page, setPage] = useState(1); const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [syncNotice,setSyncNotice]=useState('');
  const[syncing,setSyncing]=useState(false);
  async function sync(){if(!token||demo)return;setSyncing(true);setSyncNotice('');try{const r=await fetch('/api/settle',{method:'POST',headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(90000)});if(!r.ok)throw Error();const d=await r.json();setSyncNotice(`Aggiornamento completato: ${d.updated} esiti riportati dalla fonte. Non certificati indipendentemente.`);setRevision(v=>v+1);}catch{setSyncNotice('Aggiornamento esiti non riuscito. Le registrazioni restano conservate.');}finally{setSyncing(false);}}
  useEffect(() => {
    setReport(null); setError('');
    if (!token || demo) return;
    let active = true; const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ period, page: String(page), status,origin });
    async function load() {
      try {
        if(!active)return;
        const response = await fetch(`/api/history?${params}`, { headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35_000)]) });
        if (!response.ok) throw new Error(response.status === 401 ? 'Sessione non autorizzata. Accedi nuovamente.' : 'Storico temporaneamente non disponibile. Nessun risultato viene considerato zero in caso di errore.');
        const value = await response.json() as HistoryReport;
        if (active) setReport(value);
      } catch (e) { if (active) setError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'Tempo massimo dello storico superato. Riprova.'); }
      finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; controller.abort(); };
  }, [token, demo, period, status, origin, page, revision]);
  useEffect(()=>{if(!token||demo)return;const c=new AbortController();fetch('/api/settle',{method:'POST',headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.any([c.signal,AbortSignal.timeout(90000)])}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{if(!c.signal.aborted&&d.updated>0){setSyncNotice(`Aggiornati ${d.updated} esiti provvisori dalla fonte.`);setRevision(v=>v+1);}}).catch(()=>{if(!c.signal.aborted)setSyncNotice('Esiti non sincronizzati automaticamente. Puoi riprovare con il pulsante dedicato.');});return()=>c.abort();},[token,demo]);
  const visible = !demo && token ? report : null;
  return <section className="panel history-panel"><div className="panel-heading"><div><span className="eyebrow">SOLO PREVISIONI REALMENTE REGISTRATE</span><h2>Storico previsioni</h2></div><PeriodSelect value={period} onChange={onPeriod}/></div>
    <p>Filtra per data di registrazione della previsione. Gli intervalli sono mobili di 24 ore; i mesi intermedi corrispondono a 30 giorni, l’anno a 365. Nessun risultato viene ricostruito retroattivamente.</p>
    <div className="history-controls"><label>Origine<select aria-label="Origine previsioni" value={origin} onChange={e=>{setOrigin(e.target.value);setPage(1);}}><option value="all">Tutte</option><option value="manual">Registrate da me</option><option value="study">Test prospettico automatico</option></select></label><label>Esito<select aria-label="Esito previsione" value={status} onChange={e => { setStatus(e.target.value as OutcomeStatus | 'all'); setPage(1); setReport(null); }}><option value="all">Tutti gli esiti</option>{Object.entries(OUTCOME_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><button className="primary" disabled={loading || demo || !token} onClick={() => { setReport(null); setRevision(v => v + 1); }}>Aggiorna storico</button><button className="text-button" disabled={syncing||demo||!token} onClick={sync}>{syncing?'Sincronizzazione esiti…':'Verifica esiti dalla fonte'}</button></div>
    {loading && !demo && <p role="status">Caricamento dello storico privato…</p>}
    {error && !demo && <p role="alert" className="error">{error}</p>}
    {syncNotice&&!demo&&<p role="status" className="banner">{syncNotice}</p>}
    {demo && <div className="empty"><h3>Anteprima senza storico</h3><p>Nessuna chiamata al database o previsione dimostrativa.</p></div>}
    {visible && <>{visible.partial && <div role="alert" className="banner">Analisi parziale: esaminate le ultime {visible.analyzed} previsioni su {visible.totalRecorded}. I contatori e i filtri seguenti si riferiscono soltanto a queste righe. Restringi l’intervallo per un riepilogo completo.</div>}
      <p className="fine">Registrate nel periodo: {visible.totalRecorded} · Da {visible.from ? dateTime(visible.from) : 'inizio storico'} a {dateTime(visible.to)} · Lettura: {dateTime(visible.checkedAt)}</p>
      <h3>Esiti con conferma indipendente</h3><div className="history-metrics">{[
        ['Corrette', String(visible.summary.won), 'won'], ['Sbagliate', String(visible.summary.lost), 'lost'],
        ['Annullate', String(visible.summary.void), 'void'], ['In attesa', String(visible.summary.pending), 'pending'],
        ['Da verificare', String(visible.summary.unverified), 'unverified'],
        ['Percentuale corrette', visible.summary.hitRate === null ? '—' : `${(visible.summary.hitRate * 100).toFixed(1)}%`, ''],
      ].map(([label, value, kind]) => <article className={`metric ${kind}`} key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      <p>Profitto teorico a puntata fissa di 1 unità: <strong>{visible.summary.theoreticalProfit === null ? 'Non disponibile' : `${visible.summary.theoreticalProfit.toFixed(2)} u`}</strong>.</p>
      {visible.sourceSummary&&visible.sourceSummary.won+visible.sourceSummary.lost>0&&<div className="banner"><strong>Esiti provvisori secondo MoviOdds</strong><p>Corrette: {visible.sourceSummary.won} · Sbagliate: {visible.sourceSummary.lost} · Percentuale: {visible.sourceSummary.hitRate===null?'—':`${(visible.sourceSummary.hitRate*100).toFixed(1)}%`}. Fonte aggregata, senza conferma ufficiale indipendente: questi esiti non entrano nei contatori verificati sopra.</p></div>}
      <p className="fine">Percentuale = corrette ÷ (corrette + sbagliate). Annullate, in attesa e da verificare sono escluse. I contatori rispettano il filtro origine e l’intero intervallo analizzato, indipendentemente dal filtro esito. Queste statistiche descrivono gli esiti registrati e non certificano la validazione del modello. Non sono puntate reali né profitti effettivi.</p>
      {!visible.totalRecorded ? <div className="empty"><h3>Nessuna previsione registrata nel periodo</h3><p>In questo intervallo non risultano previsioni registrate. Le quote live da sole non costituiscono un pronostico. Puoi registrare le stime sperimentali da Giocatori e pronostico oppure dal Value Tracker. Le puntate realmente effettuate si inseriscono separatamente nel diario Smart Stake.</p></div> : !visible.entries.length ? <p>Nessuna previsione corrisponde al filtro esito o alla pagina selezionata.</p> : <div className="prediction-list">{visible.entries.map(entry => <article className="prediction-card" key={entry.id}>
        <div className="panel-heading"><div><small>{dateTime(entry.predictedAt)} · {entry.competition}</small><h3>{entry.match}</h3></div><span className={`outcome-badge ${entry.status}`}>{entry.reportedStatus?`${entry.reportedStatus==='won'?'Corretta':'Sbagliata'} · secondo la fonte`:OUTCOME_LABELS[entry.status]}</span></div>
        <p>{entry.studyId?'Test prospettico automatico · ':'Registrazione personale · '}{entry.market} · Selezione: <strong>{entry.selection}</strong></p>{entry.reportedStatus && <p className="banner">{entry.reportedStatus==='won'?'Corretta':'Sbagliata'} secondo il risultato MoviOdds. Conferma ufficiale indipendente mancante; esclusa dalle statistiche degli esiti verificati.</p>}<dl><dt>Quota registrata / bookmaker</dt><dd>{entry.odds.toLocaleString('it-IT')} · {entry.bookmaker}</dd><dt>Timestamp quota</dt><dd>{dateTime(entry.quoteUpdatedAt)}</dd><dt>Probabilità prevista / campione</dt><dd>{(entry.probability * 100).toFixed(1)}% · {entry.sampleSize} osservazioni</dd><dt>Modello</dt><dd>{entry.model} · {entry.modelValidated ? 'Versione registrata come validata' : 'Non validato'}</dd><dt>Risultato registrato / fonte</dt><dd>{entry.result ?? 'Non disponibile'} · {entry.resultSource ?? 'Non disponibile'}</dd><dt>Esito aggiornato</dt><dd>{dateTime(entry.settledAt ?? undefined)}</dd><dt>Profitto teorico per 1 unità</dt><dd>{entry.theoreticalProfit === null ? 'In attesa / non verificabile' : `${entry.theoreticalProfit.toFixed(2)} u`}</dd></dl>
      {onBet&&<button className="text-button" onClick={()=>onBet({predictionId:entry.id,odds:entry.odds,notes:`${entry.match} · ${entry.selection}`})}>Inserisci puntata reale collegata</button>}
      </article>)}</div>}
      {visible.filteredCount > visible.pageSize && <div className="history-pages"><button className="primary" disabled={loading || page <= 1} onClick={() => { setReport(null); setPage(v => v - 1); }}>← Precedenti</button><span>Pagina {page} di {Math.ceil(visible.filteredCount / visible.pageSize)}</span><button className="primary" disabled={loading || page * visible.pageSize >= visible.filteredCount} onClick={() => { setReport(null); setPage(v => v + 1); }}>Successive →</button></div>}
    </>}
  </section>;
}
