import { Markets } from './Markets';
import { useBoard } from './useBoard';
export function ValueTracker({ token, demo, onMarkets }: { token?: string; demo: boolean; onMarkets: () => void }) {
  const feed = useBoard(token, !demo && !!token);
  return <>{feed.error && <p role="alert" className="error">{feed.error}</p>}<Markets board={feed.board} now={feed.now} token={demo ? undefined : token} refreshBoard={feed.refresh} boardLoading={feed.loading} tracker/><button className="text-button" onClick={onMarkets}>Consulta eventi e giocatori →</button></>;
}
