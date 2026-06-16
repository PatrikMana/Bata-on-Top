import fs from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const MAPS_DIRECTORY = path.resolve(__dirname, 'maps');
const DEFAULT_GRID_COLUMNS = 16;
const DEFAULT_GRID_ROWS = 9;

type CreateMapRequest = {
  name?: string;
};

type SaveSectionRequest = {
  gridColumns?: number;
  gridRows?: number;
  obstacles?: ObstacleDefinition[];
};

type UploadFileRequest = {
  dataUrl?: string;
  fileName?: string;
};

type ImportAssetsRequest = {
  files?: Array<{
    path?: string;
    dataUrl?: string;
  }>;
};

type ObstacleType = 'normal' | 'ice' | 'slope' | 'finish' | 'danger';

type ObstacleDefinition = {
  id: string;
  type: ObstacleType;
  assetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

type ObstaclesFile = {
  obstacles: ObstacleDefinition[];
};

type BuilderSectionFile = {
  gridColumns: number;
  gridRows: number;
};

type AssetTile = {
  path: string;
  name: string;
  url: string;
};

function slugifyMapName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function ensureMapsDirectory() {
  await fs.mkdir(MAPS_DIRECTORY, { recursive: true });
}

function isSystemError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

async function readRequestBody(request: IncomingMessage) {
  let body = '';

  for await (const chunk of request) {
    body += chunk;
  }

  return body;
}

async function readJsonBody<T>(request: IncomingMessage) {
  const body = await readRequestBody(request);

  return JSON.parse(body || '{}') as T;
}

function sendJson(response: ServerResponse, statusCode: number, data: unknown) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(data));
}

function getMapDirectory(mapId: string) {
  if (!/^[a-z0-9-]+$/.test(mapId)) {
    throw new Error('Neplatne ID mapy.');
  }

  return path.join(MAPS_DIRECTORY, mapId);
}

function safeJoin(baseDirectory: string, ...segments: string[]) {
  const targetPath = path.resolve(baseDirectory, ...segments);
  const normalizedBase = path.resolve(baseDirectory);

  if (targetPath !== normalizedBase && !targetPath.startsWith(`${normalizedBase}${path.sep}`)) {
    throw new Error('Neplatna cesta.');
  }

  return targetPath;
}

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string, fallback: T) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function getSectionDirectory(mapDirectory: string, sectionIndex: number) {
  return safeJoin(mapDirectory, 'sections', sectionIndex.toString());
}

async function ensureSection(mapDirectory: string, sectionIndex: number) {
  const sectionDirectory = getSectionDirectory(mapDirectory, sectionIndex);
  const obstaclesDirectory = safeJoin(sectionDirectory, 'obstacles');
  const obstaclesPath = safeJoin(obstaclesDirectory, 'obstacles.json');
  const builderPath = safeJoin(sectionDirectory, 'builder.json');

  await fs.mkdir(obstaclesDirectory, { recursive: true });

  if (!(await pathExists(obstaclesPath))) {
    await fs.writeFile(obstaclesPath, JSON.stringify({ obstacles: [] }, null, 2));
  }

  if (!(await pathExists(builderPath))) {
    await fs.writeFile(
      builderPath,
      JSON.stringify(
        {
          gridColumns: DEFAULT_GRID_COLUMNS,
          gridRows: DEFAULT_GRID_ROWS,
        } satisfies BuilderSectionFile,
        null,
        2,
      ),
    );
  }
}

async function listSectionIndexes(mapDirectory: string) {
  const sectionsDirectory = safeJoin(mapDirectory, 'sections');

  if (!(await pathExists(sectionsDirectory))) {
    return [];
  }

  const entries = await fs.readdir(sectionsDirectory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => Number(entry.name))
    .sort((a, b) => a - b);
}

