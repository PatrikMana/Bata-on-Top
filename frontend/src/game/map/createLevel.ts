import Phaser from 'phaser';
import { getMapAssetUrl } from './loadMapData';
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

export function getSectionWorldTop(map: LoadedMapData, sectionIndex: number) {
  return map.totalHeight - (sectionIndex + 1) * map.definition.sectionHeight;
}

export function getBackgroundTextureKey(mapId: string, sectionIndex: number) {
  return `map:${mapId}:section:${sectionIndex}:bg`;
}

export function getAssetTextureKey(mapId: string, assetId: string) {
  return `map:${mapId}:asset:${assetId}`;
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
  image: Phaser.Physics.Matter.Image,
  obstacle: ObstacleDefinition,
  isHookable: boolean,
) {
  image.setData('obstacleId', obstacle.id);
  image.setData('obstacleType', obstacle.type);
  image.setData('assetId', obstacle.assetId);
  image.setData('isHookable', isHookable);
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
    const key = getAssetTextureKey(mapId, assetId);
    obstacleAssetKeys.add(key);

    if (!scene.textures.exists(key)) {
      queuedAssets += 1;
      scene.load.image(key, getMapAssetUrl(mapId, assetId));
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
  const textureKey = getAssetTextureKey(mapId, assetId);

  if (scene.textures.exists(textureKey)) {
    return textureKey;
  }

  return ensureFallbackObstacleTexture(scene);
}

function createStaticObstacle(
  scene: Phaser.Scene,
  obstacle: ObstacleDefinition,
  sectionIndex: number,
  worldX: number,
  worldY: number,
  textureKey: string,
) {
  const isHookable = HOOKABLE_OBSTACLE_TYPES.has(obstacle.type);
  const image = scene.matter.add.image(worldX, worldY, textureKey, undefined, {
    isStatic: true,
    isSensor: obstacle.type === 'finish',
    label: `obstacle:${obstacle.type}:${obstacle.id}`,
  });

  image
    .setDisplaySize(obstacle.width, obstacle.height)
    .setRotation(Phaser.Math.DegToRad(obstacle.rotation));

  image.setBody(
    {
      type: 'rectangle',
      width: obstacle.width,
      height: obstacle.height,
    },
    {
      isStatic: true,
      isSensor: obstacle.type === 'finish',
      label: `obstacle:${obstacle.type}:${obstacle.id}`,
    },
  );
  image.setRotation(Phaser.Math.DegToRad(obstacle.rotation));

  markObstacleObject(image, obstacle, isHookable);

  return {
    definition: obstacle,
    sectionIndex,
    worldX,
    worldY,
    isHookable,
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

  const body = scene.matter.add.rectangle(ground.x, ground.y, ground.width, ground.height, {
    isStatic: true,
    label: `obstacle:${ground.type}:${ground.id}`,
  });
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
    gameObject: zone,
  } satisfies CreatedLevelObstacle;
}

export function createLevel(
  scene: Phaser.Scene,
  map: LoadedMapData,
  activeSectionIndex = 0,
): CreatedLevel {
  const mapId = map.definition.id;
  const activeSection =
    map.sections.find((section) => section.index === activeSectionIndex) ?? map.sections[0];
  const obstacles: CreatedLevelObstacle[] =
    activeSection.index === 0 ? [createSectionZeroGround(scene, map)] : [];

  scene.matter.world.setBounds(
    0,
    0,
    map.definition.sectionWidth,
    map.definition.sectionHeight,
    64,
    true,
    true,
    false,
    false,
  );
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
      createStaticObstacle(scene, obstacle, activeSection.index, worldX, worldY, textureKey),
    );
  }

  return {
    activeSectionIndex: activeSection.index,
    background,
    map,
    obstacles,
  };
}

export function destroyLevel(scene: Phaser.Scene, level: CreatedLevel) {
  level.background.destroy();

  for (const obstacle of level.obstacles) {
    const body = obstacle.gameObject.getData('matterBody') as MatterJS.BodyType | undefined;

    if (body) {
      scene.matter.world.remove(body);
    }

    obstacle.gameObject.destroy();
  }
}
