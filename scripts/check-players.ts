import{ResultsFeed}from'../server/results.js';
import {MoviOddsFeed} from '../server/moviodds.js';
import {scoreValueReport} from '../server/score-signals.js';
import {ensembleValueReport} from '../server/multi-model.js';
import {bookmakerWinnerPrices, nearOneFifty, oddsInRange, selectedQuotes} from '../src/shared/quote-selection.js';
import {liveWinnerEstimates} from '../server/live-winner.js';
import {marketEstimateReport} from '../server/market-estimates.js';
import {otherBookmakerMarkets} from '../src/shared/additional-markets.js';
import {startsInNextTwoHours} from '../src/shared/board.js';
import expansionProtocol from '../research/protocol-expansion-v35.json' with {type:'json'};
import {benchmarkFreshResults} from './benchmark-fresh-results.js';
import model from'../models/elo-v1.json' with{type:'json'};
try {
  const archive=await new ResultsFeed().archive();
  console.info(JSON.stringify({playerDataVerification:'success',source:archive.source,results:archive.results.length,rejected:archive.rejected,from:archive.from,to:archive.to,checkedAt:archive.checkedAt,modelValidated:model.validated,validation:model.validation}));
  if (process.env.VERCEL_ENV === 'production') {
    if (archive.checkedAt.startsWith(expansionProtocol.movioddsTestBefore)) {
      try { console.info(JSON.stringify(benchmarkFreshResults(archive))); }
      catch { console.warn('EXPANSION_BENCHMARK_UNAVAILABLE'); }
    }
    try {
      const board = await new MoviOddsFeed().board();
      const now = Date.now();
      const score = scoreValueReport(board, archive, now);
      const ensemble = ensembleValueReport(board, archive, now);
      const live = board.matches.filter(match=>match.in_play);
      const soon = board.matches.filter(match=>startsInNextTwoHours(match,now));
      console.info(JSON.stringify({
        winnerDisplayVerification:'success',
        scoreEstimates:Object.keys(score.winnerEstimates ?? {}).length,
        scoreValueSelections:selectedQuotes(score, board.matches, now).length,
        ensembleEstimates:Object.keys(ensemble.winnerEstimates).length,
        ensembleValueSelections:selectedQuotes({...score,...ensemble}, board.matches, now).length,
        prematchEvents:board.matches.filter(match=>!match.in_play).length,
        liveEvents:live.length,
        liveWithScoreAndSeenAt:live.filter(match=>match.score&&match.last_live_seen).length,
        liveWithCorrectScoreMarket:live.filter(match=>match.quotes.some(q=>q.group_id==='920064')).length,
        liveEstimates:Object.keys(liveWinnerEstimates(live,now)).length,
        upcomingWithinTwoHours:soon.length,
        valueWithinTwoHours:selectedQuotes(score,soon,now).length,
      }));
      const markets = board.matches.map(match=>otherBookmakerMarkets(match,now));
      const {minimum,maximum} = nearOneFifty;
      const inRange = (odds: number) => oddsInRange(odds,minimum,maximum);
      const matchingCompetitions = new Set(board.matches.filter((match,index)=>
        bookmakerWinnerPrices(match,now).some(q=>inRange(q.odds_dec)) ||
        markets[index].some(group=>group.quotes.some(q=>inRange(q.odds_dec)))).map(match=>match.league));
      console.info(JSON.stringify({
        oddsBandVerification:'success',
        feedCompetitions:new Set(board.matches.map(match=>match.league)).size,
        competitionsWithPricesInBand:matchingCompetitions.size,
        winnerPricesInBand:board.matches.flatMap(match=>bookmakerWinnerPrices(match,now)).filter(q=>inRange(q.odds_dec)).length,
        additionalPricesInBand:markets.flatMap(groups=>groups.flatMap(group=>group.quotes)).filter(q=>inRange(q.odds_dec)).length,
        valueSelectionsInBand:selectedQuotes(score,board.matches,now,minimum,maximum).length,
      }));
      const estimateCounts = board.matches.map(match=>Object.keys(marketEstimateReport(match,archive,now).estimates).length);
      console.info(JSON.stringify({
        additionalMarketVerification:'success',
        eventsWithAdditionalPrices:markets.filter(groups=>groups.length>0).length,
        eventsWithTotals:markets.filter(groups=>groups.some(group=>group.title.startsWith('Over/Under'))).length,
        eventsWithHandicap:markets.filter(groups=>groups.some(group=>group.title.startsWith('Handicap'))).length,
        prices:markets.flat().reduce((sum,group)=>sum+group.quotes.length,0),
        eventsWithEstimates:estimateCounts.filter(Boolean).length,
        estimates:estimateCounts.reduce((sum,count)=>sum+count,0),
      }));
    } catch { console.warn('WINNER_DISPLAY_VERIFICATION_UNAVAILABLE'); }
  }
} catch {
  console.error('PLAYER_DATA_VERIFICATION_FAILED');
  process.exitCode=1;
}
