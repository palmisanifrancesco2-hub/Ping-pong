import { useEffect, useMemo, useState } from 'react';
import type { Board } from './shared/board';
import { isUpcomingOrLive } from './shared/board';

export function useBoard(token: string | undefined, enabled: boolean) {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setBoard(null); setError(''); setLoading(false);
    if (!enabled || !token) return;
    let active = true; let inFlight = false;
    const controller = new AbortController();
    async function load() {
      if (inFlight || document.hidden || !active) return;
      inFlight = true; setLoading(true);
      try {
        const response = await fetch('/api/board', { headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25_000)]), cache: 'no-store' });
        if (!response.ok) throw new Error(response.status === 401 ? 'Sessione non autorizzata. Accedi nuovamente.' : 'MoviOdds non disponibile. Il prossimo tentativo avverrà tra 30 secondi.');
        const value = await response.json() as Board;
        if (active) { setBoard(value); setError(''); setNow(Date.now()); }
      } catch (e) {
        if (active) { setBoard(null); setError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'Tempo massimo superato. Nuovo tentativo tra 30 secondi.'); }
      } finally { inFlight = false; if (active) setLoading(false); }
    }
    void load();
    const poll = setInterval(() => { void load(); }, 30_000);
    const clock = setInterval(() => setNow(Date.now()), 10_000);
    const onVisibility = () => { if (!document.hidden) { setNow(Date.now()); void load(); } };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { active = false; controller.abort(); clearInterval(poll); clearInterval(clock); document.removeEventListener('visibilitychange', onVisibility); };
  }, [token, enabled, revision]);
  const visible = useMemo(() => enabled && token && board ? { ...board, matches: board.matches.filter(m => isUpcomingOrLive(m, now)) } : null, [board, enabled, token, now]);
  return { board: visible, error: enabled ? error : '', loading: enabled && loading, now, refresh: () => setRevision(v => v + 1) };
}
