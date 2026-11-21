import { useEffect, useRef, useState } from 'react';
import type { ProfileReport } from './shared/profiles';
import { dateTime } from './shared/format';
export function PlayerProfiles({ token, eventId }: { token?: string; eventId: string }) {
  const [report, setReport] = useState<ProfileReport | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), [eventId, token]);
  async function load() {
    if (!token || busy) return;
    const c = new AbortController(); controller.current = c; setBusy(true); setError('');
    try {
      const r = await fetch(`/api/profiles?${new URLSearchParams({ eventId })}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.any([c.signal, AbortSignal.timeout(45000)]) });
      if (!r.ok) throw Error(); const data = await r.json() as ProfileReport;
      if (!c.signal.aborted) setReport(data);
    } catch { if (!c.signal.aborted) setError('Profili aggiuntivi non disponibili. Le statistiche della partita restano consultabili.'); }
    finally { if (!c.signal.aborted) setBusy(false); }
  }
  return <section className="profiles-panel"><h3>Profili pubblici dei giocatori</h3><p>Fonte aggiuntiva gratuita: Wikidata. Copertura parziale; non sostituisce lo storico dei risultati e non modifica il modello.</p><button className="secondary" disabled={!token || busy} onClick={load}>{busy ? 'Ricerca profili…' : 'Cerca profili estesi'}</button>{error && <p role="alert">{error}</p>}{report && <div className="two-columns">{report.profiles.map(p => <article className="panel" key={p.requestedName}><h3>{p.requestedName}</h3>{p.status === 'unavailable' ? <p>Fonte temporaneamente non disponibile.</p> : !p.candidates.length ? <p>Nessun profilo compatibile trovato. Data di nascita, nazionalità e ranking restano non disponibili.</p> : <><p className="fine">{p.status === 'ambiguous' ? 'Più profili omonimi: identità da verificare.' : 'Possibile corrispondenza per nome e sport. Identità da verificare: le fonti non condividono un ID giocatore.'}</p>{p.candidates.map(c => <div key={c.id}><a href={c.url} target="_blank" rel="noreferrer">{c.name} · {c.id} ↗</a><dl><dt>Nascita indicata dalla fonte</dt><dd>{c.birthDate ?? 'Non disponibile'}</dd><dt>Cittadinanza indicata dalla fonte</dt><dd>{c.countries.join(', ') || 'Non disponibile'}</dd></dl></div>)}</>}<small>{p.source} · {p.license} · {dateTime(p.checkedAt)}</small></article>)}</div>}</section>;
}
