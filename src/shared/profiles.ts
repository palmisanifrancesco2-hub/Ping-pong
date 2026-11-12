export type PublicProfile = {
  id: string; name: string; url: string; birthDate: string | null; countries: string[];
};
export type PlayerProfile = {
  requestedName: string; status: 'candidate' | 'not_found' | 'ambiguous' | 'unavailable';
  candidates: PublicProfile[]; checkedAt: string; source: 'Wikidata'; license: 'CC0';
};
export type ProfileReport = { eventId: string; profiles: PlayerProfile[] };
