import Phaser from 'phaser';

export const PLAYER_ANIMATION_KEYS = {
  charge: 'player:charge',
  idle: 'player:idle',
  runLeft: 'player:run-left',
  runRight: 'player:run-right',
} as const;

export const PLAYER_TEXTURE_KEYS = {
  charge: 'player:texture:charge',
  idle: 'player:texture:idle',
  jumpLeft: 'player:texture:jump-left',
  jumpRight: 'player:texture:jump-right',
  runLeft: 'player:texture:run-left',
  runRight: 'player:texture:run-right',
} as const;

const PLAYER_ASSET_BASE_PATH = '/player';
const PLAYER_AIR_FRAME_COUNT = 5;

type SheetFrameConfig = {
  frames: FrameCrop[];
  frameCount: number;
  frameWidth: number;
  key: string;
};

type FrameCrop = {
  cropHeight: number;
  cropWidth: number;
  cropX: number;
  cropY: number;
};

const SHEET_FRAME_CONFIGS: SheetFrameConfig[] = [
  {
    key: PLAYER_TEXTURE_KEYS.idle,
    frameCount: 1,
    frameWidth: 1024,
    frames: [
      { cropX: 109, cropY: 204, cropWidth: 779, cropHeight: 1086 },
    ],
  },
  {
    key: PLAYER_TEXTURE_KEYS.charge,
    frameCount: 1,
    frameWidth: 1254,
    frames: [
      { cropX: 230, cropY: 193, cropWidth: 794, cropHeight: 868 },
    ],
  },
  {
    key: PLAYER_TEXTURE_KEYS.runLeft,
    frameCount: 5,
    frameWidth: 334,
    frames: [
      { cropX: 127, cropY: 305, cropWidth: 207, cropHeight: 306 },
      { cropX: 0, cropY: 306, cropWidth: 334, cropHeight: 306 },
      { cropX: 0, cropY: 306, cropWidth: 265, cropHeight: 310 },
      { cropX: 41, cropY: 305, cropWidth: 261, cropHeight: 298 },
      { cropX: 30, cropY: 305, cropWidth: 219, cropHeight: 306 },
    ],
  },
  {
    key: PLAYER_TEXTURE_KEYS.runRight,
    frameCount: 5,
    frameWidth: 334,
    frames: [
      { cropX: 56, cropY: 293, cropWidth: 265, cropHeight: 324 },
      { cropX: 46, cropY: 293, cropWidth: 271, cropHeight: 310 },
      { cropX: 73, cropY: 301, cropWidth: 197, cropHeight: 322 },
      { cropX: 5, cropY: 300, cropWidth: 259, cropHeight: 320 },
      { cropX: 31, cropY: 301, cropWidth: 213, cropHeight: 321 },
    ],
  },
  {
    key: PLAYER_TEXTURE_KEYS.jumpLeft,
    frameCount: 5,
    frameWidth: 334,
    frames: [
      { cropX: 79, cropY: 369, cropWidth: 201, cropHeight: 295 },
      { cropX: 57, cropY: 331, cropWidth: 240, cropHeight: 326 },
      { cropX: 76, cropY: 292, cropWidth: 204, cropHeight: 321 },
      { cropX: 79, cropY: 269, cropWidth: 190, cropHeight: 317 },
      { cropX: 62, cropY: 395, cropWidth: 202, cropHeight: 269 },
    ],
  },
  {
    key: PLAYER_TEXTURE_KEYS.jumpRight,
    frameCount: 5,
    frameWidth: 334,
    frames: [
      { cropX: 79, cropY: 381, cropWidth: 216, cropHeight: 299 },
      { cropX: 53, cropY: 310, cropWidth: 226, cropHeight: 342 },
      { cropX: 66, cropY: 266, cropWidth: 193, cropHeight: 338 },
      { cropX: 36, cropY: 248, cropWidth: 187, cropHeight: 316 },
      { cropX: 15, cropY: 380, cropWidth: 214, cropHeight: 301 },
    ],
  },
];

function getFrameName(frameIndex: number) {
  return `frame-${frameIndex}`;
}

function addCroppedFrames(scene: Phaser.Scene, config: SheetFrameConfig) {
  const texture = scene.textures.get(config.key);

  for (let frameIndex = 0; frameIndex < config.frameCount; frameIndex += 1) {
    const frameName = getFrameName(frameIndex);

    if (texture.has(frameName)) {
      continue;
    }

    const frame = config.frames[frameIndex];

    texture.add(
      frameName,
      0,
      frameIndex * config.frameWidth + frame.cropX,
      frame.cropY,
      frame.cropWidth,
      frame.cropHeight,
    );
  }
}

function createAnimation(
  scene: Phaser.Scene,
  key: string,
  textureKey: string,
  frameCount: number,
) {
  if (scene.anims.exists(key)) {
    return;
  }

  scene.anims.create({
    key,
    frames: Array.from({ length: frameCount }, (_, frameIndex) => ({
      key: textureKey,
      frame: getFrameName(frameIndex),
    })),
    frameRate: 10,
    repeat: -1,
  });
}

export function preloadPlayerAssets(scene: Phaser.Scene) {
  scene.load.image(PLAYER_TEXTURE_KEYS.charge, `${PLAYER_ASSET_BASE_PATH}/charge.png`);
  scene.load.image(PLAYER_TEXTURE_KEYS.idle, `${PLAYER_ASSET_BASE_PATH}/idle.png`);
  scene.load.image(PLAYER_TEXTURE_KEYS.jumpLeft, `${PLAYER_ASSET_BASE_PATH}/jump-left.png`);
  scene.load.image(PLAYER_TEXTURE_KEYS.jumpRight, `${PLAYER_ASSET_BASE_PATH}/jump-right.png`);
  scene.load.image(PLAYER_TEXTURE_KEYS.runLeft, `${PLAYER_ASSET_BASE_PATH}/run-left.png`);
  scene.load.image(PLAYER_TEXTURE_KEYS.runRight, `${PLAYER_ASSET_BASE_PATH}/run-right.png`);
}

export function createPlayerAnimations(scene: Phaser.Scene) {
  for (const config of SHEET_FRAME_CONFIGS) {
    addCroppedFrames(scene, config);
  }

  createAnimation(scene, PLAYER_ANIMATION_KEYS.charge, PLAYER_TEXTURE_KEYS.charge, 1);
  createAnimation(scene, PLAYER_ANIMATION_KEYS.runLeft, PLAYER_TEXTURE_KEYS.runLeft, 5);
  createAnimation(scene, PLAYER_ANIMATION_KEYS.runRight, PLAYER_TEXTURE_KEYS.runRight, 5);
}

export function getIdleFrame() {
  return getFrameName(0);
}

export function getJumpFrameIndex(velocityY: number) {
  if (velocityY < -11) {
    return 0;
  }

  if (velocityY < -4) {
    return 1;
  }

  if (velocityY < 3) {
    return 2;
  }

  if (velocityY < 10) {
    return 3;
  }

  return 4;
}

export function getJumpFrame(direction: -1 | 1, velocityY: number) {
  const rightFrameIndex = getJumpFrameIndex(velocityY);
  const frameIndex = direction === -1 ? PLAYER_AIR_FRAME_COUNT - 1 - rightFrameIndex : rightFrameIndex;

  return getFrameName(frameIndex);
}
