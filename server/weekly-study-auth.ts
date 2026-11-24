import { createPublicKey, verify, type JsonWebKey } from 'node:crypto';

const issuer='https://token.actions.githubusercontent.com';
export const weeklyAudience='ping-pong-analytics:weekly-table-tennis';
export const weeklyStart=Date.parse('2026-11-24T15:00:00Z');
export const weeklyEnd=Date.parse('2026-12-01T16:00:00Z');
export const weeklyFollowup=weeklyEnd+48*3600_000;
const workflow='palmisanifrancesco2-hub/Ping-pong/.github/workflows/ping-pong-weekly.yml@refs/heads/main';

type Claims={iss?:unknown;aud?:unknown;exp?:unknown;nbf?:unknown;iat?:unknown;repository_id?:unknown;workflow_ref?:unknown;ref?:unknown;event_name?:unknown};
export function weeklyClaims(claims:Claims,at:number){
  const now=Math.floor(at/1000),{exp,nbf,iat}=claims;
  return claims.iss===issuer&&claims.aud===weeklyAudience&&claims.repository_id==='1445465539'
    &&claims.workflow_ref===workflow&&claims.ref==='refs/heads/main'
    &&(claims.event_name==='schedule'||claims.event_name==='workflow_dispatch')
    &&typeof exp==='number'&&typeof nbf==='number'&&typeof iat==='number'
    &&Number.isInteger(exp)&&Number.isInteger(nbf)&&Number.isInteger(iat)
    &&exp>now&&nbf<=now+15&&iat<=now+15&&iat>=now-600&&exp-iat>0&&exp-iat<=600;
}

export async function authorizedWeeklyStudy(header:string|undefined,at:number,fetcher=fetch){
  const token=/^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/.exec(header??'')?.[1];
  if(!token||token.length>12000)return false;
  try{
    const [head,body,sig]=token.split('.');
    const jose=JSON.parse(Buffer.from(head,'base64url').toString());
    const claims=JSON.parse(Buffer.from(body,'base64url').toString());
    if(jose.alg!=='RS256'||typeof jose.kid!=='string'||!weeklyClaims(claims,at))return false;
    const response=await fetcher(`${issuer}/.well-known/jwks`,{redirect:'error',signal:AbortSignal.timeout(4000)});
    if(!response.ok)return false;
    const {keys}=await response.json() as {keys:(JsonWebKey&{kid?:string})[]};
    const jwk=keys.find(key=>key.kid===jose.kid&&key.kty==='RSA'&&key.use==='sig'&&key.alg==='RS256');
    return !!jwk&&verify('RSA-SHA256',Buffer.from(`${head}.${body}`),createPublicKey({key:jwk,format:'jwk'}),Buffer.from(sig,'base64url'));
  }catch{return false;}
}
