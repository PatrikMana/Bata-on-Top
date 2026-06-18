import Phaser from 'phaser';
import { PLAYER_CONFIG } from '../gameplayConfig';
import { AVAILABLE_MAPS } from '../map/availableMaps';
import { createLevel, destroyLevel, preloadMapAssets } from '../map/createLevel';
import { loadMapData, loadMapSection } from '../map/loadMapData';
import type { CreatedLevel, LoadedMapData, LoadedMapSection, ObstacleType } from '../map/mapTypes';
import { Player } from '../objects/Player';

export class GameScene extends Phaser.Scene {
  private activeSectionIndex = 0;
  private level?: CreatedLevel;
  private mapData?: LoadedMapData;
  private player?: Player;
  private sectionTransitionInProgress = false;
  private readonly sectionLoadPromises = new Map<number, Promise<boolean>>();

  constructor() {
    super('GameScene');
  }

  async create() {
    const selectedMapId = this.registry.get('selectedMapId') as string | undefined;
    const selectedMap =
      AVAILABLE_MAPS.find((map) => map.id === selectedMapId) ?? AVAILABLE_MAPS[0];

    try {
      const mapData = await loadMapData(selectedMap);
      await preloadMapAssets(this, mapData);

      this.mapData = mapData;
      this.activeSectionIndex = 0;
      this.level = createLevel(this, mapData, this.activeSectionIndex);
      this.player = new Player(
        this,
        PLAYER_CONFIG.spawnX,
        mapData.definition.sectionHeight - PLAYER_CONFIG.groundOffset - PLAYER_CONFIG.height / 2,
      );
      void this.prefetchAdjacentSections();

      this.matter.world.on('collisionstart', this.handleCollisionActive, this);
      this.matter.world.on('collisionactive', this.handleCollisionActive, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Nepodařilo se načíst mapu.';

      this.add
        .text(40, 40, message, {
          color: '#ffffff',
          fontFamily: 'Pixelify Sans, Courier New, monospace',
          fontSize: '28px',
          wordWrap: { width: 900 },
        })
        .setScrollFactor(0);
    }
  }

  update(_time: number, delta: number) {
    if (!this.player || !this.mapData) {
      return;
    }

    this.player.update(delta, this.mapData.definition.sectionWidth);
    this.handleSectionTransition();
  }

  private handleCollisionActive(event: Phaser.Physics.Matter.Events.CollisionStartEvent) {
    if (!this.player) {
      return;
    }

    for (const pair of event.pairs) {
      const playerBody = this.getPlayerBodyFromPair(pair);

      if (!playerBody) {
        continue;
      }

      const obstacleBody = playerBody === pair.bodyA ? pair.bodyB : pair.bodyA;
      const obstacleType = this.getObstacleTypeFromBody(obstacleBody);

      if (obstacleType) {
        this.player.recordObstacleContact(obstacleType, obstacleBody);
      }
    }
  }

  private getPlayerBodyFromPair(pair: Phaser.Types.Physics.Matter.MatterCollisionPair) {
    if (pair.bodyA.label === 'player') {
      return pair.bodyA;
    }

    if (pair.bodyB.label === 'player') {
      return pair.bodyB;
    }

    return null;
  }

  private getObstacleTypeFromBody(body: MatterJS.BodyType): ObstacleType | null {
    const [, obstacleType] = body.label.split(':');

    if (
      obstacleType === 'normal' ||
      obstacleType === 'ice' ||
      obstacleType === 'slope' ||
      obstacleType === 'finish' ||
      obstacleType === 'danger'
    ) {
      return obstacleType;
    }

    return null;
  }

  private handleSectionTransition() {
    if (!this.player || !this.mapData || !this.level) {
      return;
    }

    const sectionHeight = this.mapData.definition.sectionHeight;
    const halfPlayerHeight = PLAYER_CONFIG.height / 2;
    const playerY = this.player.gameObject.y;
    const transitionSnapshot = {
      x: this.player.gameObject.x,
      velocity: this.player.getVelocity(),
    };

    if (playerY < -halfPlayerHeight) {
      void this.switchSectionIfAvailable(
        this.activeSectionIndex + 1,
        sectionHeight + playerY,
        transitionSnapshot,
      );
      return;
    }

    if (playerY > sectionHeight + halfPlayerHeight && this.activeSectionIndex > 0) {
      void this.switchSectionIfAvailable(
        this.activeSectionIndex - 1,
        playerY - sectionHeight,
        transitionSnapshot,
      );
    }
  }

  private async switchSectionIfAvailable(
    nextSectionIndex: number,
    nextPlayerY: number,
    snapshot: { x: number; velocity: { x: number; y: number } },
  ) {
    if (!this.player || !this.mapData || !this.level) {
      return;
    }

    if (this.sectionTransitionInProgress) {
      return;
    }

    this.sectionTransitionInProgress = true;

    try {
      const sectionLoaded = await this.ensureSectionLoaded(nextSectionIndex);

      if (!sectionLoaded || !this.player || !this.mapData || !this.level) {
        return;
      }

      this.switchSection(nextSectionIndex, nextPlayerY, snapshot);
    } finally {
      this.sectionTransitionInProgress = false;
    }
  }

  private switchSection(
    nextSectionIndex: number,
    nextPlayerY: number,
    snapshot: { x: number; velocity: { x: number; y: number } },
  ) {
    if (!this.player || !this.mapData || !this.level) {
      return;
    }

    const nextPlayerX = Phaser.Math.Clamp(
      snapshot.x,
      PLAYER_CONFIG.width / 2,
      this.mapData.definition.sectionWidth - PLAYER_CONFIG.width / 2,
    );

    destroyLevel(this, this.level);
    this.activeSectionIndex = nextSectionIndex;
    this.level = createLevel(this, this.mapData, this.activeSectionIndex);
    this.player.setPositionAndVelocity(nextPlayerX, nextPlayerY, snapshot.velocity);
    void this.prefetchAdjacentSections();
  }

  private async ensureSectionLoaded(sectionIndex: number) {
    if (!this.mapData) {
      return false;
    }

    if (this.mapData.sections.some((section) => section.index === sectionIndex)) {
      return true;
    }

    const pendingLoad = this.sectionLoadPromises.get(sectionIndex);

    if (pendingLoad) {
      return pendingLoad;
    }

    const loadPromise = this.loadAndRegisterSection(sectionIndex);

    this.sectionLoadPromises.set(sectionIndex, loadPromise);

    try {
      return await loadPromise;
    } finally {
      this.sectionLoadPromises.delete(sectionIndex);
    }
  }

  private async loadAndRegisterSection(sectionIndex: number) {
    if (!this.mapData) {
      return false;
    }

    let nextSection: LoadedMapSection;

    try {
      nextSection = await loadMapSection(this.mapData.definition, sectionIndex);
    } catch {
      return false;
    }

    const nextAssetIds = new Set(this.mapData.assetIds);

    for (const obstacle of nextSection.obstacles) {
      nextAssetIds.add(obstacle.assetId);
    }

    const sectionCount = Math.max(this.mapData.definition.sectionCount, sectionIndex + 1);

    this.mapData = {
      ...this.mapData,
      definition: {
        ...this.mapData.definition,
        sectionCount,
      },
      totalHeight: this.mapData.definition.sectionHeight * sectionCount,
      assetIds: [...nextAssetIds],
      sections: [...this.mapData.sections, nextSection],
    };

    await preloadMapAssets(this, this.mapData);

    return true;
  }

  private async prefetchAdjacentSections() {
    const adjacentSections = [
      this.activeSectionIndex + 1,
      this.activeSectionIndex - 1,
    ].filter((sectionIndex) => sectionIndex >= 0);

    for (const sectionIndex of adjacentSections) {
      await this.ensureSectionLoaded(sectionIndex);
    }
  }

  private handleShutdown() {
    this.matter.world.off('collisionstart', this.handleCollisionActive, this);
    this.matter.world.off('collisionactive', this.handleCollisionActive, this);
    this.player?.destroy();
    this.player = undefined;

    if (this.level) {
      destroyLevel(this, this.level);
      this.level = undefined;
    }
  }
}