async function readSection(mapId: string, mapDirectory: string, sectionIndex: number) {
  await ensureSection(mapDirectory, sectionIndex);

  const sectionDirectory = getSectionDirectory(mapDirectory, sectionIndex);
  const obstaclesPath = safeJoin(sectionDirectory, 'obstacles', 'obstacles.json');
  const builderPath = safeJoin(sectionDirectory, 'builder.json');
  const backgroundPath = safeJoin(sectionDirectory, 'bg.png');
  const builder = await readJsonFile<BuilderSectionFile>(builderPath, {
    gridColumns: DEFAULT_GRID_COLUMNS,
    gridRows: DEFAULT_GRID_ROWS,
  });
  const obstaclesFile = await readJsonFile<ObstaclesFile>(obstaclesPath, { obstacles: [] });
  const backgroundStat = (await pathExists(backgroundPath)) ? await fs.stat(backgroundPath) : null;

  return {
    index: sectionIndex,
    gridColumns: builder.gridColumns,
    gridRows: builder.gridRows,
    backgroundUrl: backgroundStat
      ? `/api/maps/${mapId}/sections/${sectionIndex}/bg.png?v=${Math.round(backgroundStat.mtimeMs)}`
      : null,
    obstacles: obstaclesFile.obstacles,
  };
}

async function listAssetGroups(mapId: string, mapDirectory: string) {
  const assetsDirectory = safeJoin(mapDirectory, 'assets');

  if (!(await pathExists(assetsDirectory))) {
    return [];
  }

  const entries = await fs.readdir(assetsDirectory, { withFileTypes: true });
  const groups = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const tiles = await listAssetTiles(mapId, assetsDirectory, entry.name);
    const centerTile =
      tiles.find((tile) => tile.path === 'row-2-column-2.png') ??
      tiles[Math.floor(tiles.length / 2)] ??
      null;

    groups.push({
      id: entry.name,
      name: entry.name,
      previewUrl: centerTile?.url ?? `/api/maps/${mapId}/assets/${entry.name}/row-2-column-2.png`,
      tiles,
    });
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

async function listAssetTiles(
  mapId: string,
  assetsDirectory: string,
  assetGroupId: string,
  relativeDirectory = '',
): Promise<AssetTile[]> {
  const groupDirectory = safeJoin(assetsDirectory, assetGroupId, relativeDirectory);
  const entries = await fs.readdir(groupDirectory, { withFileTypes: true });
  const tiles: AssetTile[] = [];

  for (const entry of entries) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      tiles.push(...await listAssetTiles(mapId, assetsDirectory, assetGroupId, relativePath));
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.png')) {
      continue;
    }

    tiles.push({
      path: relativePath,
      name: relativePath,
      url: `/api/maps/${mapId}/assets/${assetGroupId}/${relativePath
        .split('/')
        .map((part) => encodeURIComponent(part))
        .join('/')}`,
    });
  }

  return tiles.sort((a, b) => a.path.localeCompare(b.path));
}

