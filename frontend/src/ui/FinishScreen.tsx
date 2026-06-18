import { useTranslation } from 'react-i18next';
import { formatTimeMs } from './formatTime';

type FinishScreenProps = {
  playerName: string;
  timeMs: number;
  onRestart: () => void;
  onShowLeaderboard: () => void;
};

export function FinishScreen({
  playerName,
  timeMs,
  onRestart,
  onShowLeaderboard,
}: FinishScreenProps) {
  const { t } = useTranslation();

  return (
    <section className="screen finish-screen">
      <div className="panel pixel-panel">
        <p className="eyebrow">{t('finish.eyebrow')}</p>

        <h1>{t('finish.title')}</h1>

        <p className="result-name">{playerName}</p>
        <p className="result-time">{formatTimeMs(timeMs)}</p>

        <div className="button-row">
          <button type="button" className="pixel-button primary-button" onClick={onRestart}>
            {t('finish.playAgain')}
          </button>

          <button type="button" className="pixel-button secondary-button" onClick={onShowLeaderboard}>
            {t('common.leaderboard')}
          </button>
        </div>
      </div>
    </section>
  );
}
