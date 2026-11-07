import type{Board}from'../shared/board.js';
import{quoteStatus}from'../shared/board.js';
import{ScoreFeatures,predictScore,type LogisticModel}from'./score-model.js';
export function captureCandidates(board:Board,engine:ScoreFeatures,finished:Set<string>,now:number,report:{model:LogisticModel;temperature:number}){
 if(!Number.isFinite(now)||now-Date.parse(board.checkedAt)>30000||Date.parse(board.checkedAt)>now)throw Error('BOARD_OBSERVATION_STALE');
 const observedAt=new Date(now).toISOString();
const predictions=[];
for(const m of board.matches){
 const kickoff=Date.parse(m.kickoff_utc??'');
 if(m.in_play||finished.has(m.id)||!Number.isFinite(kickoff)||kickoff<now+300000||kickoff>now+48*3600000)continue;
 const f=engine.features(m,now,20);if(!f)continue;
 const pair=m.quotes.filter(q=>q.fixture_id===m.id&&q.group_id==='920000'&&q.market_id==='920000'&&q.line==='To Win'&&(q.side===m.home||q.side===m.away)&&quoteStatus(m,q,now)==='Letta di recente dalla fonte'&&Date.parse(q.ts)<=now);
 if(pair.length!==2||pair.filter(q=>q.side===m.home).length!==1||pair.filter(q=>q.side===m.away).length!==1||pair[0].period!==pair[1].period||pair[0].market_key!==pair[1].market_key)continue;
 const home=pair.find(q=>q.side===m.home)!,away=pair.find(q=>q.side===m.away)!;
 const p=predictScore(report.model,f.x,report.temperature);
 predictions.push({eventId:m.id,league:m.league,home:m.home,away:m.away,scheduledStart:m.kickoff_utc,observedAt,homeProbability:p,eloProbability:f.elo,sampleSize:f.sampleSize,features:f.x,homeOdds:home.odds_dec,awayOdds:away.odds_dec,homeQuoteAt:home.ts,awayQuoteAt:away.ts,sourcePolledAt:m.group_status?.['920000']?.polled_at,marketProbability:(1/home.odds_dec)/(1/home.odds_dec+1/away.odds_dec),status:'pending'});
}
return predictions;
}
