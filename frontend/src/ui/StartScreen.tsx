import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { AvailableMap } from '../game/map/availableMaps';

type StartScreenProps = {
  maps: readonly AvailableMap[];
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
  onBack,
  onSelectMap,
  onShowLeaderboard,
  onStart,
}: StartScreenProps) {
  const { t } = useTranslation();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onStart?.();
  }

  if (mode === 'map-select') {
    return (
      <section className="screen menu-screen">
        <div className="panel pixel-panel map-panel">
          <h1>{t('mapSelect.title')}</h1>

          <p className="screen-description">{t('mapSelect.description')}</p>

          <div className="map-grid">
            {maps.map((map) => (
              <article key={map.id} className="map-card">
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

          <button type="button" className="pixel-button ghost-button full-button" onClick={onBack}>
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

        <form onSubmit={handleSubmit} className="start-form">
          <button type="submit" className="pixel-button primary-button">
            {t('start.play')}
          </button>

          <button type="button" className="pixel-button secondary-button" onClick={onShowLeaderboard}>
            {t('common.leaderboard')}
          </button>
        </form>
      </div>
    </section>
  );
}
