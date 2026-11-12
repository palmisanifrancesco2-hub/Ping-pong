export function isPublishableSupabaseKey(key: string): boolean {
  if (key.startsWith('sb_publishable_')) return key.length > 'sb_publishable_'.length;
  if (key.startsWith('sb_secret_')) return false;
  try {
    const parts = key.split('.');
    if (parts.length !== 3) return false;
    const claims: unknown = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof claims === 'object' && claims !== null && 'role' in claims && claims.role === 'anon';
  } catch { return false; }
}

export function validateSupabaseClientConfig(url: string | undefined, key: string | undefined) {
  if (!url?.trim() && !key?.trim()) return null;
  if (!url?.trim() || !key?.trim()) throw new Error('Configurazione Supabase incompleta: servono URL e chiave pubblicabile.');
  let project: URL;
  try { project = new URL(url.trim()); } catch { throw new Error('URL del progetto Supabase non valido.'); }
  if (project.protocol !== 'https:' || !project.hostname.endsWith('.supabase.co') || project.username || project.password || project.search || project.hash || !['', '/'].includes(project.pathname)) {
    throw new Error('Usare l’URL HTTPS del progetto Supabase ospitato.');
  }
  if (!isPublishableSupabaseKey(key.trim())) throw new Error('La configurazione client Supabase richiede una chiave publishable o anon; chiavi segrete e service-role non ammesse.');
  return { url: project.origin, key: key.trim() };
}
