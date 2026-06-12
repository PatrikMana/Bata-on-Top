import type { LeaderboardItem } from '../api/leaderboardApi';
import { formatTimeMs } from './formatTime';

type LeaderboardProps = {
  items: LeaderboardItem[];
  isLoading: boolean;
  errorMessage?: string;
  onRefresh: () => void;
  onBack: () => void;
};

export function Leaderboard({
  items,
  isLoading,
  errorMessage,
  onRefresh,
  onBack,
}: LeaderboardProps) {
  return (
    <section className="screen leaderboard-screen">
      <div className="panel">
        <p className="eyebrow">Nejlepší časy</p>

        <h1>Leaderboard</h1>

        {errorMessage && <p className="error-message">{errorMessage}</p>}

        {isLoading ? (
          <p>Načítám leaderboard...</p>
        ) : (
          <ol className="leaderboard-list">
            {items.length === 0 && <p>Zatím tu nejsou žádné výsledky.</p>}

            {items.map((item) => (
              <li key={item.id} className="leaderboard-item">
                <span>{item.playerName}</span>
                <strong>{formatTimeMs(item.timeMs)}</strong>
              </li>
            ))}
          </ol>
        )}

        <div className="button-row">
          <button type="button" onClick={onRefresh}>
            Obnovit
          </button>

          <button type="button" className="secondary-button" onClick={onBack}>
            Zpět
          </button>
        </div>
      </div>
    </section>
  );
}