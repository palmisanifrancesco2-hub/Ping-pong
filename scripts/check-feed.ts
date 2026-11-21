import { MoviOddsFeed } from '../server/moviodds.js';
import { bookmakerWinnerPrices } from '../src/shared/quote-selection.js';
try {
  const board = await new MoviOddsFeed().board();
  const now = Date.now();
  const winnerPrices = board.matches.map(match => bookmakerWinnerPrices(match, now).length);
  console.info(JSON.stringify({ feedVerification: 'success', provider: board.provider, bookmakerSite: board.bookmakerSite,
    checkedAt: board.checkedAt, serverTime: board.serverTime, warming: board.warming,
    matches: board.matches.length, competitions: new Set(board.matches.map(m => m.league)).size,
    marketNames: new Set(board.matches.flatMap(m => m.quotes.map(q => q.group_name || q.group_id))).size,
    quoteEntries: board.matches.reduce((n, m) => n + m.quotes.length, 0),
    freshWinnerPrices: winnerPrices.reduce((n, count) => n + count, 0),
    eventsWithWinnerPrices: winnerPrices.filter(Boolean).length, italianPricesVerified: false }));
} catch (error) {
  const code = error instanceof Error && /^MOVIODDS_[A-Z0-9_]+$/.test(error.message) ? error.message : 'UNKNOWN';
  console.error(JSON.stringify({ feedVerification: 'failed', code }));
  process.exitCode = 1;
}
