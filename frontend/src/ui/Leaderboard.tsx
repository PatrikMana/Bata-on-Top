import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { LeaderboardItem } from '../api/leaderboardApi';
import type { AvailableMap } from '../game/map/availableMaps';
import { formatTimeMs } from './formatTime';
import { getMenuItemClassName, useMenuKeys } from './useMenuKeys';

type LeaderboardProps = {
  items: LeaderboardItem[];
  maps: readonly AvailableMap[];
  selectedMap: AvailableMap;
  isLoading: boolean;
  errorMessage?: string;
  menuKeysEnabled?: boolean;
  onLeaveLanguageMenu?: () => void;
  onSelectMap: (map: AvailableMap) => void;
  onRefresh: () => void;
  onBack: () => void;
};

export function Leaderboard({
  items,
  maps,
  selectedMap,
  isLoading,
  errorMessage,
  menuKeysEnabled = true,
  onLeaveLanguageMenu,
  onSelectMap,
  onRefresh,
  onBack,
}: LeaderboardProps) {
  const { t } = useTranslation();

  const menuItems = useMemo(
    () => [
      { id: 'refresh', onActivate: onRefresh, disabled: isLoading },
      { id: 'back', onActivate: onBack },
    ],
    [isLoading, onBack, onRefresh],
  );

  const { isFocused } = useMenuKeys({
    items: menuItems,
    layout: 'horizontal',
    enabled: menuKeysEnabled,
    onBack,
    onLeaveDown: onLeaveLanguageMenu,
  });

  return (
    <section className="screen leaderboard-screen">
      <div className="panel pixel-panel leaderboard-panel">
        <h1>{t('leaderboard.title')}</h1>

        <p className="screen-description">{t('leaderboard.description')}</p>

        <div className="leaderboard-map-tabs" aria-label={t('leaderboard.categoryLabel')}>
          {maps.map((map) => (
            <button
              key={map.id}
              type="button"
              className={`leaderboard-map-tab ${selectedMap.id === map.id ? 'active' : ''}`}
              onClick={() => onSelectMap(map)}
            >
              {map.name}
            </button>
          ))}
        </div>

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
          <button
            type="button"
            className={getMenuItemClassName('pixel-button primary-button', isFocused(0))}
            onClick={onRefresh}
            disabled={isLoading}
          >
            {t('leaderboard.refresh')}
          </button>

          <button
            type="button"
            className={getMenuItemClassName('pixel-button ghost-button', isFocused(1))}
            onClick={onBack}
          >
            {t('common.backToMenu')}
          </button>
        </div>
      </div>
    </section>
  );
}
