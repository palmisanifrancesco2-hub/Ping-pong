export function dateTime(value?: string) { return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('it-IT') : 'Non comunicato'; }
export function fairOddsText(probability: number) {
  const price = 1 / probability;
  return probability > 0 && probability <= 1 && Number.isFinite(price)
    ? price.toLocaleString('it-IT', {minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
}
/** Keep a strictly positive margin from appearing as rounded zero. */
export function positiveEvText(ev:number){return ev>0&&ev<.0005?'>0%':`${ev>0?'+':''}${(ev*100).toFixed(1)}%`;}
