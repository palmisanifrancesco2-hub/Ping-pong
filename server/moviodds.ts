import { z } from 'zod';
import type { Board } from '../src/shared/board.js';
import { quoteIdentity } from '../src/shared/board.js';
import { MOVIODDS_URL } from './moviodds-discovery.js';

const text = z.string().max(500);
const time = z.iso.datetime({ offset: true });
const quote = z.object({
  fixture_id: text, group_id: text, group_name: text.optional(), market_id: text.optional(),
  market_key: text.optional(), period: text.optional(), sel_id: text,
  label: text.optional(), side: text.optional(), line: text.optional(), handicap: text.optional(), n2: text.optional(),
  odds_dec: z.number().finite().nonnegative(), odds_frac: text.optional(), ts: time,
  suspended: z.boolean().optional(), phase: z.enum(['prematch', 'inplay']).optional(),
});
const schema = z.object({
  server_time: time, warming: z.boolean().optional(),
  matches: z.array(z.object({
    id: text, sport: z.literal('table_tennis'), home: text, away: text, league: text,
    kickoff_utc: time.optional(), in_play: z.boolean(), score: text.optional(), polled_at: time.optional(),
    group_status: z.record(z.string(), z.object({ polled_at: time.optional(), stale: z.boolean().optional() })).optional(),
    quotes: z.array(quote).max(20_000),
  })).max(10_000),
});
export function parseBoard(payload: unknown, checkedAt: string): Board {
  const data = schema.parse(payload);
  const age = Date.parse(time.parse(checkedAt)) - Date.parse(data.server_time);
  if (age > 120_000 || age < -60_000) throw new Error('MOVIODDS_INVALID_TIME');
  const ids = new Set<string>();
  for (const m of data.matches) {
    if (ids.has(m.id)) throw new Error('MOVIODDS_DUPLICATE_EVENT');
    ids.add(m.id);
    const quotes = new Set<string>();
    for (const q of m.quotes) {
      const id = quoteIdentity(q);
      if (q.fixture_id !== m.id || quotes.has(id)) throw new Error('MOVIODDS_AMBIGUOUS_QUOTE');
      quotes.add(id);
    }
  }
  return { provider: 'MoviOdds', bookmakerSite: 'bet365.com.au', checkedAt,
    serverTime: data.server_time, warming: data.warming ?? false, matches: data.matches };
}

export class MoviOddsFeed {
  private cached?: { at: number; board: Board };
  private pending?: Promise<Board>;
  private failedAt?: number;
  constructor(private fetcher: typeof fetch = fetch, private now: () => number = Date.now) {}
  async board(): Promise<Board> {
    if (this.cached && this.now() - this.cached.at < 30_000) return this.cached.board;
    if (this.failedAt !== undefined && this.now() - this.failedAt < 30_000) throw new Error('MOVIODDS_COOLDOWN');
    if (this.pending) return this.pending;
    this.pending = this.read();
    try { return await this.pending; } finally { this.pending = undefined; }
  }
  private async read(): Promise<Board> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await this.fetcher(MOVIODDS_URL, {
        signal: controller.signal, redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json' },
      });
      if (!response.ok || !response.body) throw new Error('upstream');
      // Bound the decompressed payload below the Vercel response size limit.
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 3_500_000) throw new Error('size');
          chunks.push(chunk.value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      const board = parseBoard(JSON.parse(Buffer.concat(chunks).toString('utf8')), new Date(this.now()).toISOString());
      this.cached = { at: this.now(), board }; this.failedAt = undefined;
      return board;
    } catch {
      this.cached = undefined; this.failedAt = this.now();
      throw new Error('MOVIODDS_UNAVAILABLE');
    } finally { clearTimeout(timer); controller.abort(); }
  }
}
