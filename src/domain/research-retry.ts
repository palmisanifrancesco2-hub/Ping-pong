export function retryAfterMs(value:string|null,now:number){
 if(!value)return 0;const seconds=Number(value);
 const delay=Number.isFinite(seconds)?seconds*1000:Date.parse(value)-now;
 return Number.isFinite(delay)?Math.max(0,delay):0;
}
type Options={fetcher:typeof fetch;beforeAttempt:()=>Promise<void>;wait:(ms:number)=>Promise<void>;now:()=>number;onRetry:(info:{attempt:number;delayMs:number;reason:string})=>Promise<void>};
/** Bounded retries for public read-only history calls; never retry authorization errors. */
export async function fetchResearchClosing(url:string,options:Options){
 for(let attempt=1;attempt<=3;attempt++){
  await options.beforeAttempt();let delay=0,reason='NETWORK_OR_TIMEOUT';
  try{
   const response=await options.fetcher(url,{signal:AbortSignal.timeout(60000),redirect:'error',headers:{Accept:'application/json'}});
   if(![429,502,503,504].includes(response.status))return response;
   reason=`HTTP_${response.status}`;delay=retryAfterMs(response.headers.get('retry-after'),options.now());
   await response.body?.cancel();
  }catch(e){if(!(e instanceof TypeError)&&!(e instanceof Error&&['AbortError','TimeoutError'].includes(e.name)))throw e;}
  if(attempt===3)throw Error(`HISTORY_RETRIES_EXHAUSTED_${reason}`);
  delay=Math.max(delay,30000*2**(attempt-1));
  // A long provider cooldown stops the job instead of ignoring Retry-After.
  if(delay>900000)throw Error('HISTORY_LONG_COOLDOWN_REQUIRED');
  await options.onRetry({attempt,delayMs:delay,reason});await options.wait(delay);
 }
 throw Error('HISTORY_RETRIES_EXHAUSTED');
}
