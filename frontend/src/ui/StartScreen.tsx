import type { FormEvent } from 'react';
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
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onStart?.();
  }

  if (mode === 'map-select') {
    return (
      <section className="screen menu-screen">
        <div className="panel pixel-panel map-panel">
          <h1>Vyber mapu</h1>

          <p className="screen-description">Zvol věž, na kterou se chceš vyšplhat.</p>

          <div className="map-grid">
            {maps.map((map) => (
              <article key={map.id} className="map-card">
                <span className="map-favorite" aria-hidden="true">
                  *
                </span>

                <h2>{map.name}</h2>

                <button
                  type="button"
                  className="pixel-button primary-button"
                  onClick={() => onSelectMap?.(map)}
                >
                  Vybrat mapu
                </button>
              </article>
            ))}
          </div>

          <button type="button" className="pixel-button ghost-button full-button" onClick={onBack}>
            Zpět do menu
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="screen menu-screen">
      <div className="panel pixel-panel main-panel">
        <p className="brand-tag">Baťa / MDC</p>

        <h1>Baťa on Top</h1>

        <p className="screen-description">
          Vyšvihni Pjota až na vrchol věže a najdi jeho zlaté střevíce.
        </p>

        <form onSubmit={handleSubmit} className="start-form">
          <button type="submit" className="pixel-button primary-button">
            Hrát
          </button>

          <button type="button" className="pixel-button secondary-button" onClick={onShowLeaderboard}>
            Leaderboard
          </button>
        </form>
      </div>
    </section>
  );
}
