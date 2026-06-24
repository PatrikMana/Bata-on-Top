import Phaser from 'phaser';
import Matter from 'matter-js';
import { getMapAssetFileUrl, getMapAssetTileUrl, getMapAssetUrl } from './loadMapData';
import type {
  CreatedLevel,
  CreatedLevelObstacle,
  LoadedMapData,
  ObstacleDefinition,
  ObstacleType,
} from './mapTypes';

const HOOKABLE_OBSTACLE_TYPES = new Set<ObstacleType>(['normal', 'ice', 'slope']);
const FALLBACK_OBSTACLE_TEXTURE_KEY = 'map:fallback:missing-obstacle';
const GROUND_OBSTACLE_ID = 'section-0-ground';
const GROUND_HEIGHT = 64;
const TILESET_ROWS = 3;
const TILESET_COLUMNS = 3;
const ADJACENCY_EPSILON = 2;
const COLLIDER_ALPHA_THRESHOLD = 16;
const alphaColliderVerticesCache = new Map<string, ColliderPoint[]>();
const WORLD_BOUNDARY_THICKNESS = 64;

export type ObstaclePhysicsData = {
  obstacleId: string;
  obstacleType: ObstacleType;
  slopeDownhill?: Matter.Vector;
  standableSlope?: boolean;
};

type ColliderPoint = {
  x: number;
  y: number;
};

function setObstaclePhysicsData(
  body: Matter.Body,
  data: ObstaclePhysicsData,
) {
  body.plugin = {
    ...body.plugin,
    bataOnTop: data,
  };
}

export function getObstaclePhysicsData(body: Matter.Body) {
  return body.plugin?.bataOnTop as ObstaclePhysicsData | undefined;
}

function createStaticBodyOptions(
  obstacleType: ObstacleType,
  obstacleId: string,
): Matter.IChamferableBodyDefinition {
  return {
    isStatic: true,
    isSensor: obstacleType === 'finish',
    label: `obstacle:${obstacleType}:${obstacleId}`,
    friction: 0,
    frictionStatic: 0,
    restitution: 0,
    slop: 0.02,
  };
}

function attachObstaclePhysicsData(
  body: Matter.Body,
  obstacleType: ObstacleType,
  obstacleId: string,
) {
  setObstaclePhysicsData(body, {
    obstacleId,
    obstacleType,
  });

  return body;
}

function cloneColliderPoints(points: ColliderPoint[]) {
  return points.map((point) => ({ x: point.x, y: point.y }));
}

const ASSET_ALIASES: Record<string, string> = {
  'platform-normal': 'brick',
  'platform-ice': 'brick-frozen',
  'platform-slope': 'concrete',
};

export function getSectionWorldTop(map: LoadedMapData, sectionIndex: number) {
  return map.totalHeight - (sectionIndex + 1) * map.definition.sectionHeight;
}

export function getBackgroundTextureKey(mapId: string, sectionIndex: number) {
  return `map:${mapId}:section:${sectionIndex}:bg`;
}

export function getAssetTextureKey(mapId: string, assetId: string) {
  return `map:${mapId}:asset:${assetId}`;
}

export function getAssetTileTextureKey(
  mapId: string,
  assetId: string,
  row: number,
  column: number,
) {
  return `map:${mapId}:asset:${assetId}:tile:${row}:${column}`;
}

export function getAssetFileTextureKey(mapId: string, assetId: string, filePath: string) {
  return `map:${mapId}:asset:${assetId}:file:${filePath}`;
}

function getAssetIdCandidates(assetId: string) {
  const alias = ASSET_ALIASES[assetId];

  return alias ? [assetId, alias] : [assetId];
}

function getNormalizedAssetId(assetId: string) {
  return ASSET_ALIASES[assetId] ?? assetId;
}

function ensureFallbackObstacleTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(FALLBACK_OBSTACLE_TEXTURE_KEY)) {
    return FALLBACK_OBSTACLE_TEXTURE_KEY;
  }

  const graphics = scene.add.graphics();

  graphics.fillStyle(0xff4fd8);
  graphics.fillRect(0, 0, 64, 64);
  graphics.fillStyle(0x7a1fa2);
  graphics.fillRect(0, 0, 32, 32);
  graphics.fillRect(32, 32, 32, 32);
  graphics.lineStyle(4, 0xffffff, 0.85);
  graphics.strokeRect(0, 0, 64, 64);
  graphics.generateTexture(FALLBACK_OBSTACLE_TEXTURE_KEY, 64, 64);
  graphics.destroy();

  return FALLBACK_OBSTACLE_TEXTURE_KEY;
}

