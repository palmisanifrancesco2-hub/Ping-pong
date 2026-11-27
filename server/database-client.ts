import type { ClientConfig } from 'pg';
import { databaseTls } from './database-tls.js';
export function databaseClientConfig(env: Record<string,string | undefined>, caPem: string): ClientConfig {
  if (!env.POSTGRES_URL || !env.SUPABASE_URL) throw new Error('DB_CONFIG');
  let url: URL, project: URL;
  try { url = new URL(env.POSTGRES_URL); project = new URL(env.SUPABASE_URL); } catch { throw new Error('DB_CONFIG'); }
  if (project.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(project.hostname)) throw new Error('DB_PROJECT');
  if (!['postgres:','postgresql:'].includes(url.protocol) || !url.password || (!url.hostname.endsWith('.supabase.com') && !url.hostname.endsWith('.supabase.co'))) throw new Error('DB_TARGET');
  const ref = project.hostname.split('.')[0];
  if (decodeURIComponent(url.username) !== `postgres.${ref}` && !(url.hostname === `db.${ref}.supabase.co` && decodeURIComponent(url.username) === 'postgres')) throw new Error('DB_PROJECT_MISMATCH');
  // URI SSL options must never override the pinned CA / verification settings.
  for (const name of ['sslmode','sslcert','sslkey','sslrootcert']) url.searchParams.delete(name);
  return { connectionString:url.toString(), ssl:databaseTls(caPem), connectionTimeoutMillis:15_000, query_timeout:35_000 };
}
