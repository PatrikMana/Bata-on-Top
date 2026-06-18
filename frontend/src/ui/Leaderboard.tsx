import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  return (
    <section className="screen leaderboard-screen">
      <div className="panel pixel-panel leaderboard-panel">
        <h1>{t('leaderboard.title')}</h1>

        <p className="screen-description">{t('leaderboard.description')}</p>

        {errorMessage && <p className="error-message">{errorMessage}</p>}

        {isLoading ? (
          <p className="muted-text">{t('leaderboard.loading')}</p>
        ) : (
          <ol className="leaderboard-list">
            {items.length === 0 && <p className="muted-text">{t('leaderboard.empty')}</p>}

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
            {t('leaderboard.refresh')}
          </button>

          <button type="button" className="pixel-button ghost-button" onClick={onBack}>
            {t('common.backToMenu')}
          </button>
        </div>
      </div>
    </section>
  );
}
