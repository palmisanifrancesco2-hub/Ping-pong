import type {Env} from './auth.js';

/** Private provider authentication. Never import this module from src/. */
export function movioddsRequest(url: string, init: RequestInit = {}, fetcher: typeof fetch = fetch,
  env: Env = process.env): Promise<Response> {
  const target = new URL(url);
  if (target.origin !== 'https://moviodds.com' || target.username || target.password) {
    throw Error('MOVIODDS_UNTRUSTED_ORIGIN');
  }
  const key = env.MOVIODDS_API_KEY?.trim();
  if (key && (key.length > 4096 || /[\r\n]/.test(key))) throw Error('MOVIODDS_INVALID_KEY');
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  // Ignore caller-supplied provider credentials; use only the private environment.
  headers.delete('X-API-Key');
  if (key) headers.set('X-API-Key', key);
  return fetcher(target.href, {...init, headers, redirect: 'error'});
}
