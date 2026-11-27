import {bookmakerOddsText,fairPriceText} from './shared/format';

export function QuoteComparison({odds,probability,fairOdds}:{odds?:number;probability?:number;fairOdds?:number}) {
  return <span className="quote-comparison">
    <span><small>Quota Bet365</small><strong>{bookmakerOddsText(odds)}</strong></span>
    <span><small>Quota equa modello</small><strong>{fairPriceText(fairOdds ?? (probability===undefined ? undefined : 1 / probability))}</strong></span>
  </span>;
}
