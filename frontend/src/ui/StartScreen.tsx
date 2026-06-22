import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AvailableMap } from '../game/map/availableMaps';
import { getMenuItemClassName, useMenuKeys } from './useMenuKeys';

type StartScreenProps = {
  maps: readonly AvailableMap[];
  menuKeysEnabled?: boolean;
  onLeaveLanguageMenu?: () => void;
  onBack?: () => void;
  onSelectMap?: (map: AvailableMap) => void;
  onShowLeaderboard?: () => void;
} & (
  | {
      mode: 'menu';
      onStart: () => void;
    }
  | {
      mode: 'map-select';
      onStart?: never;
    }
);

export function StartScreen({
  mode,
  maps,
  menuKeysEnabled = true,
  onLeaveLanguageMenu,
  onBack,
  onSelectMap,
  onShowLeaderboard,
  onStart,
}: StartScreenProps) {
  const { t } = useTranslation();

  const mainMenuItems = useMemo(
    () => [
      { id: 'play', onActivate: () => onStart?.() },
      { id: 'leaderboard', onActivate: () => onShowLeaderboard?.() },
    ],
    [onShowLeaderboard, onStart],
  );

  const mapMenuItems = useMemo(
    () => [
      ...maps.map((map) => ({
        id: map.id,
        onActivate: () => onSelectMap?.(map),
      })),
      { id: 'back', onActivate: () => onBack?.() },
    ],
    [maps, onBack, onSelectMap],
  );

  const { isFocused: isMainMenuFocused } = useMenuKeys({
    items: mainMenuItems,
    enabled: mode === 'menu' && menuKeysEnabled,
    onLeaveEnd: onLeaveLanguageMenu,
  });

  const { isFocused: isMapMenuFocused } = useMenuKeys({
    items: mapMenuItems,
    enabled: mode === 'map-select' && menuKeysEnabled,
    onBack,
    onLeaveEnd: onLeaveLanguageMenu,
  });

  if (mode === 'map-select') {
    return (
      <section className="screen menu-screen">
        <div className="panel pixel-panel map-panel">
          <h1>{t('mapSelect.title')}</h1>

          <p className="screen-description">{t('mapSelect.description')}</p>

          <div className="map-grid">
            {maps.map((map, index) => (
              <article
                key={map.id}
                className={getMenuItemClassName('map-card', isMapMenuFocused(index))}
              >
                <span className="map-favorite" aria-hidden="true">
                  *
                </span>

                <h2>{t(`maps.${map.id}`, { defaultValue: map.name })}</h2>

                <button
                  type="button"
                  className="pixel-button primary-button"
                  onClick={() => onSelectMap?.(map)}
                >
                  {t('mapSelect.selectMap')}
                </button>
              </article>
            ))}
          </div>

          <button
            type="button"
            className={getMenuItemClassName('pixel-button ghost-button full-button', isMapMenuFocused(maps.length))}
            onClick={onBack}
          >
            {t('common.backToMenu')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="screen menu-screen">
      <div className="panel pixel-panel main-panel">
        <p className="brand-tag">{t('common.brandTag')}</p>

        <h1>{t('start.title')}</h1>

        <p className="screen-description">{t('start.description')}</p>

        <div className="start-form">
          <button
            type="button"
            className={getMenuItemClassName('pixel-button primary-button', isMainMenuFocused(0))}
            onClick={() => onStart?.()}
          >
            {t('start.play')}
          </button>

          <button
            type="button"
            className={getMenuItemClassName('pixel-button secondary-button', isMainMenuFocused(1))}
            onClick={() => onShowLeaderboard?.()}
          >
            {t('common.leaderboard')}
          </button>
        </div>
      </div>
    </section>
  );
}
