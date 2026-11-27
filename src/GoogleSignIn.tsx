import{useEffect,useState}from'react';
import type{SupabaseClient}from'@supabase/supabase-js';
import{APP_ORIGIN,googleAvailability,googleSignInOptions,type GoogleAvailability}from'./shared/google-auth';
export function GoogleSignIn({auth,url,publicKey,busy,onBusy,onNotice}:{auth:SupabaseClient|null;url:string;publicKey:string;busy:boolean;onBusy:(v:boolean)=>void;onNotice:(v:string)=>void}){
  const [availability,setAvailability]=useState<GoogleAvailability|null>(null),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
  useEffect(()=>{setAvailability(null);if(!auth){setLoading(false);return;}const c=new AbortController();setLoading(true);
    googleAvailability(url,publicKey,fetch,c.signal).then(setAvailability).catch(()=>{if(!c.signal.aborted)setAvailability(null);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});
    return()=>c.abort();
  },[auth,url,publicKey,revision]);
  async function signIn(){
    if(!auth||availability?.enabled!==true)return;onBusy(true);onNotice('');
    try{
      let options;try{options=googleSignInOptions(window.location.origin,import.meta.env.DEV);}catch{window.location.assign(`${APP_ORIGIN}/`);return;}
      const {error}=await auth.auth.signInWithOAuth(options);
      if(error)onNotice('Accesso Google non riuscito. Verifica che Google sia attivo per questa app o usa email e password.');
    }catch{onNotice('Google non è raggiungibile. Riprova oppure usa email e password.');}
    finally{onBusy(false);}
  }
  return <div className="google-signin"><button type="button" className="google-button" disabled={!auth||busy||loading||availability?.enabled!==true} onClick={signIn}>
    <svg aria-hidden="true" viewBox="0 0 48 48" width="20" height="20"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.86 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.9l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
    {loading?'Verifica Google…':busy?'Accesso in corso…':'Continua con Google'}
  </button>{loading?<p className="fine" role="status">Verifica della disponibilità…</p>:availability?.enabled===true?<p className="fine">{availability.signupEnabled===false?'Accedi con un account già registrato.':'Accedi o crea il tuo account Google.'} L’accesso ai dati richiede comunque l’abilitazione privata.</p>:<><p className="fine" role="status">{availability?.enabled===false?'Accesso Google non ancora attivo per questa app.':'Disponibilità Google non verificabile.'} Puoi usare email e password.</p>{auth&&<button className="text-button" disabled={busy} onClick={()=>setRevision(v=>v+1)}>Ricontrolla Google</button>}</>}
    <div className="login-divider"><span>oppure con email</span></div></div>;
}
