import Phaser from 'phaser';
import { createPlayerAnimations, preloadPlayerAssets } from '../objects/playerAnimations';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    preloadPlayerAssets(this);
  }

  create() {
    createPlayerAnimations(this);
    this.scene.start('GameScene');
  }
}
