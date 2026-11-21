export const COMPETITIONS = ['Czech Liga Pro', 'TT Cup', 'TT Elite Series', 'Challenger Series'] as const;
export type ConnectionReport = {
  provider: 'The Odds API';
  status: 'not_configured' | 'connected' | 'error';
  checkedAt: string;
  message: string;
  sports: { key: string; group: string; title: string; active: boolean }[];
  tableTennisKeys: string[];
  competitions: { name: string; status: 'unverified' | 'not_in_catalog' | 'catalog_match' }[];
  quota: { remaining: number | null; used: number | null; last: number | null } | null;
  adm: 'unverified';
  live: 'unverified';
};
