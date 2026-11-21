// Both names are private server variables. The alias preserves the Secret
// already configured on Vercel, whose key cannot be renamed in place.
export function oddsApiKey(env: Record<string, string | undefined>) {
  return env.THE_ODDS_API_KEY?.trim() || env.oddsapi?.trim() || undefined;
}
