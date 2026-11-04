export const HISTORY_PERIODS = [
  ['1', '1 giorno (24 ore)'], ['5', '5 giorni'], ['7', '1 settimana'], ['10', '10 giorni'],
  ['14', '2 settimane'], ['15', '15 giorni'], ['21', '3 settimane'], ['30', '1 mese (30 giorni)'],
  ['60', '2 mesi'], ['90', '3 mesi'], ['120', '4 mesi'], ['150', '5 mesi'], ['180', '6 mesi'],
  ['210', '7 mesi'], ['240', '8 mesi'], ['270', '9 mesi'], ['300', '10 mesi'], ['330', '11 mesi'],
  ['365', '1 anno (365 giorni)'], ['all', 'Storico completo'],
] as const;
export type HistoryPeriod = typeof HISTORY_PERIODS[number][0];
export type OutcomeStatus = 'won' | 'lost' | 'void' | 'pending' | 'unverified';
export const OUTCOME_LABELS: Record<OutcomeStatus, string> = { won: 'Corretta', lost: 'Sbagliata', void: 'Annullata', pending: 'In attesa', unverified: 'Esito da verificare' };
export type HistoryEntry = {
  id: string; predictedAt: string; match: string; competition: string; market: string; selection: string;
  odds: number; probability: number; sampleSize: number; model: string; modelValidated: boolean;
  bookmaker: string; quoteUpdatedAt: string; status: OutcomeStatus; settledAt: string | null;
  result: string | null; resultSource: string | null; theoreticalProfit: number | null;
};
export type HistoryReport = {
  checkedAt: string; from: string | null; to: string; period: HistoryPeriod; page: number; pageSize: number;
  totalRecorded: number; analyzed: number; partial: boolean; filteredCount: number;
  summary: { won: number; lost: number; void: number; pending: number; unverified: number; hitRate: number | null; theoreticalProfit: number | null };
  entries: HistoryEntry[];
};
export function historyWindow(period: string, now: number) {
  if (!HISTORY_PERIODS.some(([v]) => v === period) || !Number.isFinite(now)) throw new Error('INVALID_HISTORY_PERIOD');
  return { period: period as HistoryPeriod, from: period === 'all' ? null : new Date(now - Number(period) * 86_400_000).toISOString(), to: new Date(now).toISOString() };
}
export function summarizeHistory(entries: HistoryEntry[]) {
  const counts = { won: 0, lost: 0, void: 0, pending: 0, unverified: 0 };
  let profit = 0; let settled = 0;
  for (const entry of entries) {
    counts[entry.status]++;
    if (entry.theoreticalProfit !== null) { profit += entry.theoreticalProfit; settled++; }
  }
  return { ...counts, hitRate: counts.won + counts.lost ? counts.won / (counts.won + counts.lost) : null, theoreticalProfit: settled ? profit : null };
}
