import { useCallback, useEffect, useRef, useState } from 'react';
import type { ValueReport } from './shared/value';

export function useValue(token: string | undefined) {
  const [report, setReport] = useState<ValueReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const current = useRef<(force?: boolean) => Promise<void>>(async () => {});
  useEffect(() => {
    setReport(null); setError(''); setLoading(false);
    if (!token) return;
    const controller = new AbortController(); let active = true;
    let pending: Promise<void> | undefined;
    function load(force = false): Promise<void> {
      if (!active || document.hidden) return Promise.resolve();
      if (pending) return pending;
      setLoading(true);
      pending = (async () => {
        try {
          const response = await fetch(`/api/value${force ? '?refresh=1' : ''}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(90000)]) });
          if (!response.ok) throw Error();
          const value = await response.json() as ValueReport;
          if (active) { setReport(value); setError(''); }
        } catch { if (active) { setReport(null); setError('Quote selezionate non disponibili. Riprova ad aggiornare.'); } }
        finally { pending = undefined; if (active) setLoading(false); }
      })();
      return pending;
    }
    current.current = load; void load();
    const timer = setInterval(() => { void load(); }, 30000);
    const visibility = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { active = false; controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visibility); current.current = async () => {}; };
  }, [token]);
  const refresh = useCallback(() => current.current(true), []);
  return { report, loading, error, refresh };
}
