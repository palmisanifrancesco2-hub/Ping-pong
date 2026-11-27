import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { databaseClientConfig } from '../server/database-client';
const ca=readFileSync(new URL('../certs/supabase-ca-2021.crt',import.meta.url),'utf8');
const env={ SUPABASE_URL:'https://synthetic.supabase.co',POSTGRES_URL:'postgresql://postgres.synthetic:TEST_PASSWORD@aws-0-test.pooler.supabase.com:6543/postgres?sslmode=no-verify' };
describe('database target and TLS options',()=>{
  it('removes insecure URI SSL overrides and requires full certificate verification',()=>{
    const config=databaseClientConfig(env,ca);
    expect(new URL(config.connectionString!).searchParams.has('sslmode')).toBe(false);
    expect(config.ssl).toMatchObject({ rejectUnauthorized:true });
  });
  it('rejects mismatched project credentials before opening a connection',()=>{
    expect(()=>databaseClientConfig({ ...env,SUPABASE_URL:'https://different.supabase.co' },ca)).toThrow('DB_PROJECT_MISMATCH');
  });
  it('rejects unrelated database hosts and missing configuration',()=>{
    expect(()=>databaseClientConfig({ ...env,POSTGRES_URL:'postgresql://postgres.synthetic:TEST_PASSWORD@evil.test/db' },ca)).toThrow('DB_TARGET');
    expect(()=>databaseClientConfig({},ca)).toThrow('DB_CONFIG');
  });
});