function markObstacleObject(
  gameObject: Phaser.GameObjects.GameObject,
  obstacle: ObstacleDefinition,
  isHookable: boolean,
) {
  gameObject.setData('obstacleId', obstacle.id);
  gameObject.setData('obstacleType', obstacle.type);
  gameObject.setData('assetId', obstacle.assetId);
  gameObject.setData('isHookable', isHookable);
}

export function preloadMapAssets(scene: Phaser.Scene, map: LoadedMapData): Promise<void> {
  const mapId = map.definition.id;
  let queuedAssets = 0;
  const obstacleAssetKeys = new Set<string>();

  for (const section of map.sections) {
    const key = getBackgroundTextureKey(mapId, section.index);

    if (!scene.textures.exists(key)) {
      queuedAssets += 1;
      scene.load.image(key, section.backgroundUrl);
    }
  }

  for (const assetId of map.assetIds) {
    for (const assetIdCandidate of getAssetIdCandidates(assetId)) {
      const key = getAssetTextureKey(mapId, assetIdCandidate);
      obstacleAssetKeys.add(key);

      if (!scene.textures.exists(key)) {
        queuedAssets += 1;
        scene.load.image(key, getMapAssetUrl(mapId, assetIdCandidate));
      }

      for (let row = 1; row <= TILESET_ROWS; row += 1) {
        for (let column = 1; column <= TILESET_COLUMNS; column += 1) {
          const tileKey = getAssetTileTextureKey(mapId, assetIdCandidate, row, column);
          obstacleAssetKeys.add(tileKey);

          if (!scene.textures.exists(tileKey)) {
            queuedAssets += 1;
            scene.load.image(
              tileKey,
              getMapAssetTileUrl(mapId, assetIdCandidate, row, column),
            );
          }
        }
      }
    }
  }

  for (const section of map.sections) {
    for (const obstacle of section.obstacles) {
      if (!obstacle.previewTilePath) {
        continue;
      }

      for (const assetIdCandidate of getAssetIdCandidates(obstacle.assetId)) {
        const fileKey = getAssetFileTextureKey(
          mapId,
          assetIdCandidate,
          obstacle.previewTilePath,
        );
        obstacleAssetKeys.add(fileKey);

        if (!scene.textures.exists(fileKey)) {
          queuedAssets += 1;
          scene.load.image(
            fileKey,
            getMapAssetFileUrl(mapId, assetIdCandidate, obstacle.previewTilePath),
          );
        }
      }
    }
  }

  if (queuedAssets === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let blockingError: Error | undefined;

    function handleLoadError(file: Phaser.Loader.File) {
      if (obstacleAssetKeys.has(file.key)) {
        return;
      }

      blockingError = new Error(`Nepodařilo se načíst asset: ${file.key}`);
    }

    scene.load.on('loaderror', handleLoadError);
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      scene.load.off('loaderror', handleLoadError);

      if (blockingError) {
        reject(blockingError);
        return;
      }

      resolve();
    });
    scene.load.start();
  });
}

function getObstacleTextureKey(scene: Phaser.Scene, mapId: string, assetId: string) {
  for (const assetIdCandidate of getAssetIdCandidates(assetId)) {
    const textureKey = getAssetTextureKey(mapId, assetIdCandidate);

    if (scene.textures.exists(textureKey)) {
      return textureKey;
    }
  }

  return ensureFallbackObstacleTexture(scene);
}

function getObstacleTileTextureKey(
  scene: Phaser.Scene,
  mapId: string,
  assetId: string,
  row: number,
  column: number,
) {
  for (const assetIdCandidate of getAssetIdCandidates(assetId)) {
    const tileTextureKey = getAssetTileTextureKey(mapId, assetIdCandidate, row, column);

    if (scene.textures.exists(tileTextureKey)) {
      return tileTextureKey;
    }
  }

  return null;
}

