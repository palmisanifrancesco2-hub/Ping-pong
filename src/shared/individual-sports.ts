import type { FeedMatch, FeedQuote } from './board.js';

export const individualSports = {
  table_tennis: 'Tennistavolo',
  tennis: 'Tennis',
  badminton: 'Badminton',
  darts: 'Freccette',
  snooker: 'Snooker',
  boxing: 'Boxe',
  mma: 'MMA',
} as const;

export type IndividualSport = keyof typeof individualSports;
export type AdditionalSport = Exclude<IndividualSport,'table_tennis'>;
export const additionalSports = Object.keys(individualSports).filter(key=>key!=='table_tennis') as AdditionalSport[];

export type SportEvent = Omit<FeedMatch<AdditionalSport>,'quotes'|'group_status'|'stats'> & { quoteCount:number; winnerPrices:{label:string;odds:number}[] };
export type SportBoard = {sport:AdditionalSport;checkedAt:string;warming:boolean;mainLinesOnly:boolean;events:SportEvent[]};
export type SportDetail = {
  event:SportEvent;
  groups:{key:string;name:string;period?:string;quotes:{quote:FeedQuote;status:string}[]}[];
  stats:{label:string;first:string;second:string}[];
  context:{label:string;value:string}[];
  checkedAt:string;
};
