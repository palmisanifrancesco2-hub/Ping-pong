import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { databaseTls } from '../server/database-tls';
const ca = readFileSync(new URL('../certs/supabase-ca-2021.crt',import.meta.url),'utf8');
describe('Supabase database certificate verification', () => {
  it('adds the pinned public Supabase CA without weakening TLS verification', () => {
    const config = databaseTls(ca,Date.parse('2026-11-04T12:00:00Z'));
    expect(config.rejectUnauthorized).toBe(true);
    expect(config.ca).toContain(ca);
    expect(config).not.toHaveProperty('checkServerIdentity');
  });
  it('refuses a malformed trust anchor', () => expect(() => databaseTls('not a certificate')).toThrow());
  it('refuses expired or not-yet-valid trust anchors', () => {
    expect(() => databaseTls(ca,Date.parse('2040-01-01T00:00:00Z'))).toThrow('DB_CA_EXPIRED');
    expect(() => databaseTls(ca,Date.parse('2020-01-01T00:00:00Z'))).toThrow('DB_CA_EXPIRED');
  });
});
