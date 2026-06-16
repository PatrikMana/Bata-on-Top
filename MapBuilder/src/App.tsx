import { type FormEvent, useEffect, useState } from 'react';

type Screen = 'menu' | 'create' | 'edit' | 'editor';

type BuilderMap = {
  id: string;
  name: string;
};

async function fetchMaps() {
  const response = await fetch('/api/maps');

  if (!response.ok) {
    throw new Error('Mapy se nepodarilo nacist.');
  }

  const data = (await response.json()) as { maps: BuilderMap[] };

  return data.maps;
}

async function createMap(name: string) {
  const response = await fetch('/api/maps', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
  const data = (await response.json()) as BuilderMap | { message?: string };

  if (!response.ok) {
    throw new Error('message' in data && data.message ? data.message : 'Mapu se nepodarilo vytvorit.');
  }

  return data as BuilderMap;
}

function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [maps, setMaps] = useState<BuilderMap[]>([]);
  const [mapName, setMapName] = useState('');
  const [selectedMap, setSelectedMap] = useState<BuilderMap | null>(null);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  async function loadMaps() {
    setIsLoadingMaps(true);
    setError(undefined);

    try {
      setMaps(await fetchMaps());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Mapy se nepodarilo nacist.');
    } finally {
      setIsLoadingMaps(false);
    }
  }

  useEffect(() => {
    void loadMaps();
  }, []);

  function openScreen(nextScreen: Screen) {
    setScreen(nextScreen);
    setMessage(undefined);
    setError(undefined);

    if (nextScreen === 'edit') {
      void loadMaps();
    }
  }

  async function handleCreateMap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = mapName.trim();

    if (trimmedName.length < 2) {
      setError('Nazev mapy musi mit aspon 2 znaky.');
      return;
    }

    setError(undefined);
    setMessage(undefined);

    try {
      const map = await createMap(trimmedName);
      setMapName('');
      setSelectedMap(map);
      setMessage(`Mapa ${map.id} byla vytvorena ve slozce maps.`);
      await loadMaps();
      setScreen('editor');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Mapu se nepodarilo vytvorit.');
    }
  }

  function handleEditMap(map: BuilderMap) {
    setSelectedMap(map);
    setScreen('editor');
    setMessage(undefined);
    setError(undefined);
  }

  if (screen === 'create') {
    return (
      <main className="screen">
        <section className="pixel-panel form-panel">
          <p className="brand-tag">Map builder</p>
          <h1>Vytvorit mapu</h1>
          <p className="screen-description">
            Zadej nazev mapy. Builder vytvori slozku v `MapBuilder/maps` podle slug formatu.
          </p>

          <form className="builder-form" onSubmit={handleCreateMap}>
            <label>
              Nazev mapy
              <input
                value={mapName}
                onChange={(event) => setMapName(event.target.value)}
                placeholder="Bata Tower"
              />
            </label>

            {error && <p className="error-message">{error}</p>}
            {message && <p className="success-message">{message}</p>}

            <button type="submit" className="pixel-button primary-button">
              Vytvorit mapu
            </button>
          </form>

          <button type="button" className="pixel-button ghost-button full-button" onClick={() => openScreen('menu')}>
            Zpet do menu
          </button>
        </section>
      </main>
    );
  }

  if (screen === 'edit') {
    return (
      <main className="screen">
        <section className="pixel-panel list-panel">
          <p className="brand-tag">Map builder</p>
          <h1>Upravit mapu</h1>
          <p className="screen-description">Vyber mapu ze slozky `MapBuilder/maps`.</p>

          {isLoadingMaps && <p className="muted-text">Nacitam mapy...</p>}
          {error && <p className="error-message">{error}</p>}

          {!isLoadingMaps && maps.length === 0 ? (
            <p className="muted-text">Zatim tu neni zadna mapa k uprave.</p>
          ) : (
            <div className="map-grid">
              {maps.map((map) => (
                <article key={map.id} className="map-card">
                  <h2>{map.name}</h2>
                  <p className="map-path">maps/{map.id}</p>

                  <button type="button" className="pixel-button secondary-button" onClick={() => handleEditMap(map)}>
                    Upravit
                  </button>
                </article>
              ))}
            </div>
          )}

          <button type="button" className="pixel-button ghost-button full-button" onClick={() => openScreen('menu')}>
            Zpet do menu
          </button>
        </section>
      </main>
    );
  }

  if (screen === 'editor' && selectedMap) {
    return (
      <main className="screen">
        <section className="pixel-panel form-panel">
          <p className="brand-tag">Map builder</p>
          <h1>{selectedMap.name}</h1>

          <p className="screen-description">
            Zaklad mapy je pripraveny. Samotny editor sekci a obstacles prijde v dalsim kroku.
          </p>

          <div className="editor-meta">
            <span>Slozka</span>
            <strong>maps/{selectedMap.id}</strong>
          </div>

          {message && <p className="success-message">{message}</p>}

          <div className="button-row">
            <button type="button" className="pixel-button secondary-button" onClick={() => openScreen('edit')}>
              Zpet na mapy
            </button>

            <button type="button" className="pixel-button ghost-button" onClick={() => openScreen('menu')}>
              Zpet do menu
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="screen">
      <section className="pixel-panel main-panel">
        <p className="brand-tag">Bata / MDC</p>
        <h1>Map builder</h1>
        <p className="screen-description">
          Samostatny nastroj pro vytvareni a upravu map pro Bata on Top.
        </p>

        <div className="menu-actions">
          <button type="button" className="pixel-button primary-button" onClick={() => openScreen('create')}>
            Vytvorit mapu
          </button>

          <button type="button" className="pixel-button secondary-button" onClick={() => openScreen('edit')}>
            Upravit mapu
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;
