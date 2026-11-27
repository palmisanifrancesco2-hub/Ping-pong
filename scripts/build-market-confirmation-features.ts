import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MarketContext, marketOutcomes, type MarketRow} from '../src/domain/market-context.js';
import {verifiedStart} from '../src/domain/research-source.js';
import type {MatchResult} from '../src/domain/player-model.js';
import protocol from '../research/protocol-v8.json' with {type: 'json'};

// Read the selection first. New outcomes must not inform selection or calibration.
const selectionText = await readFile('.research-data/market-v8-selection.json', 'utf8');
const selection = JSON.parse(selectionText) as {inputHash:string;modelHash:string;protocol:unknown};
const digest = (text:string|Buffer) => createHash('sha256').update(text).digest('hex');
if (digest(await readFile('.research-data/market-v8-frozen.joblib')) !== selection.modelHash || JSON.stringify(selection.protocol)!==JSON.stringify(protocol)) throw Error('FROZEN_SELECTION_CHANGED');
const oldText = await readFile(protocol.historyInput, 'utf8');
if(digest(oldText)!==selection.inputHash) throw Error('FROZEN_HISTORY_CHANGED');
const old = JSON.parse(oldText) as {results:MatchResult[];collectedAt:string};
const sealed = JSON.parse(await readFile('.research-data/market-v8-confirmation/sealed.json','utf8')) as {results:MatchResult[];starts:{id:string;at:number}[];complete:boolean;collectedAt:string};
const context = new MarketContext(), oldIds = new Set(old.results.map(r=>r.id));
for(const m of [...old.results].sort((a,b)=>Date.parse(a.availableAt)-Date.parse(b.availableAt)||a.id.localeCompare(b.id))) context.update(m);
const byId = new Map(sealed.results.map(m=>[m.id,m])), rows:MarketRow[]=[];
for(const s of [...sealed.starts].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id))){
  const m=byId.get(s.id); if(!m||oldIds.has(s.id)||Date.parse(old.collectedAt)>=s.at)throw Error('CONFIRMATION_OVERLAP');
  const closing=JSON.parse(await readFile(`.research-data/market-v8-confirmation/${s.id}.json`,'utf8'));
  if(verifiedStart(closing,m)!==s.at)throw Error('UNVERIFIED_CONFIRMATION_START');
  const f=context.features(m,s.at,protocol.minimumPlayerHistory); if(!f)throw Error('CONFIRMATION_INSUFFICIENT_HISTORY');
  rows.push({id:m.id,at:s.at,available:Date.parse(m.availableAt),featuresAvailable:f.available,league:m.league,x:f.x,baseline:f.baseline,eb:f.eb,y:marketOutcomes(m),sampleSize:f.sampleSize});
}
await writeFile('.research-data/market-v8-confirmation-features.json',JSON.stringify({rows,complete:sealed.complete,sealedAt:sealed.collectedAt,selectionHash:digest(selectionText)}),{mode:0o600,flag:'wx'});
console.info(JSON.stringify({phase:'confirmation_features',rows:rows.length,frozenHistoryOnly:rows.every(r=>r.featuresAvailable<Date.parse(protocol.freshStartInclusive))}));
