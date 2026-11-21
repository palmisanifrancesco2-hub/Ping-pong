import type { Env } from './auth.js';
import { MoviOddsFeed } from './moviodds.js';
import { marketIdentity, marketName, quoteStatus, type FeedMatch,type FeedQuote } from '../src/shared/board.js';
import { additionalSports, type AdditionalSport, type SportBoard, type SportDetail, type SportEvent } from '../src/shared/individual-sports.js';

const pairs = /\/|\s&\s|\s\+\s/;
const teamEvents = /\b(?:doubles|mixed doubles|team|teams)\b/i;
export function singles(match: FeedMatch<AdditionalSport>) {
  return !teamEvents.test(match.league) && !pairs.test(match.home) && !pairs.test(match.away);
}

function priceStatus(match:FeedMatch<AdditionalSport>,quote:FeedQuote,now:number) {
  if (Date.parse(quote.ts)>now) return 'Orario quota da verificare';
  if (!match.in_play && quote.phase==='inplay') return 'Quota live archiviata';
  return quoteStatus(match,quote,now);
}

function summary(match: FeedMatch<AdditionalSport>,now:number): SportEvent {
  const {quotes,group_status,stats,...event} = match;
  const candidates=quotes.filter(quote => {
    const winnerGroup=match.sport==='tennis' ? quote.group_id===(match.in_play?'67':'83')
      : /^(?:match winner|to win match|to win fight)$/i.test(quote.group_name??'') || (quote.group_name==='Fight Lines'&&quote.line==='To Win');
    return winnerGroup && priceStatus(match,quote,now)==='Letta di recente dalla fonte';
  });
  const winnerPrices=candidates.length===2 && marketIdentity(candidates[0])===marketIdentity(candidates[1])
    ? candidates.map(quote=>({label:quote.side||quote.label||quote.sel_id,odds:quote.odds_dec})) : [];
  return {...event,quoteCount:quotes.length,winnerPrices};
}

const metrics = {
  tennis:{aces:'Ace',double_faults:'Doppi falli',first_serve_win_pct:'Punti vinti con la prima (%)',
    break_point_conversion_pct:'Palle break convertite (%)',games:'Game',point:'Punto',sets:'Game per set',serving:'Al servizio'},
  darts:{legs:'Leg',one_eighties:'180',three_dart_average:'Media a tre freccette',checkout_pct:'Chiusure (%)',high_checkout:'Chiusura più alta',
    scores_100_plus:'100 o più',scores_140_plus:'140 o più',scores_170_plus:'170 o più',leg_remaining:'Punti rimanenti nel leg'},
} as const;
function stat(value:unknown) {
  if (typeof value==='boolean') return value ? 'Sì' : 'No';
  if (typeof value==='number' && Number.isFinite(value)) return value.toLocaleString('it-IT');
  if (typeof value==='string' && value.length<=30) return value;
  if (Array.isArray(value) && value.length<=7 && value.every(item=>typeof item==='number'&&Number.isFinite(item))) return value.join(' · ');
  return '—';
}

export function sportDetail(match: FeedMatch<AdditionalSport>, checkedAt:string, now:number):SportDetail {
  const groups = new Map<string,SportDetail['groups'][number]>();
  for (const quote of match.quotes) {
    const key = marketIdentity(quote);
    let group = groups.get(key);
    if (!group) {
      group = {key,name:marketName(quote),period:quote.period,quotes:[]};
      groups.set(key,group);
    }
    const status=priceStatus(match,quote,now);
    group.quotes.push({quote,status});
  }
  const labels = match.sport==='tennis'||match.sport==='darts' ? Object.entries(metrics[match.sport]) : [];
  const stats = match.in_play && match.stats?.sport===match.sport ? labels.flatMap(([key,label])=>{
    const first=stat(match.stats?.home?.[key]), second=stat(match.stats?.away?.[key]);
    return first==='—'&&second==='—' ? [] : [{label,first,second}];
  }) : [];
  const context=match.in_play&&match.stats?.sport===match.sport
    ? [{label:'Superficie',value:stat(match.stats.surface)},{label:'Formato',value:stat(match.stats.format)},
      {label:'Set in corso',value:stat(match.stats.current_set)}].filter(field=>field.value!=='—') : [];
  return {event:summary(match,now),groups:[...groups.values()],stats,context,checkedAt};
}

export class IndividualSports {
  private feeds: Map<AdditionalSport,MoviOddsFeed<AdditionalSport>>;
  constructor(env:Env,private now=Date.now,fetcher:typeof fetch=fetch) {
    this.feeds = new Map(additionalSports.map(sport=>[sport,new MoviOddsFeed(fetcher,now,env,sport)]));
  }
  async board(sport:AdditionalSport):Promise<SportBoard> {
    const board = await this.feeds.get(sport)!.board();
    return {sport,checkedAt:board.checkedAt,warming:board.warming,mainLinesOnly:board.mainLinesOnly===true,
      events:board.matches.filter(singles).map(match=>summary(match,this.now()))};
  }
  async event(sport:AdditionalSport,id:string):Promise<SportDetail|undefined> {
    const board = await this.feeds.get(sport)!.board();
    const match = board.matches.find(match=>match.id===id&&singles(match));
    if (match) return sportDetail(match,board.checkedAt,this.now());
  }
}
