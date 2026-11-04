import {validateSupabaseClientConfig} from './supabase-config';
export const APP_ORIGIN='https://ping-pong-ping-pong3.vercel.app';
export function googleRedirectUrl(origin:string,development=false){
  const u=new URL(origin);
  if(u.username||u.password||u.search||u.hash||u.pathname!=='/')throw new Error('GOOGLE_REDIRECT_INVALID');
  if(u.origin===APP_ORIGIN)return `${u.origin}/`;
  if(development&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)&&['http:','https:'].includes(u.protocol))return `${u.origin}/`;
  throw new Error('GOOGLE_CANONICAL_ORIGIN_REQUIRED');
}
export function googleSignInOptions(origin:string,development=false){
  return {provider:'google' as const,options:{redirectTo:googleRedirectUrl(origin,development),scopes:'openid email profile',queryParams:{prompt:'select_account'}}};
}
export type GoogleAvailability={enabled:boolean|null;signupEnabled:boolean|null;callbackUrl:string};
export async function googleAvailability(url:string,key:string,fetcher:typeof fetch=fetch,signal?:AbortSignal):Promise<GoogleAvailability>{
  const config=validateSupabaseClientConfig(url,key);if(!config)throw new Error('GOOGLE_AUTH_NOT_CONFIGURED');
  const response=await fetcher(`${config.url}/auth/v1/settings`,{headers:{apikey:config.key},cache:'no-store',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('GOOGLE_SETTINGS_UNAVAILABLE');
  const p:unknown=await response.json();
  const settings=p&&typeof p==='object'?p as Record<string,unknown>:{};
  const external=settings.external&&typeof settings.external==='object'?settings.external as Record<string,unknown>:{};
  return{enabled:typeof external.google==='boolean'?external.google:null,signupEnabled:typeof settings.disable_signup==='boolean'?!settings.disable_signup:null,callbackUrl:`${config.url}/auth/v1/callback`};
}
// Display only fixed messages; callback descriptions can contain untrusted text.
export function googleCallbackError(search:string,hash:string):string|null{
  const params=[new URLSearchParams(search),new URLSearchParams(hash.replace(/^#/,''))];
  if(params.some(p=>p.has('error')||p.has('error_code')||p.has('error_description')))return 'Accesso Google annullato o non riuscito. Puoi riprovare oppure accedere con email e password.';
  return null;
}
export function cleanAuthCallbackUrl(href:string){
  const u=new URL(href);
  for(const key of ['code','error','error_code','error_description','error_uri'])u.searchParams.delete(key);
  const hash=new URLSearchParams(u.hash.replace(/^#/,''));
  if(['access_token','refresh_token','error','error_code','error_description'].some(k=>hash.has(k)))u.hash='';
  return u.pathname+u.search+u.hash;
}
