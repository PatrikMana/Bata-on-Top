import { formatTimeMs } from './formatTime';

type FinishScreenProps = {
  playerName: string;
  timeMs: number;
  onRestart: () => void;
  onShowLeaderboard: () => void;
};

export function FinishScreen({
  playerName,
  timeMs,
  onRestart,
  onShowLeaderboard,
}: FinishScreenProps) {
  return (
    <section className="screen finish-screen">
      <div className="panel pixel-panel">
        <p className="eyebrow">Cíl dosažen</p>

        <h1>Našel jsi zlaté střevíce!</h1>

        <p className="result-name">{playerName}</p>
        <p className="result-time">{formatTimeMs(timeMs)}</p>

        <div className="button-row">
          <button type="button" className="pixel-button primary-button" onClick={onRestart}>
            Hrát znovu
          </button>

          <button type="button" className="pixel-button secondary-button" onClick={onShowLeaderboard}>
            Leaderboard
          </button>
        </div>
      </div>
    </section>
  );
}
