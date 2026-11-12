export type ChoiceSnapshot = {
  source: 'MoviOdds'; site: 'bet365.com.au'; eventId: string; home: string; away: string; competition: string;
  startsAt: string | null; observedAt: string; selection: null | {
    label: string; market: string; period: string | null; line: string | null; handicap: string | null;
    key: string; odds: number; quoteAt: string;
  };
};
export type PersonalChoice = { id: string; event_source_id: string; choice_key: string; snapshot: ChoiceSnapshot; saved_at: string;
  notes: string; manual_status: 'won' | 'lost' | 'void' | 'pending'; manual_settled_at: string | null };
export type ChoicesReport = { entries: PersonalChoice[]; total: number; from: string | null; to: string; page: number; pageSize: number };
