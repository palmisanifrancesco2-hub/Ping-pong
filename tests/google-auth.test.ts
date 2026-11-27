import{describe,it,expect,vi}from'vitest';
import{createClient}from'@supabase/supabase-js';
import{APP_ORIGIN,cleanAuthCallbackUrl,googleAvailability,googleCallbackError,googleRedirectUrl,googleSignInOptions}from'../src/shared/google-auth';
const url='https://synthetic.supabase.co',key='sb_publishable_SYNTHETIC';
describe('Google OAuth with private membership (synthetic only)',()=>{
  it('uses a fixed same-origin callback and basic identity scopes only',()=>{
    expect(googleSignInOptions(APP_ORIGIN)).toEqual({provider:'google',options:{redirectTo:APP_ORIGIN+'/',scopes:'openid email profile',queryParams:{prompt:'select_account'}}});
    expect(googleRedirectUrl('http://127.0.0.1:5173',true)).toBe('http://127.0.0.1:5173/');
    for(const origin of ['https://evil.example','https://ping-pong-ping-pong3.vercel.app.evil.example','https://user:password@ping-pong-ping-pong3.vercel.app','http://127.0.0.1:5173','https://ping-pong-ping-pong3.vercel.app/?next=https://evil.example'])expect(()=>googleRedirectUrl(origin)).toThrow();
  });
  it('asks the official SDK for a PKCE challenge without putting a client secret in the browser',async()=>{
    const memory=new Map<string,string>();const storage={getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>{memory.set(k,v);},removeItem:(k:string)=>{memory.delete(k);}};
    const client=createClient(url,key,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storage}});
    const opts=googleSignInOptions(APP_ORIGIN);
    const result=await client.auth.signInWithOAuth({...opts,options:{...opts.options,skipBrowserRedirect:true}});
    expect(result.error).toBeNull();const target=new URL(result.data.url!);
    expect(target.origin).toBe(url);expect(target.pathname).toBe('/auth/v1/authorize');expect(target.searchParams.get('provider')).toBe('google');
    expect(target.searchParams.get('redirect_to')).toBe(APP_ORIGIN+'/');expect(target.searchParams.get('code_challenge')).toBeTruthy();
    expect(target.searchParams.get('code_challenge_method')?.toLowerCase()).toBe('s256');expect(target.searchParams.has('client_secret')).toBe(false);
    expect([...memory.keys()].some(k=>k.includes('code-verifier'))).toBe(true);client.auth.stopAutoRefresh();
  });
  it('checks real public provider flags and does not equate missing settings with enabled',async()=>{
    const fetcher=vi.fn(async(input:URL|RequestInfo,init?:RequestInit)=>{expect(String(input)).toBe(url+'/auth/v1/settings');expect(init?.headers).toEqual({apikey:key});expect(init?.redirect).toBe('error');return Response.json({external:{google:true},disable_signup:false});});
    expect(await googleAvailability(url,key,fetcher)).toEqual({enabled:true,signupEnabled:true,callbackUrl:url+'/auth/v1/callback'});
    expect((await googleAvailability(url,key,vi.fn(async()=>Response.json({external:{google:false},disable_signup:true})))).enabled).toBe(false);
    expect((await googleAvailability(url,key,vi.fn(async()=>Response.json({external:{google:'true'}})))).enabled).toBeNull();
  });
  it('rejects private keys before sending settings requests and handles service errors',async()=>{
    const fetcher=vi.fn();await expect(googleAvailability(url,'sb_secret_NOT_PUBLIC',fetcher)).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
    await expect(googleAvailability(url,key,vi.fn(async()=>new Response('private details',{status:500})))).rejects.toThrow('GOOGLE_SETTINGS_UNAVAILABLE');
  });
  it('sanitizes OAuth errors and removes callback credentials after SDK processing',()=>{
    const error=googleCallbackError('?error=access_denied&error_description=untrusted-secret','');expect(error).not.toContain('untrusted-secret');expect(error).toContain('annullato');
    expect(googleCallbackError('?code=synthetic-code','')).toBeNull();
    expect(cleanAuthCallbackUrl(APP_ORIGIN+'/?code=synthetic-code&view=matches#error=denied')).toBe('/?view=matches');
    expect(cleanAuthCallbackUrl(APP_ORIGIN+'/#access_token=synthetic&refresh_token=synthetic')).toBe('/');
  });
});
