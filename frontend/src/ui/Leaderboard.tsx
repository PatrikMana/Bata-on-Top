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
      <div className="panel pixel-panel leaderboard-panel">
        <h1>Leaderboard</h1>

        <p className="screen-description">Nejrychlejší výstupy na vrchol.</p>

        {errorMessage && <p className="error-message">{errorMessage}</p>}

        {isLoading ? (
          <p className="muted-text">Načítám leaderboard...</p>
        ) : (
          <ol className="leaderboard-list">
            {items.length === 0 && <p className="muted-text">Zatím tu nejsou žádné výsledky.</p>}

            {items.map((item) => (
              <li key={item.id} className="leaderboard-item">
                <span>{item.playerName}</span>
                <strong>{formatTimeMs(item.timeMs)}</strong>
              </li>
            ))}
          </ol>
        )}

        <div className="button-row">
          <button type="button" className="pixel-button primary-button" onClick={onRefresh}>
            Obnovit
          </button>

          <button type="button" className="pixel-button ghost-button" onClick={onBack}>
            Zpět do menu
          </button>
        </div>
      </div>
    </section>
  );
}
