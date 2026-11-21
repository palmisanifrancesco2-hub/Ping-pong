import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { playerKey, type MatchResult } from '../src/domain/player-model.js';
import { isUpcomingOrLive, quoteIdentity, type FeedMatch } from '../src/shared/board.js';
import type { ChoiceForecast, ChoiceModelResult, ChoiceSnapshot, PersonalChoice } from '../src/shared/choices.js';
import { bookmakerWinnerPrices } from '../src/shared/quote-selection.js';
import { liveWinnerEstimate } from './live-winner.js';
import { ensembleSignals, ensembleWinnerEstimate } from './multi-model.js';
import { scoreSignals, scoreWinnerEstimate } from './score-signals.js';
import type { ResultsArchive } from './results.js';

const forecastShape = z.object({
  selection: z.string(), probability: z.number().min(0).max(1), model: z.string(), phase: z.enum(['prematch','live']),
  prices: z.object({fairOdds:z.number().min(1),bet365:z.object({odds:z.number().gt(1),quoteAt:z.iso.datetime({offset:true}),key:z.string()}).nullable()}).optional(),
});
const resultShape = z.object({
  winner: z.string(), sets: z.array(z.tuple([z.number(), z.number()])), finishedAt: z.iso.datetime({offset:true}),
});
export type StoredChoice = Omit<PersonalChoice, 'snapshot'> & {
  snapshot: ChoiceSnapshot & { modelForecast?: ChoiceForecast; forecastSignature?: string; modelResult?: ChoiceModelResult; resultSignature?: string };
};

function withPrices(forecast: ChoiceForecast, match: FeedMatch, snapshot: ChoiceSnapshot, now: number): ChoiceForecast {
  const fairOdds = 1 / forecast.probability;
  if (!Number.isFinite(fairOdds) || fairOdds < 1) return forecast;
  const winnerPrice = snapshot.selection ? undefined
    : bookmakerWinnerPrices(match,now).find(quote=>quote.side===forecast.selection);
  const bet365 = snapshot.selection
    ? {odds:snapshot.selection.odds,quoteAt:snapshot.selection.quoteAt,key:snapshot.selection.key}
    : winnerPrice && winnerPrice.odds_dec>1
      ? {odds:winnerPrice.odds_dec,quoteAt:winnerPrice.ts,key:quoteIdentity(winnerPrice)} : null;
  return {...forecast,prices:{fairOdds,bet365}};
}

export function estimateChoice(match: FeedMatch, snapshot: ChoiceSnapshot, archive: ResultsArchive | undefined, preferEnsemble: boolean, now: number): ChoiceForecast | undefined {
  if (!isUpcomingOrLive(match, now) || archive?.results.some(result=>result.id===match.id)) return;
  if (snapshot.selection) {
    if (!archive || match.in_play) return;
    const signals = preferEnsemble ? ensembleSignals : scoreSignals;
    const forecast = signals(match, archive, now).find(item=>quoteIdentity(item.quote)===snapshot.selection?.key);
    if (forecast?.modelName) return withPrices({selection:forecast.selection,probability:forecast.probability,model:forecast.modelName,phase:'prematch'},match,snapshot,now);
    return;
  }

  const score = match.in_play ? liveWinnerEstimate(match, now) : archive && scoreWinnerEstimate(match, archive, now);
  const ensemble = !match.in_play && archive && ensembleWinnerEstimate(match, archive, now);
  const estimate = preferEnsemble ? ensemble ?? score : score ?? ensemble;
  if (!estimate) return;
  const rounded = Math.round(estimate.homeProbability * 1000);
  if (rounded === 500) return;
  const home = rounded > 500;
  return withPrices({
    selection:home ? match.home : match.away,
    probability:home ? estimate.homeProbability : 1-estimate.homeProbability,
    model:estimate.modelName,
    phase:match.in_play ? 'live' : 'prematch',
  },match,snapshot,now);
}

function signature(key: string, userId: string, choiceKey: string, snapshot: ChoiceSnapshot, forecast: ChoiceForecast, result?: ChoiceModelResult) {
  return createHmac('sha256',key).update(JSON.stringify([
    'personal-choice-v1',userId,choiceKey,snapshot.eventId,snapshot.home,snapshot.away,snapshot.competition,snapshot.observedAt,
    snapshot.startsAt,snapshot.selection?.key,snapshot.selection?.odds,snapshot.selection?.quoteAt,
    forecast.selection,forecast.probability,forecast.model,forecast.phase,
    result && [result.winner,result.sets,result.finishedAt],
    // Preserve signatures issued before prices were stored on the forecast.
    ...(forecast.prices ? [forecast.prices.fairOdds,forecast.prices.bet365?.odds,
      forecast.prices.bet365?.quoteAt,forecast.prices.bet365?.key] : []),
  ])).digest('hex');
}

export function signForecast(key: string, userId: string, choiceKey: string, snapshot: ChoiceSnapshot, forecast: ChoiceForecast) {
  return signature(key,userId,choiceKey,snapshot,forecast);
}

function authentic(expected: string, actual?: string) {
  return typeof actual==='string' && /^[a-f0-9]{64}$/.test(actual) && timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(actual,'hex'));
}

export function readComparison(key: string, userId: string, entry: StoredChoice) {
  const snapshot = entry.snapshot;
  const forecast = forecastShape.safeParse(snapshot.modelForecast);
  if (!forecast.success || snapshot.eventId!==entry.event_source_id ||
    !authentic(signature(key,userId,entry.choice_key,snapshot,forecast.data),snapshot.forecastSignature)) return;
  const result = resultShape.safeParse(snapshot.modelResult);
  return {forecast:forecast.data,result:result.success &&
    authentic(signature(key,userId,entry.choice_key,snapshot,forecast.data,result.data),snapshot.resultSignature) ? result.data : null};
}

export function matchChoiceResult(snapshot: ChoiceSnapshot, result: MatchResult | undefined, now: number): ChoiceModelResult | undefined {
  if (!result || result.id!==snapshot.eventId || Date.parse(result.finishedAt)<=Date.parse(snapshot.observedAt) ||
    Date.parse(result.availableAt)>now || Date.parse(result.finishedAt)>now) return;
  const home = playerKey(snapshot.competition,snapshot.home), away = playerKey(snapshot.competition,snapshot.away);
  const resultHome = playerKey(result.league,result.home), resultAway = playerKey(result.league,result.away);
  const reversed = home===resultAway && away===resultHome;
  if (!reversed && (home!==resultHome || away!==resultAway)) return;
  return {
    winner:result.homeWon!==reversed ? snapshot.home : snapshot.away,
    sets:reversed ? result.sets.map(([a,b])=>[b,a]) : result.sets,
    finishedAt:result.finishedAt,
  };
}

export function settleSnapshot(key: string, userId: string, entry: StoredChoice, forecast: ChoiceForecast, result: ChoiceModelResult) {
  return {...entry.snapshot,modelResult:result,resultSignature:signature(key,userId,entry.choice_key,entry.snapshot,forecast,result)};
}