async function listMaps() {
  await ensureMapsDirectory();

  const entries = await fs.readdir(MAPS_DIRECTORY, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      id: entry.name,
      name: entry.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function createMap(name: string) {
  await ensureMapsDirectory();

  const id = slugifyMapName(name);

  if (!id) {
    return { status: 400, body: { message: 'Nazev mapy musi obsahovat aspon jeden znak.' } };
  }

  const mapDirectory = path.join(MAPS_DIRECTORY, id);

  try {
    await fs.mkdir(mapDirectory);
  } catch (error) {
    if (isSystemError(error) && error.code === 'EEXIST') {
      return { status: 409, body: { message: 'Mapa s timto nazvem uz existuje.' } };
    }

    throw error;
  }

  await ensureSection(mapDirectory, 0);

  return {
    status: 201,
    body: {
      id,
      name: id,
    },
  };
}

async function getMapData(mapId: string) {
  const mapDirectory = getMapDirectory(mapId);

  if (!(await pathExists(mapDirectory))) {
    return { status: 404, body: { message: 'Mapa neexistuje.' } };
  }

  let sectionIndexes = await listSectionIndexes(mapDirectory);

  if (sectionIndexes.length === 0) {
    await ensureSection(mapDirectory, 0);
    sectionIndexes = [0];
  }

  return {
    status: 200,
    body: {
      map: {
        id: mapId,
        name: mapId,
      },
      assetGroups: await listAssetGroups(mapId, mapDirectory),
      sections: await Promise.all(
        sectionIndexes.map((sectionIndex) => readSection(mapId, mapDirectory, sectionIndex)),
      ),
    },
  };
}

async function addSection(mapId: string) {
  const mapDirectory = getMapDirectory(mapId);
  const sectionIndexes = await listSectionIndexes(mapDirectory);
  const nextSectionIndex = sectionIndexes.length === 0 ? 0 : Math.max(...sectionIndexes) + 1;

  await ensureSection(mapDirectory, nextSectionIndex);

  return {
    status: 201,
    body: await readSection(mapId, mapDirectory, nextSectionIndex),
  };
}

async function saveSection(mapId: string, sectionIndex: number, data: SaveSectionRequest) {
  const mapDirectory = getMapDirectory(mapId);
  const sectionDirectory = getSectionDirectory(mapDirectory, sectionIndex);
  const obstaclesDirectory = safeJoin(sectionDirectory, 'obstacles');

  await ensureSection(mapDirectory, sectionIndex);
  await fs.mkdir(obstaclesDirectory, { recursive: true });
  await fs.writeFile(
    safeJoin(sectionDirectory, 'builder.json'),
    JSON.stringify(
      {
        gridColumns: data.gridColumns ?? DEFAULT_GRID_COLUMNS,
        gridRows: data.gridRows ?? DEFAULT_GRID_ROWS,
      } satisfies BuilderSectionFile,
      null,
      2,
    ),
  );
  await fs.writeFile(
    safeJoin(obstaclesDirectory, 'obstacles.json'),
    JSON.stringify({ obstacles: data.obstacles ?? [] } satisfies ObstaclesFile, null, 2),
  );

  return {
    status: 200,
    body: await readSection(mapId, mapDirectory, sectionIndex),
  };
}

function dataUrlToBuffer(dataUrl: string) {
  const match = /^data:[^;]+;base64,(?<data>.+)$/u.exec(dataUrl);

  if (!match?.groups?.data) {
    throw new Error('Soubor nema platny data URL format.');
  }

  return Buffer.from(match.groups.data, 'base64');
}

async function saveBackground(mapId: string, sectionIndex: number, data: UploadFileRequest) {
  if (!data.dataUrl) {
    return { status: 400, body: { message: 'Chybi soubor pozadi.' } };
  }

  const mapDirectory = getMapDirectory(mapId);
  const sectionDirectory = getSectionDirectory(mapDirectory, sectionIndex);

  await ensureSection(mapDirectory, sectionIndex);
  await fs.writeFile(safeJoin(sectionDirectory, 'bg.png'), dataUrlToBuffer(data.dataUrl));

  return {
    status: 200,
    body: await readSection(mapId, mapDirectory, sectionIndex),
  };
}

async function copyBackground(mapId: string, sectionIndex: number) {
  if (sectionIndex <= 0) {
    return { status: 400, body: { message: 'Prvni sekce nema predchozi pozadi.' } };
  }

  const mapDirectory = getMapDirectory(mapId);
  const sourcePath = safeJoin(
    getSectionDirectory(mapDirectory, sectionIndex - 1),
    'bg.png',
  );
  const targetPath = safeJoin(getSectionDirectory(mapDirectory, sectionIndex), 'bg.png');

  if (!(await pathExists(sourcePath))) {
    return { status: 404, body: { message: 'Predchozi sekce nema pozadi.' } };
  }

  await ensureSection(mapDirectory, sectionIndex);
  await fs.copyFile(sourcePath, targetPath);

  return {
    status: 200,
    body: await readSection(mapId, mapDirectory, sectionIndex),
  };
}

function normalizeImportedAssetPath(filePath: string) {
  const parts = filePath.replaceAll('\\', '/').split('/').filter(Boolean);
  const assetsIndex = parts.findIndex((part) => part.toLowerCase() === 'assets');
  const normalizedParts = assetsIndex >= 0 ? parts.slice(assetsIndex + 1) : parts;

  if (normalizedParts.length === 0) {
    return null;
  }

  if (normalizedParts.some((part) => part === '..' || part.includes(':'))) {
    return null;
  }

  if (normalizedParts.length === 1) {
    return ['ungrouped', normalizedParts[0]];
  }

  return normalizedParts;
}

async function importAssets(mapId: string, data: ImportAssetsRequest) {
  const mapDirectory = getMapDirectory(mapId);
  const assetsDirectory = safeJoin(mapDirectory, 'assets');
  let importedCount = 0;

  await fs.mkdir(assetsDirectory, { recursive: true });

  for (const file of data.files ?? []) {
    if (!file.path || !file.dataUrl) {
      continue;
    }

    const normalizedPath = normalizeImportedAssetPath(file.path);

    if (!normalizedPath) {
      continue;
    }

    const targetPath = safeJoin(assetsDirectory, ...normalizedPath);

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, dataUrlToBuffer(file.dataUrl));
    importedCount += 1;
  }

  return {
    status: 200,
    body: {
      importedCount,
      assetGroups: await listAssetGroups(mapId, mapDirectory),
    },
  };
}

async function sendFile(response: ServerResponse, filePath: string) {
  if (!(await pathExists(filePath))) {
    sendJson(response, 404, { message: 'Soubor neexistuje.' });
    return;
  }

  response.statusCode = 200;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'image/png');
  response.end(await fs.readFile(filePath));
}

