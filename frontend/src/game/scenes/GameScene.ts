import Phaser from 'phaser';
import Matter from 'matter-js';
import i18n from '../../i18n/i18n';
import { PLAYER_CONFIG } from '../gameplayConfig';
import { AVAILABLE_MAPS } from '../map/availableMaps';
import {
  createLevel,
  destroyLevel,
  getObstaclePhysicsData,
  preloadMapAssets,
} from '../map/createLevel';
import { loadMapData, loadMapSection } from '../map/loadMapData';
import type { CreatedLevel, LoadedMapData, LoadedMapSection } from '../map/mapTypes';
import { Player } from '../objects/Player';

export class GameScene extends Phaser.Scene {
  private activeSectionIndex = 0;
  private level?: CreatedLevel;
  private mapData?: LoadedMapData;
  private player?: Player;
  private engine?: Matter.Engine;
  private physicsAccumulatorMs = 0;
  private sectionTransitionInProgress = false;
  private isFinished = false;
  private readonly sectionLoadPromises = new Map<number, Promise<boolean>>();

  constructor() {
    super('GameScene');
  }

  async create() {
    const selectedMapId = this.registry.get('selectedMapId') as string | undefined;
    const selectedMap =
      AVAILABLE_MAPS.find((map) => map.id === selectedMapId) ?? AVAILABLE_MAPS[0];

    try {
      this.engine = Matter.Engine.create({
        enableSleeping: false,
        positionIterations: 8,
        velocityIterations: 6,
        constraintIterations: 2,
        gravity: {
          x: 0,
          y: 1,
          scale: 0.001,
        },
      });
      const mapData = await loadMapData(selectedMap);
      await preloadMapAssets(this, mapData);

      this.mapData = mapData;
      this.activeSectionIndex = 0;
      this.level = createLevel(this, this.engine, mapData, this.activeSectionIndex);
      this.player = new Player(
        this,
        this.engine.world,
        PLAYER_CONFIG.spawnX,
        mapData.definition.sectionHeight - PLAYER_CONFIG.groundOffset - PLAYER_CONFIG.height / 2,
      );
      this.updatePlayerSlopeBodies();
      void this.prefetchAdjacentSections();

      Matter.Events.on(this.engine, 'collisionStart', this.handleCollisionStart);
      Matter.Events.on(this.engine, 'collisionActive', this.handleCollisionActive);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    } catch {
      const message = i18n.t('errors.mapLoadFailed');

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
    if (!this.player || !this.mapData || !this.engine || this.isFinished) {
      return;
    }

    const fixedStepMs = PLAYER_CONFIG.fixedPhysicsStepMs;
    const maxAccumulatedMs = fixedStepMs * PLAYER_CONFIG.maxPhysicsStepsPerFrame;

    this.physicsAccumulatorMs = Math.min(
      this.physicsAccumulatorMs + Math.min(delta, maxAccumulatedMs),
      maxAccumulatedMs,
    );

    while (this.physicsAccumulatorMs >= fixedStepMs && !this.isFinished) {
      this.player.preparePhysicsStep(fixedStepMs);
      Matter.Engine.update(this.engine, fixedStepMs);
      this.player.finishPhysicsStep(fixedStepMs);
      this.physicsAccumulatorMs -= fixedStepMs;
    }

    this.player.updateVisual();
    this.handleSectionTransition();
  }

  private readonly handleCollisionStart = (event: Matter.IEventCollision<Matter.Engine>) => {
    this.handleCollisionEvent(event, true);
  };

  private readonly handleCollisionActive = (event: Matter.IEventCollision<Matter.Engine>) => {
    this.handleCollisionEvent(event, false);
  };

  private handleCollisionEvent(
    event: Matter.IEventCollision<Matter.Engine>,
    started: boolean,
  ) {
    if (!this.player || this.isFinished) {
      return;
    }

    for (const pair of event.pairs) {
      const collision = pair.collision;
      const playerIsBodyA = collision.parentA === this.player.body;
      const playerIsBodyB = collision.parentB === this.player.body;

      if (!playerIsBodyA && !playerIsBodyB) {
        continue;
      }

      const obstacleBody = playerIsBodyA ? collision.parentB : collision.parentA;
      const obstacle = getObstaclePhysicsData(obstacleBody);

      if (obstacle?.obstacleType === 'finish') {
        this.finishRun();
        return;
      }

      this.player.recordContact(pair, started);
    }
  }

  private handleSectionTransition() {
    if (!this.player || !this.mapData || !this.level) {
      return;
    }

    const sectionHeight = this.mapData.definition.sectionHeight;
    const halfPlayerHeight = PLAYER_CONFIG.height / 2;
    const playerY = this.player.y;
    const transitionSnapshot = {
      x: this.player.x,
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
    if (!this.player || !this.mapData || !this.level || !this.engine) {
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
    if (!this.player || !this.mapData || !this.level || !this.engine) {
      return;
    }

    const nextPlayerX = Phaser.Math.Clamp(
      snapshot.x,
      PLAYER_CONFIG.width / 2,
      this.mapData.definition.sectionWidth - PLAYER_CONFIG.width / 2,
    );

    destroyLevel(this.engine, this.level);
    this.activeSectionIndex = nextSectionIndex;
    this.level = createLevel(this, this.engine, this.mapData, this.activeSectionIndex);
    this.updatePlayerSlopeBodies();
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

  private finishRun() {
    if (this.isFinished) {
      return;
    }

    this.isFinished = true;
    this.player?.stop();

    const onFinish = this.registry.get('onFinish') as
      | ((finishedAtMs: number) => void)
      | undefined;
    onFinish?.(Date.now());
  }

  private updatePlayerSlopeBodies() {
    if (!this.player || !this.level) {
      return;
    }

    this.player.setSlopeBodies(
      this.level.physicsBodies.filter(
        (body) => getObstaclePhysicsData(body)?.obstacleType === 'slope',
      ),
    );
  }

  private handleShutdown() {
    if (!this.engine) {
      return;
    }

    Matter.Events.off(this.engine, 'collisionStart', this.handleCollisionStart);
    Matter.Events.off(this.engine, 'collisionActive', this.handleCollisionActive);
    this.player?.destroy(this.engine.world);
    this.player = undefined;

    if (this.level) {
      destroyLevel(this.engine, this.level);
      this.level = undefined;
    }

    Matter.Engine.clear(this.engine);
    this.engine = undefined;
  }
}
