import { formatTimeMs } from './formatTime';

type GameHudProps = {
  elapsedMs: number;
  playerName: string;
  onBackToMenu: () => void;
};

export function GameHud({ elapsedMs, playerName, onBackToMenu }: GameHudProps) {
  return (
    <div className="game-hud">
      <div>
        <span className="hud-label">Hráč</span>
        <strong>{playerName}</strong>
      </div>

      <div>
        <span className="hud-label">Čas</span>
        <strong>{formatTimeMs(elapsedMs)}</strong>
      </div>

      <button type="button" className="secondary-button" onClick={onBackToMenu}>
        Menu
      </button>
    </div>
  );
}