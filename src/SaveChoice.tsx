import {useState} from 'react';
import {QuoteComparison} from './QuoteComparison';
import {dateTime} from './shared/format';
import type {PersonalChoice} from './shared/choices';

export function SavedPrices({entry}:{entry:PersonalChoice}) {
  const forecast=entry.comparison?.forecast;
  const price=forecast?.prices ? forecast.prices.bet365 : entry.snapshot.selection;
  return <div className="saved-choice-prices">
    <QuoteComparison odds={price?.odds} probability={forecast?.probability} fairOdds={forecast?.prices?.fairOdds}/>
    <p className="fine">{price ? `Quota Bet365 rilevata il ${dateTime(price.quoteAt)}` : 'Quota Bet365 non registrata'}</p>
  </div>;
}

export function SaveChoice({ token,eventId,quoteKey,expectedOdds,expectedUpdatedAt,modelChoice,expectedForecast }: {token?:string;eventId:string;quoteKey?:string;expectedOdds?:number;expectedUpdatedAt?:string;modelChoice?:'study'|'ensemble';expectedForecast?:{selection:string;probability:number;model?:string}}) {
  const [state,setState]=useState<'idle'|'saving'|'saved'>('idle'); const [error,setError]=useState('');
  const [savedChoice,setSavedChoice]=useState<PersonalChoice>();
  async function save() {
    if(!token)return;setState('saving');setError('');
    try { const response=await fetch('/api/choices',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({eventId,quoteKey,expectedOdds,expectedUpdatedAt,modelChoice,expectedForecast}),signal:AbortSignal.timeout(30_000)});
      if(!response.ok)throw new Error(response.status===409?'Partita, quota o pronostico cambiati. Aggiorna i dati e riprova.':'Salvataggio non disponibile. La scelta non è stata confermata.');
      const saved=await response.json() as PersonalChoice;if(typeof saved.id!=='string'||!saved.snapshot)throw new Error('Salvataggio non confermato. Riprova.');
      setSavedChoice(saved);
      setState('saved');
    } catch(e){setState('idle');setError(e instanceof Error?e.message:'Salvataggio non riuscito.');}
  }
  return <div><button className="text-button" disabled={!token || state!=='idle'} onClick={save}>{state==='saved'?'✓ Salvata nelle mie scelte':state==='saving'?'Salvataggio…':quoteKey?'☆ Scelgo questa selezione':'☆ Segna questa partita'}</button>{savedChoice && <div role="status"><SavedPrices entry={savedChoice}/></div>}{error&&<p role="alert" className="error">{error}</p>}</div>;
}
