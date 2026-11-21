export function dateTime(value?: string) { return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('it-IT') : 'Non comunicato'; }
export function fairPriceText(price: number | undefined) {
  return price!==undefined && Number.isFinite(price) && price>=1
    ? price.toLocaleString('it-IT', {minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
}
export function fairOddsText(probability: number) { return fairPriceText(1 / probability); }
export function bookmakerOddsText(odds: number | undefined) {
  return odds !== undefined && Number.isFinite(odds) && odds > 1
    ? odds.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:3}) : '—';
}
/** Keep a strictly positive margin from appearing as rounded zero. */
export function positiveEvText(ev:number){return ev>0&&ev<.0005?'>0%':`${ev>0?'+':''}${(ev*100).toFixed(1)}%`;}
