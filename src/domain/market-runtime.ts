import artifact from '../../models/market-v8-runtime.json' with {type:'json'};
import {MARKET_TARGETS} from './market-context.js';

export const marketRuntimeVersion=artifact.version;
export function predictMarkets(f:{x:number[];baseline:number[];eb:number[]}){
  if(f.x.length!==63||f.baseline.length!==14||f.eb.length!==14||![...f.x,...f.baseline,...f.eb].every(Number.isFinite)||[...f.baseline,...f.eb].some(p=>p<0||p>1))throw Error('MARKET_RUNTIME_INPUT');
  if(JSON.stringify(artifact.targets)!==JSON.stringify(MARKET_TARGETS))throw Error('MARKET_RUNTIME_TARGETS');
  const forest=artifact.forestIndices.map(()=>0);
  for(const tree of artifact.trees){
    let n=0;
    // sklearn converts inference inputs to float32 before traversing trees.
    while(tree.left[n]!==-1)n=Math.fround(f.x[tree.feature[n]])<=tree.threshold[n]?tree.left[n]:tree.right[n];
    tree.value[n].forEach((v,j)=>forest[j]+=v/artifact.trees.length);
  }
  return artifact.targets.map((_,j)=>{
    const w=artifact.weights[j],kind=artifact.selected[j];let raw=f.baseline[j];
    if(kind==='hierarchical-eb')raw=f.eb[j];
    else if(kind==='joint-score-forest'){const index=artifact.forestIndices.indexOf(j);if(index<0)throw Error('MARKET_RUNTIME_FOREST_TARGET');raw=forest[index];}
    else if(w!==0)throw Error('MARKET_RUNTIME_UNSUPPORTED');
    return Math.max(1e-9,Math.min(1-1e-9,f.baseline[j]+w*(raw-f.baseline[j])));
  });
}
