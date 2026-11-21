import{ResultsFeed}from'../server/results.js';
import {MoviOddsFeed} from '../server/moviodds.js';
import {scoreValueReport} from '../server/score-signals.js';
import {ensembleValueReport} from '../server/multi-model.js';
import {selectedQuotes} from '../src/shared/quote-selection.js';
import {liveWinnerEstimates} from '../server/live-winner.js';
import model from'../models/elo-v1.json' with{type:'json'};
try {
  const archive=await new ResultsFeed().archive();
  console.info(JSON.stringify({playerDataVerification:'success',source:archive.source,results:archive.results.length,rejected:archive.rejected,from:archive.from,to:archive.to,checkedAt:archive.checkedAt,modelValidated:model.validated,validation:model.validation}));
  if (process.env.VERCEL_ENV === 'production') {
    try {
      const board = await new MoviOddsFeed().board();
      const now = Date.now();
      const score = scoreValueReport(board, archive, now);
      const ensemble = ensembleValueReport(board, archive, now);
      const live = board.matches.filter(match=>match.in_play);
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
      }));
    } catch { console.warn('WINNER_DISPLAY_VERIFICATION_UNAVAILABLE'); }
  }
} catch {
  console.error('PLAYER_DATA_VERIFICATION_FAILED');
  process.exitCode=1;
}
