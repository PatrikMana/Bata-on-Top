import type { AvailableMap } from './availableMaps';

export type ObstacleType = 'normal' | 'ice' | 'slope' | 'finish' | 'danger';

export type ObstacleDefinition = {
  id: string;
  type: ObstacleType;
  assetId: string;
  previewTilePath?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type ObstaclesFile = {
  obstacles: ObstacleDefinition[];
};

export type LoadedMapSection = {
  index: number;
  backgroundUrl: string;
  obstaclesUrl: string;
  obstacles: ObstacleDefinition[];
};

export type LoadedMapData = {
  definition: AvailableMap;
  totalWidth: number;
  totalHeight: number;
  assetIds: string[];
  sections: LoadedMapSection[];
};

export type CreatedLevelObstacle = {
  definition: ObstacleDefinition;
  sectionIndex: number;
  worldX: number;
  worldY: number;
  isHookable: boolean;
  gameObject: Phaser.GameObjects.GameObject;
};

export type CreatedLevel = {
  activeSectionIndex: number;
  background: Phaser.GameObjects.Image;
  map: LoadedMapData;
  obstacles: CreatedLevelObstacle[];
};
