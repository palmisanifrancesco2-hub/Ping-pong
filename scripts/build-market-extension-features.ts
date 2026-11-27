import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MarketContext,marketOutcomes} from '../src/domain/market-context.js';
import {verifiedStart} from '../src/domain/research-source.js';
import type {MatchResult} from '../src/domain/player-model.js';
import protocol from '../research/protocol-v8-extension.json' with {type:'json'};
const selectionText=await readFile('.research-data/market-v8-selection.json','utf8'),selection=JSON.parse(selectionText) as {inputHash:string;modelHash:string};
const hash=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex'),oldText=await readFile(protocol.historyInput,'utf8');
if(hash(oldText)!==selection.inputHash||hash(await readFile('.research-data/market-v8-frozen.joblib'))!==selection.modelHash)throw Error('FROZEN_MARKET_MODEL_CHANGED');
const old=JSON.parse(oldText) as {results:MatchResult[]};
const sealed=JSON.parse(await readFile('.research-data/market-v8-extension/sealed.json','utf8')) as {starts:{id:string;at:number}[];results:MatchResult[]};
const byId=new Map(sealed.results.map(m=>[m.id,m])),context=new MarketContext();
for(const m of [...old.results].sort((a,b)=>Date.parse(a.availableAt)-Date.parse(b.availableAt)||a.id.localeCompare(b.id)))context.update(m);
const rows=[];
for(const s of sealed.starts){
  const m=byId.get(s.id);if(!m||s.at<Date.parse(protocol.freshStartInclusive)||s.at>=Date.parse(protocol.freshCollectionEndExclusive))throw Error('EXTENSION_WINDOW_INVALID');
  const payload=JSON.parse(await readFile(`.research-data/market-v8-extension/${s.id}.json`,'utf8'));if(verifiedStart(payload,m)!==s.at)throw Error('EXTENSION_START_INVALID');
  const f=context.features(m,s.at,protocol.minimumPlayerHistory);if(!f)throw Error('EXTENSION_HISTORY_INVALID');
  rows.push({id:m.id,at:s.at,featuresAvailable:f.available,x:f.x,baseline:f.baseline,eb:f.eb,y:marketOutcomes(m)});
}
await writeFile('.research-data/market-v8-extension-features.json',JSON.stringify({protocol,selectionHash:hash(selectionText),rows}),{mode:0o600,flag:'wx'});
console.info(JSON.stringify({extensionRows:rows.length,frozenHistoryOnly:true}));
