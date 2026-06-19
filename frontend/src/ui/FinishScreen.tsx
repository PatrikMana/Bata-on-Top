import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatTimeMs } from './formatTime';
import { getMenuItemClassName, useMenuKeys } from './useMenuKeys';

type FinishScreenProps = {
  playerName: string;
  timeMs: number;
  menuKeysEnabled?: boolean;
  onLeaveLanguageMenu?: () => void;
  onRestart: () => void;
  onShowLeaderboard: () => void;
};

export function FinishScreen({
  playerName,
  timeMs,
  menuKeysEnabled = true,
  onLeaveLanguageMenu,
  onRestart,
  onShowLeaderboard,
}: FinishScreenProps) {
  const { t } = useTranslation();

  const menuItems = useMemo(
    () => [
      { id: 'restart', onActivate: onRestart },
      { id: 'leaderboard', onActivate: onShowLeaderboard },
    ],
    [onRestart, onShowLeaderboard],
  );

  const { isFocused } = useMenuKeys({
    items: menuItems,
    layout: 'horizontal',
    enabled: menuKeysEnabled,
    onLeaveDown: onLeaveLanguageMenu,
  });

  return (
    <section className="screen finish-screen">
      <div className="panel pixel-panel">
        <p className="eyebrow">{t('finish.eyebrow')}</p>

        <h1>{t('finish.title')}</h1>

        <p className="result-name">{playerName}</p>
        <p className="result-time">{formatTimeMs(timeMs)}</p>

        <div className="button-row">
          <button
            type="button"
            className={getMenuItemClassName('pixel-button primary-button', isFocused(0))}
            onClick={onRestart}
          >
            {t('finish.playAgain')}
          </button>

          <button
            type="button"
            className={getMenuItemClassName('pixel-button secondary-button', isFocused(1))}
            onClick={onShowLeaderboard}
          >
            {t('common.leaderboard')}
          </button>
        </div>
      </div>
    </section>
  );
}
