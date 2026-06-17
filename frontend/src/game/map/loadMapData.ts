import type { AvailableMap } from './availableMaps';
import type { LoadedMapData, LoadedMapSection, ObstaclesFile } from './mapTypes';

const MAPS_BASE_PATH = '/maps';

function getSectionBackgroundUrl(mapId: string, sectionIndex: number) {
  return `${MAPS_BASE_PATH}/${mapId}/sections/${sectionIndex}/bg.png`;
}

function getObstacleJsonCandidates(mapId: string, sectionIndex: number) {
  return [
    `${MAPS_BASE_PATH}/${mapId}/sections/${sectionIndex}/obstacles/obstacles.json`,
    `${MAPS_BASE_PATH}/${mapId}/sections/${sectionIndex}/obstacles.json`,
  ];
}

export function getMapAssetUrl(mapId: string, assetId: string) {
  return `${MAPS_BASE_PATH}/${mapId}/assets/${assetId}.png`;
}

export function getMapAssetTileUrl(
  mapId: string,
  assetId: string,
  row: number,
  column: number,
) {
  return `${MAPS_BASE_PATH}/${mapId}/assets/${assetId}/row-${row}-column-${column}.png`;
}

async function fetchObstaclesJson(mapId: string, sectionIndex: number) {
  const candidates = getObstacleJsonCandidates(mapId, sectionIndex);

  for (const url of candidates) {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      const rawData = await response.text();
      const trimmedData = rawData.trim();

      if (trimmedData.startsWith('<')) {
        continue;
      }

      let data: ObstaclesFile;

      try {
        data = JSON.parse(trimmedData) as ObstaclesFile;
      } catch {
        throw new Error(`Obstacle data nejsou validní JSON: ${url}`);
      }

      return { data, url };
    }

    if (response.status !== 404) {
      throw new Error(`Nepodařilo se načíst obstacle data: ${url}`);
    }
  }

  throw new Error(
    `Sekce ${sectionIndex} v mapě ${mapId} nemá obstacles.json v žádné podporované cestě.`,
  );
}

export async function loadMapSection(
  map: AvailableMap,
  sectionIndex: number,
): Promise<LoadedMapSection> {
  const { data, url } = await fetchObstaclesJson(map.id, sectionIndex);

  return {
    index: sectionIndex,
    backgroundUrl: getSectionBackgroundUrl(map.id, sectionIndex),
    obstaclesUrl: url,
    obstacles: data.obstacles,
  };
}

export async function loadMapData(map: AvailableMap): Promise<LoadedMapData> {
  const sections: LoadedMapSection[] = [];
  const assetIds = new Set<string>();

  for (let sectionIndex = 0; sectionIndex < map.sectionCount; sectionIndex += 1) {
    const section = await loadMapSection(map, sectionIndex);

    for (const obstacle of section.obstacles) {
      assetIds.add(obstacle.assetId);
    }

    sections.push(section);
  }

  return {
    definition: map,
    totalWidth: map.sectionWidth,
    totalHeight: map.sectionHeight * map.sectionCount,
    assetIds: [...assetIds],
    sections,
  };
}
