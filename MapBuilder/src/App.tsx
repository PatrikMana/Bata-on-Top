import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type InputHTMLAttributes,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const SECTION_WIDTH = 1280;
const SECTION_HEIGHT = 720;
const MIN_GRID_COLUMNS = 4;
const MAX_GRID_COLUMNS = 80;
const MIN_GRID_ROWS = 3;
const MAX_GRID_ROWS = 48;

type Screen = 'menu' | 'create' | 'edit' | 'editor';
type EditorTool = 'draw' | 'select';
type ObstacleType = 'normal' | 'ice' | 'slope';

type BuilderMap = {
  id: string;
  name: string;
};

type AssetGroup = {
  id: string;
  name: string;
  previewUrl: string;
  tiles: AssetTile[];
};

type AssetTile = {
  path: string;
  name: string;
  url: string;
};

type ObstacleDefinition = {
  id: string;
  type: ObstacleType | 'finish' | 'danger';
  assetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  previewTilePath?: string;
};

type BuilderSection = {
  index: number;
  gridColumns: number;
  gridRows: number;
  backgroundUrl: string | null;
  obstacles: ObstacleDefinition[];
};

type BuilderMapData = {
  map: BuilderMap;
  assetGroups: AssetGroup[];
  sections: BuilderSection[];
};

type CellPosition = {
  column: number;
  row: number;
};

async function readJsonResponse<T extends object>(response: Response) {
  const data = (await response.json()) as T | { message?: string };

  if (!response.ok) {
    throw new Error('message' in data && data.message ? data.message : 'Operace se nepodarila.');
  }

  return data as T;
}

async function fetchMaps() {
  const response = await fetch('/api/maps');
  const data = await readJsonResponse<{ maps: BuilderMap[] }>(response);

  return data.maps;
}

async function fetchMapData(mapId: string) {
  const response = await fetch(`/api/maps/${mapId}`);

  return readJsonResponse<BuilderMapData>(response);
}

async function createMap(name: string) {
  const response = await fetch('/api/maps', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  return readJsonResponse<BuilderMap>(response);
}

async function addSection(mapId: string) {
  const response = await fetch(`/api/maps/${mapId}/sections`, {
    method: 'POST',
  });

  return readJsonResponse<BuilderSection>(response);
}

async function saveSection(mapId: string, section: BuilderSection) {
  const response = await fetch(`/api/maps/${mapId}/sections/${section.index}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gridColumns: section.gridColumns,
      gridRows: section.gridRows,
      obstacles: section.obstacles,
    }),
  });

  return readJsonResponse<BuilderSection>(response);
}

async function uploadSectionBackground(mapId: string, sectionIndex: number, dataUrl: string) {
  const response = await fetch(`/api/maps/${mapId}/sections/${sectionIndex}/background`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dataUrl }),
  });

  return readJsonResponse<BuilderSection>(response);
}

async function copyPreviousBackground(mapId: string, sectionIndex: number) {
  const response = await fetch(`/api/maps/${mapId}/sections/${sectionIndex}/copy-background`, {
    method: 'POST',
  });

  return readJsonResponse<BuilderSection>(response);
}

async function importAssetFiles(
  mapId: string,
  files: Array<{ path: string; dataUrl: string }>,
) {
  const response = await fetch(`/api/maps/${mapId}/assets/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files }),
  });

  return readJsonResponse<{ importedCount: number; assetGroups: AssetGroup[] }>(response);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Soubor se nepodarilo nacist.'));
        return;
      }

      resolve(reader.result);
    });
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function getFileRelativePath(file: File) {
  const webkitFile = file as File & { webkitRelativePath?: string };

  return webkitFile.webkitRelativePath || file.name;
}

function getCellKey(cell: CellPosition) {
  return `${cell.column}:${cell.row}`;
}

function getObstacleCell(section: BuilderSection, obstacle: ObstacleDefinition): CellPosition {
  const cellWidth = SECTION_WIDTH / section.gridColumns;
  const cellHeight = SECTION_HEIGHT / section.gridRows;

  return {
    column: Math.max(0, Math.min(section.gridColumns - 1, Math.floor(obstacle.x / cellWidth))),
    row: Math.max(0, Math.min(section.gridRows - 1, Math.floor(obstacle.y / cellHeight))),
  };
}