function mapsApiPlugin(): Plugin {
  return {
    name: 'map-builder-api',
    configureServer(server) {
      server.middlewares.use('/api/maps', async (request, response) => {
        try {
          const url = new URL(request.url ?? '/', 'http://localhost');
          const segments = url.pathname.split('/').filter(Boolean);

          if (request.method === 'GET') {
            if (segments.length === 0) {
              sendJson(response, 200, { maps: await listMaps() });
              return;
            }

            const [mapId, resource, sectionIndexOrAssetGroup, fileName] = segments;

            if (resource === 'sections' && fileName === 'bg.png') {
              await sendFile(
                response,
                safeJoin(
                  getSectionDirectory(getMapDirectory(mapId), Number(sectionIndexOrAssetGroup)),
                  'bg.png',
                ),
              );
              return;
            }

            if (resource === 'assets' && sectionIndexOrAssetGroup && fileName) {
              await sendFile(
                response,
                safeJoin(
                  getMapDirectory(mapId),
                  'assets',
                  sectionIndexOrAssetGroup,
                  ...segments.slice(3),
                ),
              );
              return;
            }

            const result = await getMapData(mapId);

            sendJson(response, result.status, result.body);
            return;
          }

          if (request.method === 'POST') {
            if (segments.length === 0) {
              const data = await readJsonBody<CreateMapRequest>(request);
              const result = await createMap(data.name?.trim() ?? '');

              sendJson(response, result.status, result.body);
              return;
            }

            const [mapId, resource, sectionIndex, action] = segments;

            if (resource === 'sections' && segments.length === 2) {
              const result = await addSection(mapId);

              sendJson(response, result.status, result.body);
              return;
            }

            if (resource === 'sections' && action === 'background') {
              const data = await readJsonBody<UploadFileRequest>(request);
              const result = await saveBackground(mapId, Number(sectionIndex), data);

              sendJson(response, result.status, result.body);
              return;
            }

            if (resource === 'sections' && action === 'copy-background') {
              const result = await copyBackground(mapId, Number(sectionIndex));

              sendJson(response, result.status, result.body);
              return;
            }

            if (resource === 'assets' && sectionIndex === 'import') {
              const data = await readJsonBody<ImportAssetsRequest>(request);
              const result = await importAssets(mapId, data);

              sendJson(response, result.status, result.body);
              return;
            }
          }

          if (request.method === 'PUT') {
            const [mapId, resource, sectionIndex] = segments;

            if (resource === 'sections') {
              const data = await readJsonBody<SaveSectionRequest>(request);
              const result = await saveSection(mapId, Number(sectionIndex), data);

              sendJson(response, result.status, result.body);
              return;
            }
          }

          if (request.method === 'POST') {
            sendJson(response, 404, { message: 'Endpoint neexistuje.' });
            return;
          }

          sendJson(response, 405, { message: 'Metoda neni podporovana.' });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Neocekavana chyba.';
          sendJson(response, 500, { message });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), mapsApiPlugin()],
});
