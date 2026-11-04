export function dateTime(value?: string) { return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('it-IT') : 'Non comunicato'; }