function getObstaclePreviewTextureKey(
  scene: Phaser.Scene,
  mapId: string,
  obstacle: ObstacleDefinition,
) {
  if (!obstacle.previewTilePath) {
    return null;
  }

  for (const assetIdCandidate of getAssetIdCandidates(obstacle.assetId)) {
    const textureKey = getAssetFileTextureKey(
      mapId,
      assetIdCandidate,
      obstacle.previewTilePath,
    );

    if (scene.textures.exists(textureKey)) {
      return textureKey;
    }
  }

  return null;
}

function getObstacleBounds(obstacle: ObstacleDefinition) {
  return {
    minX: obstacle.x - obstacle.width / 2,
    maxX: obstacle.x + obstacle.width / 2,
    minY: obstacle.y - obstacle.height / 2,
    maxY: obstacle.y + obstacle.height / 2,
  };
}

function rangesOverlap(minA: number, maxA: number, minB: number, maxB: number) {
  return Math.min(maxA, maxB) - Math.max(minA, minB) > ADJACENCY_EPSILON;
}

function areSameVisualTileSet(
  obstacle: ObstacleDefinition,
  candidate: ObstacleDefinition,
) {
  return (
    candidate.rotation === 0 &&
    candidate.type === obstacle.type &&
    getNormalizedAssetId(candidate.assetId) === getNormalizedAssetId(obstacle.assetId)
  );
}

function areTouchingObstacles(
  obstacle: ObstacleDefinition,
  candidate: ObstacleDefinition,
) {
  const bounds = getObstacleBounds(obstacle);
  const candidateBounds = getObstacleBounds(candidate);
  const touchesHorizontally =
    (Math.abs(candidateBounds.maxX - bounds.minX) <= ADJACENCY_EPSILON ||
      Math.abs(candidateBounds.minX - bounds.maxX) <= ADJACENCY_EPSILON) &&
    rangesOverlap(bounds.minY, bounds.maxY, candidateBounds.minY, candidateBounds.maxY);
  const touchesVertically =
    (Math.abs(candidateBounds.maxY - bounds.minY) <= ADJACENCY_EPSILON ||
      Math.abs(candidateBounds.minY - bounds.maxY) <= ADJACENCY_EPSILON) &&
    rangesOverlap(bounds.minX, bounds.maxX, candidateBounds.minX, candidateBounds.maxX);

  return touchesHorizontally || touchesVertically;
}

function getConnectedObstacleGroup(
  obstacle: ObstacleDefinition,
  sectionObstacles: ObstacleDefinition[],
) {
  const group = new Set<ObstacleDefinition>();
  const stack = [obstacle];

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current || group.has(current)) {
      continue;
    }

    group.add(current);

    for (const candidate of sectionObstacles) {
      if (
        candidate === current ||
        group.has(candidate) ||
        !areSameVisualTileSet(obstacle, candidate) ||
        !areTouchingObstacles(current, candidate)
      ) {
        continue;
      }

      stack.push(candidate);
    }
  }

  return [...group];
}

