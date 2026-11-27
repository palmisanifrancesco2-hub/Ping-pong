import artifact from '../models/live-score-only-v29.json' with {type:'json'};
import {isFreshLive, type FeedMatch} from '../src/shared/board.js';
import {hasBestOfFiveMarket} from '../src/shared/additional-markets.js';
import type {WinnerEstimate} from '../src/shared/value.js';

const probabilities: Readonly<Record<string,number>> = artifact.probabilities;

function completedSetScore(score:string) {
  let home = 0, away = 0;
  const sets = score.split(',');
  for (const [index, points] of sets.entries()) {
    const pair = /^(\d{1,3})\s*-\s*(\d{1,3})$/.exec(points.trim());
    if (!pair) return;
    const a = Number(pair[1]), b = Number(pair[2]);
    const high = Math.max(a,b), low = Math.min(a,b);
    if (high < 11 || high-low < 2) {
      if (index !== sets.length-1) return;
      break;
    }
    if (high > 11 && high-low !== 2) return;
    if (a>b) home++; else away++;
  }
  if (home+away > 0 && home<3 && away<3) return `${home}-${away}`;
}

export function liveWinnerEstimate(match:FeedMatch,now:number):WinnerEstimate|undefined {
  const age = now-Date.parse(match.last_live_seen ?? '');
  if (!isFreshLive(match,now) || !match.score || !Number.isFinite(age) || age<0 || age>60_000
    || !artifact.leagues.includes(match.league)) return;
  // A current final match score market must identify three sets as the winning total.
  if (!hasBestOfFiveMarket(match,now)) return;
  const state = completedSetScore(match.score);
  if (!state || !Object.hasOwn(probabilities,state)) return;
  return {homeProbability:probabilities[state], modelName:'Frequenze storiche per punteggio · v29',
    liveScore:match.score, completedSetScore:state};
}

export function liveWinnerEstimates(matches:FeedMatch[], now:number):Record<string,WinnerEstimate> {
  return Object.fromEntries(matches.flatMap(match=>{
    const estimate=liveWinnerEstimate(match,now);
    return estimate?[[match.id,estimate]]:[];
  }));
}
