import { X509Certificate } from 'node:crypto';
import { rootCertificates } from 'node:tls';
const SUPABASE_ROOT_FINGERPRINT = '807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA';
export function databaseTls(caPem: string, now = Date.now()) {
  const certificate = new X509Certificate(caPem);
  if (!certificate.ca || certificate.fingerprint256.replace(/:/g,'') !== SUPABASE_ROOT_FINGERPRINT) throw new Error('DB_CA_IDENTITY');
  if (now < Date.parse(certificate.validFrom) || now >= Date.parse(certificate.validTo)) throw new Error('DB_CA_EXPIRED');
  // Adding a trust anchor does not disable normal certificate or hostname checks.
  return { ca: [...rootCertificates,caPem], rejectUnauthorized: true as const };
}
