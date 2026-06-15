import Phaser from 'phaser';
import { AVAILABLE_MAPS } from '../map/availableMaps';
import { createLevel, preloadMapAssets } from '../map/createLevel';
import { loadMapData } from '../map/loadMapData';

export class GameScene extends Phaser.Scene {
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
      createLevel(this, mapData, 0);
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
}
