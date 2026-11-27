import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MARKET_TARGETS,type MarketRow} from '../src/domain/market-context.js';
import {predictMarkets} from '../src/domain/market-runtime.js';
import type {MatchResult} from '../src/domain/player-model.js';
import {verifiedStart} from '../src/domain/research-source.js';
import {archivedPricingPairs,isSetka} from '../server/pricing-study.js';

const dir='.research-data/market-v8-confirmation';
const [features,sealed]=await Promise.all([
  readFile(dir+'-features.json','utf8'),readFile(dir+'/sealed.json','utf8'),
]);
const {rows,complete}=JSON.parse(features) as {rows:MarketRow[];complete:boolean};
const {results}=JSON.parse(sealed) as {results:MatchResult[]};
const byId=new Map(results.map(r=>[r.id,r]));
const samples=[];
const counted=new Set<string>();
let setka=0;
const archivedCoverage=new Map<string,number>();
for(const r of rows){
  const match=byId.get(r.id);
  if(!match||counted.has(r.id)||r.featuresAvailable>=r.at||!(r.at<Date.parse(match.finishedAt)))throw Error('CONFIRMATION_INTEGRITY');
  counted.add(r.id);
  if(!isSetka(match.league))continue;
  setka++;
  const payload=JSON.parse(await readFile(dir+'/'+r.id+'.json','utf8'));
  if(verifiedStart(payload,match)!==r.at)throw Error('UNVERIFIED_START');
  const prices=archivedPricingPairs(payload,{...match,sport:'table_tennis',in_play:false,quotes:[]},r.at);
  for(const target of new Set(prices.map(pair=>pair.target)))archivedCoverage.set(target,(archivedCoverage.get(target)??0)+1);
  const p=predictMarkets(r);
  for(const target of MARKET_TARGETS){
    const matches=prices.filter(price=>price.target===target);
    if(matches.length!==1)continue;
    const pair=matches[0],index=MARKET_TARGETS.indexOf(target);
    samples.push({target,day:Math.floor(r.at/86_400_000)+719163,priceTimestamp:pair.prices.map(q=>q.quotedAt),
      prices:pair.prices.map(q=>q.odds),outcome:r.y[index],sports:p[index]});
  }
}
const path=process.argv[2];
if(!path)throw Error('OUTPUT_REQUIRED');
await writeFile(path,JSON.stringify({setka,complete,fixtures:rows.length,archivedCoverage:Object.fromEntries([...archivedCoverage].sort()),sourceSha256:createHash('sha256').update(features).update(sealed).digest('hex'),samples}),{mode:0o600});
console.info(JSON.stringify({fixtures:rows.length,setka,exactPairs:samples.length}));
