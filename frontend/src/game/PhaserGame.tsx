import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from './gameConfig';

type PhaserGameProps = {
  isPaused: boolean;
  mapId: string;
  onFinish: () => void;
};

export function PhaserGame({ isPaused, mapId, onFinish }: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const game = new Phaser.Game(
      createGameConfig(containerRef.current, mapId, () => onFinishRef.current()),
    );
    gameRef.current = game;

    return () => {
      gameRef.current = null;
      game.destroy(true);
    };
  }, [mapId]);

  useEffect(() => {
    const game = gameRef.current;

    if (!game) {
      return;
    }

    if (isPaused) {
      game.scene.pause('GameScene');
    } else {
      game.scene.resume('GameScene');
    }
  }, [isPaused]);

  return <div ref={containerRef} className="phaser-game" />;
}
