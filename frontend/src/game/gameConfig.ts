import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { PreloadScene } from './scenes/PreloadScene';

export function createGameConfig(
  parent: HTMLElement,
  mapId: string,
  onFinish: () => void,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#090909',
    physics: {
      default: 'matter',
      matter: {
        gravity: { x: 0, y: 1 },
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, PreloadScene, GameScene],
    callbacks: {
      postBoot(game) {
        game.registry.set('selectedMapId', mapId);
        game.registry.set('onFinish', onFinish);
      },
    },
  };
}
