import { formatClockTimeMs } from './formatTime';

type GameHudProps = {
  elapsedMs: number;
  playerName: string;
};

export function GameHud({ elapsedMs, playerName }: GameHudProps) {
  return (
    <div className="game-hud" aria-live="polite">
      <strong>{playerName}</strong>
      <strong>{formatClockTimeMs(elapsedMs)}</strong>
    </div>
  );
}
