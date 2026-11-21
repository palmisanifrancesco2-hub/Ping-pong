import{useEffect,useState}from'react';
type Status='checking'|'allowed'|'denied'|'error';
export function usePrivateAccess(token:string|undefined,enabled:boolean){
  const[state,setState]=useState<{token:string;status:Status}|null>(null),[revision,setRevision]=useState(0);
  useEffect(()=>{if(!token||!enabled){setState(null);return;}let active=true;const c=new AbortController();setState({token,status:'checking'});
    fetch('/api/access',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.any([c.signal,AbortSignal.timeout(20000)])})
      .then(async r=>{const status:Status=r.ok?((await r.json() as {authorized?:unknown}).authorized===true?'allowed':'error'):r.status===401||r.status===403?'denied':'error';if(active)setState({token,status});})
      .catch(()=>{if(active)setState({token,status:'error'});});
    return()=>{active=false;c.abort();};
  },[token,enabled,revision]);
  return{status:token&&enabled?(state?.token===token?state.status:'checking'):'checking',retry:()=>setRevision(v=>v+1)};
}