function createObstacleForCell(
  section: BuilderSection,
  cell: CellPosition,
  assetId: string,
  type: ObstacleType,
  previewTilePath?: string,
): ObstacleDefinition {
  const cellWidth = SECTION_WIDTH / section.gridColumns;
  const cellHeight = SECTION_HEIGHT / section.gridRows;

  return {
    id: `block-${cell.column}-${cell.row}`,
    type,
    assetId,
    x: Math.round((cell.column + 0.5) * cellWidth),
    y: Math.round((cell.row + 0.5) * cellHeight),
    width: Math.round(cellWidth),
    height: Math.round(cellHeight),
    rotation: type === 'slope' ? -18 : 0,
    previewTilePath,
  };
}

function getTileUrl(mapId: string, assetId: string, tilePath?: string) {
  return `/api/maps/${mapId}/assets/${assetId}/${tilePath ?? 'row-2-column-2.png'}`;
}

function getGridCellPercent(cellCount: number) {
  return `${100 / cellCount}%`;
}

function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [maps, setMaps] = useState<BuilderMap[]>([]);
  const [mapName, setMapName] = useState('');
  const [mapData, setMapData] = useState<BuilderMapData | null>(null);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [selectedAssetId, setSelectedAssetId] = useState<string>();
  const [selectedTilePath, setSelectedTilePath] = useState<string>();
  const [selectedObstacleType, setSelectedObstacleType] = useState<ObstacleType>('normal');
  const [tool, setTool] = useState<EditorTool>('draw');
  const [isShiftSelecting, setIsShiftSelecting] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [selectionStart, setSelectionStart] = useState<CellPosition | null>(null);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Ulozeno');
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const mapDataRef = useRef<BuilderMapData | null>(null);
  const lastPaintedCellRef = useRef<string | null>(null);
  const saveVersionRef = useRef(0);

  const activeSection = useMemo(() => {
    return mapData?.sections.find((section) => section.index === activeSectionIndex) ?? null;
  }, [activeSectionIndex, mapData]);

  const selectedAsset = useMemo(() => {
    return mapData?.assetGroups.find((assetGroup) => assetGroup.id === selectedAssetId) ?? null;
  }, [mapData?.assetGroups, selectedAssetId]);

  const selectedTile = useMemo(() => {
    return selectedAsset?.tiles.find((tile) => tile.path === selectedTilePath) ?? selectedAsset?.tiles[0] ?? null;
  }, [selectedAsset, selectedTilePath]);
  const activeTool = isShiftSelecting ? 'select' : tool;

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

  async function loadMap(mapId: string) {
    const data = await fetchMapData(mapId);

    setMapData(data);
    setActiveSectionIndex(data.sections[0]?.index ?? 0);
    setSelectedAssetId((currentAssetId) => currentAssetId ?? data.assetGroups[0]?.id);
    setSelectedTilePath((currentTilePath) => currentTilePath ?? data.assetGroups[0]?.tiles[0]?.path);
    setSelectedCells(new Set());
  }

  useEffect(() => {
    void loadMaps();
  }, []);

  useEffect(() => {
    mapDataRef.current = mapData;
  }, [mapData]);

  useEffect(() => {
    if (!selectedAssetId && mapData?.assetGroups[0]) {
      setSelectedAssetId(mapData.assetGroups[0].id);
    }
  }, [mapData?.assetGroups, selectedAssetId]);

  useEffect(() => {
    if (!selectedAsset) {
      setSelectedTilePath(undefined);
      return;
    }

    if (!selectedTilePath || !selectedAsset.tiles.some((tile) => tile.path === selectedTilePath)) {
      setSelectedTilePath(selectedAsset.tiles[0]?.path);
    }
  }, [selectedAsset, selectedTilePath]);

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
      await loadMap(map.id);
      await loadMaps();
      setScreen('editor');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Mapu se nepodarilo vytvorit.');
    }
  }

  async function handleEditMap(map: BuilderMap) {
    try {
      await loadMap(map.id);
      setScreen('editor');
      setMessage(undefined);
      setError(undefined);
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : 'Mapu se nepodarilo otevrit.');
    }
  }

  function updateActiveSection(
    updater: (section: BuilderSection) => BuilderSection,
    options: { autosave?: boolean } = { autosave: true },
  ) {
    const currentMapData = mapDataRef.current;

    if (!currentMapData) {
      return;
    }

    const currentSection = currentMapData.sections.find(
      (section) => section.index === activeSectionIndex,
    );

    if (!currentSection) {
      return;
    }

    const nextSectionForSave = updater(currentSection);
    const nextMapData = {
      ...currentMapData,
      sections: currentMapData.sections.map((section) =>
        section.index === nextSectionForSave.index ? nextSectionForSave : section,
      ),
    };

    mapDataRef.current = nextMapData;
    setMapData(nextMapData);

    if (options.autosave !== false && nextSectionForSave) {
      const saveVersion = saveVersionRef.current + 1;
      saveVersionRef.current = saveVersion;
      setSaveStatus('Ukladam...');
      void saveSection(currentMapData.map.id, nextSectionForSave)
        .then(() => {
          if (saveVersionRef.current === saveVersion) {
            setSaveStatus('Ulozeno');
          }
        })
        .catch((saveError) => {
          if (saveVersionRef.current === saveVersion) {
            setSaveStatus('Chyba ulozeni');
            setError(saveError instanceof Error ? saveError.message : 'Sekce se nepodarilo ulozit.');
          }
        });
    }
  }

  function getCellFromPointer(event: PointerEvent<HTMLDivElement>) {
    if (!activeSection || !canvasRef.current) {
      return null;
    }

    const bounds = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
    const y = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));

    return {
      column: Math.min(activeSection.gridColumns - 1, Math.floor((x / bounds.width) * activeSection.gridColumns)),
      row: Math.min(activeSection.gridRows - 1, Math.floor((y / bounds.height) * activeSection.gridRows)),
    };
  }

  function paintCell(cell: CellPosition) {
    if (!selectedAssetId) {
      setError('Nejdrive importuj nebo vyber asset skupinu.');
      return;
    }

    const cellKey = getCellKey(cell);

    if (lastPaintedCellRef.current === cellKey) {
      return;
    }

    lastPaintedCellRef.current = cellKey;

    updateActiveSection((section) => {
      const nextObstacle = createObstacleForCell(
        section,
        cell,
        selectedAssetId,
        selectedObstacleType,
        selectedTile?.path,
      );
      const obstacles = section.obstacles.filter((obstacle) => {
        return getCellKey(getObstacleCell(section, obstacle)) !== cellKey;
      });

      return {
        ...section,
        obstacles: [...obstacles, nextObstacle],
      };
    });
  }

  function selectCellsInRectangle(start: CellPosition, end: CellPosition) {
    if (!activeSection) {
      return;
    }

    const minColumn = Math.min(start.column, end.column);
    const maxColumn = Math.max(start.column, end.column);
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const nextSelectedCells = new Set<string>();

    for (const obstacle of activeSection.obstacles) {
      const cell = getObstacleCell(activeSection, obstacle);

      if (
        cell.column >= minColumn &&
        cell.column <= maxColumn &&
        cell.row >= minRow &&
        cell.row <= maxRow
      ) {
        nextSelectedCells.add(getCellKey(cell));
      }
    }

    setSelectedCells(nextSelectedCells);
  }

  function handleCanvasPointerDown(event: PointerEvent<HTMLDivElement>) {
    const cell = getCellFromPointer(event);

    if (!cell) {
      return;
    }

    setIsPointerDown(true);
    event.currentTarget.setPointerCapture(event.pointerId);

    if (activeTool === 'draw') {
      lastPaintedCellRef.current = null;
      paintCell(cell);
      return;
    }

    setSelectionStart(cell);
    selectCellsInRectangle(cell, cell);
  }

  function handleCanvasPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isPointerDown) {
      return;
    }

    const cell = getCellFromPointer(event);

    if (!cell) {
      return;
    }

    if (activeTool === 'draw') {
      paintCell(cell);
      return;
    }

    if (selectionStart) {
      selectCellsInRectangle(selectionStart, cell);
    }
  }

  function handleCanvasPointerUp() {
    setIsPointerDown(false);
    setSelectionStart(null);
    lastPaintedCellRef.current = null;
  }

  function moveSelectedCells(deltaColumn: number, deltaRow: number) {
    if (selectedCells.size === 0) {
      return;
    }

    updateActiveSection((section) => {
      const selectedObstacles: ObstacleDefinition[] = [];
      const remainingObstacles: ObstacleDefinition[] = [];
      const cellWidth = SECTION_WIDTH / section.gridColumns;
      const cellHeight = SECTION_HEIGHT / section.gridRows;

      for (const obstacle of section.obstacles) {
        const cell = getObstacleCell(section, obstacle);

        if (selectedCells.has(getCellKey(cell))) {
          selectedObstacles.push(obstacle);
        } else {
          remainingObstacles.push(obstacle);
        }
      }

      const movedObstacles = selectedObstacles.map((obstacle) => {
        const cell = getObstacleCell(section, obstacle);
        const nextColumn = Math.max(0, Math.min(section.gridColumns - 1, cell.column + deltaColumn));
        const nextRow = Math.max(0, Math.min(section.gridRows - 1, cell.row + deltaRow));

        return {
          ...obstacle,
          id: `block-${nextColumn}-${nextRow}`,
          x: Math.round((nextColumn + 0.5) * cellWidth),
          y: Math.round((nextRow + 0.5) * cellHeight),
        };
      });
      const movedCellKeys = new Set(
        movedObstacles.map((obstacle) => getCellKey(getObstacleCell(section, obstacle))),
      );

      setSelectedCells(movedCellKeys);

      return {
        ...section,
        obstacles: [
          ...remainingObstacles.filter((obstacle) => {
            return !movedCellKeys.has(getCellKey(getObstacleCell(section, obstacle)));
          }),
          ...movedObstacles,
        ],
      };
    });
  }

  function deleteSelectedCells() {
    if (selectedCells.size === 0) {
      return;
    }

    updateActiveSection((section) => ({
      ...section,
      obstacles: section.obstacles.filter((obstacle) => {
        return !selectedCells.has(getCellKey(getObstacleCell(section, obstacle)));
      }),
    }));
    setSelectedCells(new Set());
  }

  useEffect(() => {
    if (screen !== 'editor') {
      setIsShiftSelecting(false);
      return undefined;
    }

    function isTypingTarget(target: EventTarget | null) {
      return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key === 'Shift') {
        setIsShiftSelecting(true);
        return;
      }

      if (event.key === 'Delete') {
        event.preventDefault();
        deleteSelectedCells();
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === 'Shift') {
        setIsShiftSelecting(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [screen, selectedCells]);

  function updateGrid(nextValues: Partial<Pick<BuilderSection, 'gridColumns' | 'gridRows'>>) {
    updateActiveSection((section) => ({
      ...section,
      ...nextValues,
    }));
  }

  async function handleAddSection() {
    if (!mapData) {
      return;
    }

    try {
      const section = await addSection(mapData.map.id);

      setMapData({
        ...mapData,
        sections: [...mapData.sections, section],
      });
      setActiveSectionIndex(section.index);
      setSelectedCells(new Set());
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Sekci se nepodarilo pridat.');
    }
  }

  async function handleBackgroundUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!mapData || !activeSection || !event.target.files?.[0]) {
      return;
    }

    try {
      setSaveStatus('Ukladam pozadi...');
      const dataUrl = await readFileAsDataUrl(event.target.files[0]);
      const savedSection = await uploadSectionBackground(mapData.map.id, activeSection.index, dataUrl);

      setMapData({
        ...mapData,
        sections: mapData.sections.map((section) =>
          section.index === savedSection.index ? savedSection : section,
        ),
      });
      setSaveStatus('Ulozeno');
    } catch (uploadError) {
      setSaveStatus('Chyba ulozeni');
      setError(uploadError instanceof Error ? uploadError.message : 'Pozadi se nepodarilo nahrat.');
    } finally {
      event.target.value = '';
    }
  }

  async function handleCopyPreviousBackground() {
    if (!mapData || !activeSection) {
      return;
    }

    try {
      setSaveStatus('Kopiruju pozadi...');
      const savedSection = await copyPreviousBackground(mapData.map.id, activeSection.index);

      setMapData({
        ...mapData,
        sections: mapData.sections.map((section) =>
          section.index === savedSection.index ? savedSection : section,
        ),
      });
      setSaveStatus('Ulozeno');
    } catch (copyError) {
      setSaveStatus('Chyba ulozeni');
      setError(copyError instanceof Error ? copyError.message : 'Pozadi se nepodarilo zkopirovat.');
    }
  }

  async function handleAssetImport(event: ChangeEvent<HTMLInputElement>) {
    if (!mapData || !event.target.files) {
      return;
    }

    try {
      setSaveStatus('Importuju assety...');
      const files = await Promise.all(
        [...event.target.files]
          .filter((file) => file.type.startsWith('image/'))
          .map(async (file) => ({
            path: getFileRelativePath(file),
            dataUrl: await readFileAsDataUrl(file),
          })),
      );
      const result = await importAssetFiles(mapData.map.id, files);

      setMapData({
        ...mapData,
        assetGroups: result.assetGroups,
      });
      setSelectedAssetId((currentAssetId) => currentAssetId ?? result.assetGroups[0]?.id);
      setSelectedTilePath((currentTilePath) => currentTilePath ?? result.assetGroups[0]?.tiles[0]?.path);
      setSaveStatus(`Importovano ${result.importedCount} souboru`);
    } catch (importError) {
      setSaveStatus('Chyba importu');
      setError(importError instanceof Error ? importError.message : 'Assety se nepodarilo importovat.');
    } finally {
      event.target.value = '';
    }
  }

  const directoryInputProps = {
    webkitdirectory: '',
    directory: '',
  } as InputHTMLAttributes<HTMLInputElement>;

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

                  <button type="button" className="pixel-button secondary-button" onClick={() => void handleEditMap(map)}>
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

  if (screen === 'editor' && mapData && activeSection) {
    return (
      <main className="editor-screen">
        <header className="editor-topbar">
          <div>
            <p className="brand-tag compact-tag">Map builder</p>
            <h1>{mapData.map.name}</h1>
          </div>

          <div className="topbar-actions">
            <span className="save-status">{saveStatus}</span>
            <button type="button" className="pixel-button ghost-button" onClick={() => openScreen('edit')}>
              Mapy
            </button>
            <button type="button" className="pixel-button ghost-button" onClick={() => openScreen('menu')}>
              Menu
            </button>
          </div>
        </header>

        <div className="builder-workbench">
          <aside className="sections-sidebar">
            <div className="sidebar-header">
              <h2>Sekce</h2>
              <button type="button" className="icon-button" onClick={() => void handleAddSection()}>
                +
              </button>
            </div>

            <div className="section-list">
              {mapData.sections.map((section) => (
                <button
                  key={section.index}
                  type="button"
                  className={`section-thumb ${section.index === activeSection.index ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSectionIndex(section.index);
                    setSelectedCells(new Set());
                  }}
                >
                  <span>Sekce {section.index}</span>
                  <span>{section.gridColumns} sl. x {section.gridRows} rad.</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="canvas-panel">
            <div className="canvas-toolbar">
              <div className="segmented-control">
                <button
                  type="button"
                  className={activeTool === 'draw' ? 'active' : ''}
                  onClick={() => setTool('draw')}
                >
                  Kreslit
                </button>
                <button
                  type="button"
                  className={activeTool === 'select' ? 'active' : ''}
                  onClick={() => setTool('select')}
                >
                  Select
                </button>
              </div>

              <span>
                Vybrano: {selectedCells.size} {isShiftSelecting ? '/ Shift select' : ''}
              </span>
            </div>

            <div
              ref={canvasRef}
              className="scene-canvas"
              style={{
                '--grid-columns': activeSection.gridColumns,
                '--grid-rows': activeSection.gridRows,
                '--grid-cell-width': getGridCellPercent(activeSection.gridColumns),
                '--grid-cell-height': getGridCellPercent(activeSection.gridRows),
                backgroundImage: activeSection.backgroundUrl ? `url(${activeSection.backgroundUrl})` : undefined,
              } as CSSProperties}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerLeave={handleCanvasPointerUp}
            >
              {activeSection.obstacles.map((obstacle) => {
                const cell = getObstacleCell(activeSection, obstacle);
                const cellKey = getCellKey(cell);
                const isSelected = selectedCells.has(cellKey);

                return (
                  <div
                    key={obstacle.id}
                    className={`canvas-obstacle ${obstacle.type} ${isSelected ? 'selected' : ''}`}
                    style={{
                      left: `${((obstacle.x - obstacle.width / 2) / SECTION_WIDTH) * 100}%`,
                      top: `${((obstacle.y - obstacle.height / 2) / SECTION_HEIGHT) * 100}%`,
                      width: `${(obstacle.width / SECTION_WIDTH) * 100}%`,
                      height: `${(obstacle.height / SECTION_HEIGHT) * 100}%`,
                      backgroundImage: `url(${getTileUrl(mapData.map.id, obstacle.assetId, obstacle.previewTilePath)})`,
                      transform: `rotate(${obstacle.rotation}deg)`,
                    }}
                  />
                );
              })}
            </div>
          </section>

          <aside className="tools-panel">
            <section className="tool-group">
              <h2>Grid</h2>
              <label>
                Sloupce: {activeSection.gridColumns}
                <input
                  type="range"
                  min={MIN_GRID_COLUMNS}
                  max={MAX_GRID_COLUMNS}
                  value={activeSection.gridColumns}
                  onChange={(event) => updateGrid({ gridColumns: Number(event.target.value) })}
                />
              </label>
              <label>
                Radky: {activeSection.gridRows}
                <input
                  type="range"
                  min={MIN_GRID_ROWS}
                  max={MAX_GRID_ROWS}
                  value={activeSection.gridRows}
                  onChange={(event) => updateGrid({ gridRows: Number(event.target.value) })}
                />
              </label>
            </section>

            <section className="tool-group">
              <h2>Pozadi</h2>
              <label className="file-button">
                Nahrat bg.png
                <input type="file" accept="image/*" onChange={(event) => void handleBackgroundUpload(event)} />
              </label>
              <button
                type="button"
                className="pixel-button secondary-button"
                disabled={activeSection.index === 0}
                onClick={() => void handleCopyPreviousBackground()}
              >
                Stejne jako predchozi
              </button>
            </section>

            <section className="tool-group">
              <h2>Bloky</h2>
              <label className="file-button">
                Import asset skupiny
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  {...directoryInputProps}
                  onChange={(event) => void handleAssetImport(event)}
                />
              </label>

              {mapData.assetGroups.length === 0 ? (
                <p className="muted-text small-text">Zatim nejsou importovane zadne assety.</p>
              ) : (
                <div className="asset-list">
                  {mapData.assetGroups.map((assetGroup) => (
                    <div key={assetGroup.id} className="asset-group">
                      <button
                        type="button"
                        className={`asset-button ${assetGroup.id === selectedAsset?.id ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedAssetId(assetGroup.id);
                          setSelectedTilePath(assetGroup.tiles[0]?.path);
                        }}
                      >
                        <span
                          className="asset-preview"
                          style={{ backgroundImage: `url(${assetGroup.previewUrl})` }}
                        />
                        {assetGroup.name}
                      </button>

                      {assetGroup.id === selectedAsset?.id && (
                        <div className="tile-grid">
                          {assetGroup.tiles.map((tile) => (
                            <button
                              key={tile.path}
                              type="button"
                              className={`tile-button ${tile.path === selectedTile?.path ? 'active' : ''}`}
                              title={tile.name}
                              onClick={() => setSelectedTilePath(tile.path)}
                            >
                              <span style={{ backgroundImage: `url(${tile.url})` }} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="tool-group">
              <h2>Typ</h2>
              <div className="type-grid">
                {(['normal', 'ice', 'slope'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`type-button ${selectedObstacleType === type ? 'active' : ''}`}
                    onClick={() => setSelectedObstacleType(type)}
                  >
                    {type === 'slope' ? 'sikmy' : type}
                  </button>
                ))}
              </div>
            </section>

            <section className="tool-group">
              <h2>Posunout</h2>
              <div className="move-controls">
                <button type="button" onClick={() => moveSelectedCells(0, -1)}>Nahoru</button>
                <button type="button" onClick={() => moveSelectedCells(-1, 0)}>Vlevo</button>
                <button type="button" onClick={() => moveSelectedCells(1, 0)}>Vpravo</button>
                <button type="button" onClick={() => moveSelectedCells(0, 1)}>Dolu</button>
              </div>
              <button type="button" className="pixel-button ghost-button" onClick={deleteSelectedCells}>
                Smazat vyber
              </button>
            </section>

            {error && <p className="error-message compact-message">{error}</p>}
          </aside>
        </div>
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
