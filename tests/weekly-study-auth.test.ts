import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { authorizedWeeklyStudy, weeklyAudience } from '../server/weekly-study-auth';

const now=Date.parse('2026-11-25T12:00:00Z');
const unix=now/1000;
const claims={iss:'https://token.actions.githubusercontent.com',aud:weeklyAudience,
  repository_id:'1445465539',workflow_ref:'palmisanifrancesco2-hub/Ping-pong/.github/workflows/ping-pong-weekly.yml@refs/heads/main',
  ref:'refs/heads/main',event_name:'schedule',exp:unix+300,nbf:unix,iat:unix};
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const fetchKeys=()=>vi.fn(async()=>Response.json({keys:[{...publicKey.export({format:'jwk'}),alg:'RS256',use:'sig',kid:'test'}]}));
const encoded=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
function token(payload:typeof claims=claims,valid=true){
  const body=`${encoded({alg:'RS256',kid:'test'})}.${encoded(payload)}`;
  return `Bearer ${body}.${sign('RSA-SHA256',Buffer.from(valid?body:body+'.bad'),privateKey).toString('base64url')}`;
}

describe('weekly GitHub Actions authorization',()=>{
  it('accepts a signed token for the exact repository, workflow and audience',async()=>{
    const keys=fetchKeys();
    await expect(authorizedWeeklyStudy(token(),now,keys)).resolves.toBe(true);
    expect(keys).toHaveBeenCalledWith('https://token.actions.githubusercontent.com/.well-known/jwks',expect.objectContaining({redirect:'error'}));
  });
  it('rejects unrelated, expired or forged tokens',async()=>{
    const keys=fetchKeys();
    for(const patch of [{aud:'different'},{repository_id:'123'},{event_name:'pull_request'},{ref:'refs/heads/next'},
      {workflow_ref:'different'},{exp:unix-1}]){
      await expect(authorizedWeeklyStudy(token({...claims,...patch}),now,keys)).resolves.toBe(false);
    }
    expect(keys).not.toHaveBeenCalled();
    await expect(authorizedWeeklyStudy(token(claims,false),now,keys)).resolves.toBe(false);
  });
});
