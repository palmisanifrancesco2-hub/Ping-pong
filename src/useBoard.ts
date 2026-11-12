import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isUpcomingOrLive, type Board } from './shared/board';

export function useBoard(token: string | undefined, enabled: boolean) {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const current = useRef<(force?: boolean) => Promise<void>>(async () => {});
  useEffect(() => {
    setBoard(null); setError(''); setLoading(false);
    if (!enabled || !token) return;
    let active = true; let pending: Promise<void> | undefined;
    const controller = new AbortController();
    function load(force = false): Promise<void> {
      if (document.hidden || !active) return Promise.resolve();
      if (pending) return pending;
      setLoading(true);
      pending = (async () => {
        try {
          const response = await fetch(`/api/board${force ? '?refresh=1' : ''}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]), cache: 'no-store' });
          if (!response.ok) throw Error(response.status === 401 ? 'Sessione non autorizzata. Accedi nuovamente.' : 'MoviOdds non disponibile. Nuovo tentativo tra 30 secondi.');
          const value = await response.json() as Board;
          if (active) { setBoard(value); setError(''); setNow(Date.now()); }
        } catch (e) { if (active) { setBoard(null); setError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'Tempo massimo superato. Nuovo tentativo tra 30 secondi.'); } }
        finally { pending = undefined; if (active) setLoading(false); }
      })();
      return pending;
    }
    current.current = load; void load();
    const poll = setInterval(() => { void load(); }, 30000);
    const clock = setInterval(() => setNow(Date.now()), 10000);
    const visibility = () => { if (!document.hidden) { setNow(Date.now()); void load(); } };
    document.addEventListener('visibilitychange', visibility);
    return () => { active = false; controller.abort(); clearInterval(poll); clearInterval(clock); document.removeEventListener('visibilitychange', visibility); current.current = async () => {}; };
  }, [token, enabled]);
  const visible = useMemo(() => enabled && token && board ? { ...board, matches: board.matches.filter(m => isUpcomingOrLive(m, now)) } : null, [board, enabled, token, now]);
  const refresh = useCallback(() => current.current(true), []);
  return { board: visible, error: enabled ? error : '', loading: enabled && loading, now, refresh };
}
