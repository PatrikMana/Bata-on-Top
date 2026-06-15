import Phaser from 'phaser';
import { PLAYER_CONFIG } from '../gameplayConfig';
import { AVAILABLE_MAPS } from '../map/availableMaps';
import { createLevel, destroyLevel, preloadMapAssets } from '../map/createLevel';
import { loadMapData } from '../map/loadMapData';
import type { CreatedLevel, LoadedMapData, ObstacleType } from '../map/mapTypes';
import { Player } from '../objects/Player';

export class GameScene extends Phaser.Scene {
  private activeSectionIndex = 0;
  private level?: CreatedLevel;
  private mapData?: LoadedMapData;
  private player?: Player;

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

    if (playerY < -halfPlayerHeight && this.activeSectionIndex < this.mapData.definition.sectionCount - 1) {
      this.switchSection(this.activeSectionIndex + 1, sectionHeight + playerY);
      return;
    }

    if (playerY > sectionHeight + halfPlayerHeight && this.activeSectionIndex > 0) {
      this.switchSection(this.activeSectionIndex - 1, playerY - sectionHeight);
    }
  }

  private switchSection(nextSectionIndex: number, nextPlayerY: number) {
    if (!this.player || !this.mapData || !this.level) {
      return;
    }

    const velocity = this.player.getVelocity();
    const nextPlayerX = Phaser.Math.Clamp(
      this.player.gameObject.x,
      PLAYER_CONFIG.width / 2,
      this.mapData.definition.sectionWidth - PLAYER_CONFIG.width / 2,
    );

    destroyLevel(this, this.level);
    this.activeSectionIndex = nextSectionIndex;
    this.level = createLevel(this, this.mapData, this.activeSectionIndex);
    this.player.setPositionAndVelocity(nextPlayerX, nextPlayerY, velocity);
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
