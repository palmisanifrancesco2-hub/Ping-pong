import {bookmakerOddsText,fairOddsText} from './shared/format';

export function QuoteComparison({odds,probability}:{odds?:number;probability?:number}) {
  return <span className="quote-comparison">
    <span><small>Quota Bet365</small><strong>{bookmakerOddsText(odds)}</strong></span>
    <span><small>Quota equa modello</small><strong>{probability===undefined ? '—' : fairOddsText(probability)}</strong></span>
  </span>;
}
