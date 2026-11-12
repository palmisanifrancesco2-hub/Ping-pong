import { MoviOddsFeed } from '../server/moviodds.js';
try {
  const board = await new MoviOddsFeed().board();
  console.info(JSON.stringify({ feedVerification: 'success', provider: board.provider, bookmakerSite: board.bookmakerSite,
    checkedAt: board.checkedAt, serverTime: board.serverTime, warming: board.warming,
    matches: board.matches.length, competitions: new Set(board.matches.map(m => m.league)).size,
    marketNames: new Set(board.matches.flatMap(m => m.quotes.map(q => q.group_name || q.group_id))).size,
    quoteEntries: board.matches.reduce((n, m) => n + m.quotes.length, 0), italianPricesVerified: false }));
} catch { console.error('MOVIODDS_FEED_VERIFICATION_FAILED'); process.exitCode = 1; }