function getObstacleGroupBounds(group: ObstacleDefinition[]) {
  return group.reduce(
    (bounds, obstacle) => {
      const obstacleBounds = getObstacleBounds(obstacle);

      return {
        minX: Math.min(bounds.minX, obstacleBounds.minX),
        maxX: Math.max(bounds.maxX, obstacleBounds.maxX),
        minY: Math.min(bounds.minY, obstacleBounds.minY),
        maxY: Math.max(bounds.maxY, obstacleBounds.maxY),
      };
    },
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
}

function getAutotilePosition(
  obstacle: ObstacleDefinition,
  sectionObstacles: ObstacleDefinition[],
) {
  if (obstacle.rotation !== 0) {
    return { row: 2, column: 2 };
  }

  const obstacleBounds = getObstacleBounds(obstacle);
  const groupBounds = getObstacleGroupBounds(
    getConnectedObstacleGroup(obstacle, sectionObstacles),
  );
  const row =
    obstacleBounds.minY <= groupBounds.minY + ADJACENCY_EPSILON
      ? 1
      : obstacleBounds.maxY >= groupBounds.maxY - ADJACENCY_EPSILON
        ? 3
        : 2;
  const column =
    obstacleBounds.minX <= groupBounds.minX + ADJACENCY_EPSILON
      ? 1
      : obstacleBounds.maxX >= groupBounds.maxX - ADJACENCY_EPSILON
        ? 3
        : 2;

  return { row, column };
}

function createTiledObstacle(
  scene: Phaser.Scene,
  obstacle: ObstacleDefinition,
  sectionObstacles: ObstacleDefinition[],
  sectionIndex: number,
  worldX: number,
  worldY: number,
  mapId: string,
  physicsType: ObstacleType = obstacle.type,
) {
  const isHookable = HOOKABLE_OBSTACLE_TYPES.has(obstacle.type);
  const { row, column } = getAutotilePosition(obstacle, sectionObstacles);
  const textureKey = getObstacleTileTextureKey(scene, mapId, obstacle.assetId, row, column);

  if (!textureKey) {
    return null;
  }

  const rotationRad = Phaser.Math.DegToRad(obstacle.rotation);
  const body = attachObstaclePhysicsData(
    Matter.Bodies.rectangle(
      worldX,
      worldY,
      obstacle.width,
      obstacle.height,
      {
        ...createStaticBodyOptions(physicsType, obstacle.id),
        angle: rotationRad,
      },
    ),
    physicsType,
    obstacle.id,
  );
  const image = scene.add
    .image(worldX, worldY, textureKey)
    .setDisplaySize(obstacle.width, obstacle.height)
    .setRotation(rotationRad)
    .setDepth(5);

  image.setData('matterBody', body);
  markObstacleObject(image, obstacle, isHookable);

  return {
    definition: obstacle,
    sectionIndex,
    worldX,
    worldY,
    isHookable,
    body,
    gameObject: image,
  } satisfies CreatedLevelObstacle;
}

function createStaticObstacle(
  scene: Phaser.Scene,
  obstacle: ObstacleDefinition,
  sectionObstacles: ObstacleDefinition[],
  sectionIndex: number,
  worldX: number,
  worldY: number,
  mapId: string,
  textureKey: string,
) {
  const previewTextureKey = getObstaclePreviewTextureKey(scene, mapId, obstacle);
  const physicsType =
    obstacle.type === 'slope' && !isTriangleSlopeObstacle(obstacle) ? 'normal' : obstacle.type;

  if (previewTextureKey) {
    if (obstacle.type === 'slope' && isTriangleSlopeObstacle(obstacle)) {
      return createSlopeObstacle(
        scene,
        obstacle,
        sectionObstacles,
        sectionIndex,
        worldX,
        worldY,
        previewTextureKey,
      );
    }

    return createSingleTextureObstacle(
      scene,
      obstacle,
      sectionIndex,
      worldX,
      worldY,
      previewTextureKey,
      physicsType,
    );
  }

  const tiledObstacle = createTiledObstacle(
    scene,
    obstacle,
    sectionObstacles,
    sectionIndex,
    worldX,
    worldY,
    mapId,
    physicsType,
  );

  if (tiledObstacle) {
    return tiledObstacle;
  }

  return createSingleTextureObstacle(
    scene,
    obstacle,
    sectionIndex,
    worldX,
    worldY,
    textureKey,
    physicsType,
  );
}

function isTriangleSlopeObstacle(obstacle: ObstacleDefinition) {
  const assetId = getNormalizedAssetId(obstacle.assetId).toLowerCase();
  const previewTilePath = obstacle.previewTilePath?.toLowerCase() ?? '';

  return assetId === 'sikmej' || previewTilePath.startsWith('sikmej-');
}

function isSlopeSupportObstacle(obstacle: ObstacleDefinition) {
  return obstacle.type === 'normal' && obstacle.rotation === 0;
}

function hasHorizontalSlopeSupport(
  obstacle: ObstacleDefinition,
  sectionObstacles: ObstacleDefinition[],
) {
  const obstacleBounds = getObstacleBounds(obstacle);

  return sectionObstacles.some((candidate) => {
    if (candidate.id === obstacle.id || !isSlopeSupportObstacle(candidate)) {
      return false;
    }

    const candidateBounds = getObstacleBounds(candidate);
    const touchesLeft = Math.abs(candidateBounds.maxX - obstacleBounds.minX) <= ADJACENCY_EPSILON;
    const touchesRight = Math.abs(candidateBounds.minX - obstacleBounds.maxX) <= ADJACENCY_EPSILON;

    return (
      (touchesLeft || touchesRight) &&
      rangesOverlap(obstacleBounds.minY, obstacleBounds.maxY, candidateBounds.minY, candidateBounds.maxY)
    );
  });
}

function createSingleTextureObstacle(
  scene: Phaser.Scene,
  obstacle: ObstacleDefinition,
  sectionIndex: number,
  worldX: number,
  worldY: number,
  textureKey: string,
  physicsType: ObstacleType = obstacle.type,
) {
  const isHookable = HOOKABLE_OBSTACLE_TYPES.has(obstacle.type);
  const rotationRad = Phaser.Math.DegToRad(obstacle.rotation);
  const image = scene.add
    .image(worldX, worldY, textureKey)
    .setDisplaySize(obstacle.width, obstacle.height)
    .setRotation(rotationRad)
    .setDepth(5);
  const body = attachObstaclePhysicsData(
    Matter.Bodies.rectangle(
      worldX,
      worldY,
      obstacle.width,
      obstacle.height,
      {
        ...createStaticBodyOptions(physicsType, obstacle.id),
        angle: rotationRad,
      },
    ),
    physicsType,
    obstacle.id,
  );

  image.setData('matterBody', body);
  markObstacleObject(image, obstacle, isHookable);

  return {
    definition: obstacle,
    sectionIndex,
    worldX,
    worldY,
    isHookable,
    body,
    gameObject: image,
  } satisfies CreatedLevelObstacle;
}

function getFallbackSlopeColliderVertices(obstacle: ObstacleDefinition) {
  const width = obstacle.width;
  const height = obstacle.height;
  const previewTilePath = obstacle.previewTilePath?.toLowerCase() ?? '';
  const isFlippedVertically = previewTilePath.includes('naopak');
  const leansLeft = previewTilePath.includes('levo');

  if (isFlippedVertically && leansLeft) {
    return [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: 0, y: height },
    ];
  }

  if (isFlippedVertically) {
    return [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
    ];
  }

  if (leansLeft) {
    return [
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ];
  }

  return [
    { x: 0, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
}

function getCrossProduct(
  origin: ColliderPoint,
  a: ColliderPoint,
  b: ColliderPoint,
) {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

function getConvexHull(points: ColliderPoint[]) {
  const uniquePoints = [...new Map(
    points.map((point) => [`${point.x.toFixed(3)}:${point.y.toFixed(3)}`, point]),
  ).values()].sort((a, b) => a.x - b.x || a.y - b.y);

  if (uniquePoints.length <= 3) {
    return uniquePoints;
  }

  const lower: ColliderPoint[] = [];

  for (const point of uniquePoints) {
    while (
      lower.length >= 2 &&
      getCrossProduct(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    ) {
      lower.pop();
    }

    lower.push(point);
  }

  const upper: ColliderPoint[] = [];

  for (let index = uniquePoints.length - 1; index >= 0; index -= 1) {
    const point = uniquePoints[index];

    while (
      upper.length >= 2 &&
      getCrossProduct(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    ) {
      upper.pop();
    }

    upper.push(point);
  }

  lower.pop();
  upper.pop();

  return [...lower, ...upper];
}

function getAlphaColliderVertices(
  scene: Phaser.Scene,
  textureKey: string,
  obstacle: ObstacleDefinition,
) {
  const cacheKey = `${textureKey}:${obstacle.width}:${obstacle.height}`;
  const cachedVertices = alphaColliderVerticesCache.get(cacheKey);

  if (cachedVertices) {
    return cloneColliderPoints(cachedVertices);
  }

  const frame = scene.textures.getFrame(textureKey);

  if (!frame) {
    const fallbackVertices = getFallbackSlopeColliderVertices(obstacle);

    alphaColliderVerticesCache.set(cacheKey, cloneColliderPoints(fallbackVertices));
    return fallbackVertices;
  }

  const points: ColliderPoint[] = [];
  const textureWidth = Math.max(1, Math.floor(frame.cutWidth));
  const textureHeight = Math.max(1, Math.floor(frame.cutHeight));

  for (let y = 0; y < textureHeight; y += 1) {
    for (let x = 0; x < textureWidth; x += 1) {
      if (scene.textures.getPixelAlpha(x, y, textureKey) <= COLLIDER_ALPHA_THRESHOLD) {
        continue;
      }

      const left = (x / textureWidth) * obstacle.width;
      const right = ((x + 1) / textureWidth) * obstacle.width;
      const top = (y / textureHeight) * obstacle.height;
      const bottom = ((y + 1) / textureHeight) * obstacle.height;

      points.push(
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
      );
    }
  }

  const hull = getConvexHull(points);

  const colliderVertices =
    hull.length >= 3 ? hull : getFallbackSlopeColliderVertices(obstacle);

  alphaColliderVerticesCache.set(cacheKey, cloneColliderPoints(colliderVertices));

  return colliderVertices;
}

function getSlopeDownhillFromBody(body: Matter.Body): Matter.Vector {
  const vertices = body.vertices ?? [];
  const slopedEdge = vertices
    .map((vertex, index) => {
      const nextVertex = vertices[(index + 1) % vertices.length];
      const deltaX = nextVertex.x - vertex.x;
      const deltaY = nextVertex.y - vertex.y;

      return {
        start: vertex,
        end: nextVertex,
        deltaX,
        deltaY,
      };
    })
    .filter((edge) => Math.abs(edge.deltaX) > 1 && Math.abs(edge.deltaY) > 1)
    .sort((a, b) => Math.abs(b.deltaX) - Math.abs(a.deltaX))[0];

  if (!slopedEdge) {
    return { x: 1, y: 0 };
  }

  const lowerPoint =
    slopedEdge.start.y > slopedEdge.end.y ? slopedEdge.start : slopedEdge.end;
  const upperPoint =
    lowerPoint === slopedEdge.start ? slopedEdge.end : slopedEdge.start;
  const deltaX = lowerPoint.x - upperPoint.x;
  const deltaY = lowerPoint.y - upperPoint.y;
  const length = Math.hypot(deltaX, deltaY) || 1;

  return {
    x: deltaX / length,
    y: deltaY / length,
  };
}

function createSlopeObstacle(
  scene: Phaser.Scene,
  obstacle: ObstacleDefinition,
  sectionObstacles: ObstacleDefinition[],
  sectionIndex: number,
  worldX: number,
  worldY: number,
  textureKey: string,
) {
  const isHookable = HOOKABLE_OBSTACLE_TYPES.has(obstacle.type);
  const rotationRad = Phaser.Math.DegToRad(obstacle.rotation);
  const matterBody = Matter.Bodies.fromVertices(
    0,
    0,
    [getAlphaColliderVertices(scene, textureKey, obstacle)],
    createStaticBodyOptions(obstacle.type, obstacle.id),
    true,
    0.01,
    10,
  );
  const targetMinX = worldX - obstacle.width / 2;
  const targetMinY = worldY - obstacle.height / 2;

  Matter.Body.translate(matterBody, {
    x: targetMinX - matterBody.bounds.min.x,
    y: targetMinY - matterBody.bounds.min.y,
  });

  if (rotationRad !== 0) {
    const offsetX = matterBody.position.x - worldX;
    const offsetY = matterBody.position.y - worldY;
    const cos = Math.cos(rotationRad);
    const sin = Math.sin(rotationRad);

    Matter.Body.rotate(matterBody, rotationRad);
    Matter.Body.setPosition(matterBody, {
      x: worldX + offsetX * cos - offsetY * sin,
      y: worldY + offsetX * sin + offsetY * cos,
    });
  }

  const image = scene.add
    .image(worldX, worldY, textureKey)
    .setDisplaySize(obstacle.width, obstacle.height)
    .setRotation(rotationRad)
    .setDepth(5);

  matterBody.label = `obstacle:${obstacle.type}:${obstacle.id}`;
  const slopeDownhill = getSlopeDownhillFromBody(matterBody);
  const standableSlope = hasHorizontalSlopeSupport(obstacle, sectionObstacles);

  image.setData('matterBody', matterBody);
  image.setData('slopeDirection', Math.sign(slopeDownhill.x));
  setObstaclePhysicsData(matterBody, {
    obstacleId: obstacle.id,
    obstacleType: obstacle.type,
    slopeDownhill,
    standableSlope,
  });

  markObstacleObject(image, obstacle, isHookable);

  return {
    definition: obstacle,
    sectionIndex,
    worldX,
    worldY,
    isHookable,
    body: matterBody,
    gameObject: image,
  } satisfies CreatedLevelObstacle;
}

function createSectionZeroGround(scene: Phaser.Scene, map: LoadedMapData) {
  const ground: ObstacleDefinition = {
    id: GROUND_OBSTACLE_ID,
    type: 'normal',
    assetId: 'generated-ground',
    x: map.totalWidth / 2,
    y: map.definition.sectionHeight + GROUND_HEIGHT / 2,
    width: map.totalWidth,
    height: GROUND_HEIGHT,
    rotation: 0,
  };

  const body = attachObstaclePhysicsData(
    Matter.Bodies.rectangle(
      ground.x,
      ground.y,
      ground.width,
      ground.height,
      createStaticBodyOptions(ground.type, ground.id),
    ),
    ground.type,
    ground.id,
  );
  const zone = scene.add.zone(ground.x, ground.y, ground.width, ground.height);

  zone.setData('obstacleId', ground.id);
  zone.setData('obstacleType', ground.type);
  zone.setData('assetId', ground.assetId);
  zone.setData('isHookable', true);
  zone.setData('matterBody', body);

  return {
    definition: ground,
    sectionIndex: 0,
    worldX: ground.x,
    worldY: ground.y,
    isHookable: true,
    body,
    gameObject: zone,
  } satisfies CreatedLevelObstacle;
}

function createWorldBoundaries(map: LoadedMapData) {
  const height = map.definition.sectionHeight + WORLD_BOUNDARY_THICKNESS * 2;
  const centerY = map.definition.sectionHeight / 2;
  const left = Matter.Bodies.rectangle(
    -WORLD_BOUNDARY_THICKNESS / 2,
    centerY,
    WORLD_BOUNDARY_THICKNESS,
    height,
    createStaticBodyOptions('normal', 'world-left'),
  );
  const right = Matter.Bodies.rectangle(
    map.definition.sectionWidth + WORLD_BOUNDARY_THICKNESS / 2,
    centerY,
    WORLD_BOUNDARY_THICKNESS,
    height,
    createStaticBodyOptions('normal', 'world-right'),
  );

  attachObstaclePhysicsData(left, 'normal', 'world-left');
  attachObstaclePhysicsData(right, 'normal', 'world-right');

  return [left, right];
}

export function createLevel(
  scene: Phaser.Scene,
  engine: Matter.Engine,
  map: LoadedMapData,
  activeSectionIndex = 0,
): CreatedLevel {
  const mapId = map.definition.id;
  const activeSection =
    map.sections.find((section) => section.index === activeSectionIndex) ?? map.sections[0];
  const obstacles: CreatedLevelObstacle[] =
    activeSection.index === 0 ? [createSectionZeroGround(scene, map)] : [];
  scene.cameras.main.setBounds(0, 0, map.definition.sectionWidth, map.definition.sectionHeight);
  scene.cameras.main.setScroll(0, 0);

  const backgroundTextureKey = getBackgroundTextureKey(mapId, activeSection.index);

  const background = scene.add
    .image(
      map.definition.sectionWidth / 2,
      map.definition.sectionHeight / 2,
      backgroundTextureKey,
    )
    .setDisplaySize(map.definition.sectionWidth, map.definition.sectionHeight)
    .setDepth(-100);

  for (const obstacle of activeSection.obstacles) {
    const worldX = obstacle.x;
    const worldY = obstacle.y;
    const textureKey = getObstacleTextureKey(scene, mapId, obstacle.assetId);

    obstacles.push(
      createStaticObstacle(
        scene,
        obstacle,
        activeSection.obstacles,
        activeSection.index,
        worldX,
        worldY,
        mapId,
        textureKey,
      ),
    );
  }

  const physicsBodies = [
    ...createWorldBoundaries(map),
    ...obstacles.map((obstacle) => obstacle.body),
  ];

  Matter.Composite.add(engine.world, physicsBodies);

  return {
    activeSectionIndex: activeSection.index,
    background,
    map,
    obstacles,
    physicsBodies,
  };
}

export function destroyLevel(engine: Matter.Engine, level: CreatedLevel) {
  level.background.destroy();
  Matter.Composite.remove(engine.world, level.physicsBodies, true);

  for (const obstacle of level.obstacles) {
    obstacle.gameObject.destroy();
  }
}
