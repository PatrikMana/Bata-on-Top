import { useEffect, useState } from 'react';
import { getLeaderboard, type LeaderboardItem } from './api/leaderboardApi';
import { StartScreen } from './ui/StartScreen';
import { GameHud } from './ui/GameHud';
import { FinishScreen } from './ui/FinishScreen';
import { Leaderboard } from './ui/Leaderboard';

type AppScreen = 'start' | 'playing' | 'finish' | 'leaderboard';

function App() {
  const [screen, setScreen] = useState<AppScreen>('start');

  const [playerName, setPlayerName] = useState('');
  const [startTimeMs, setStartTimeMs] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finalTimeMs, setFinalTimeMs] = useState(0);

  const [leaderboardItems, setLeaderboardItems] = useState<LeaderboardItem[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string>();

  const [startError, setStartError] = useState<string>();

  useEffect(() => {
    if (screen !== 'playing' || startTimeMs === null) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setElapsedMs(Date.now() - startTimeMs);
    }, 50);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [screen, startTimeMs]);

  function handleStart() {
    const trimmedName = playerName.trim();

    if (trimmedName.length < 2) {
      setStartError('Nickname musí mít aspoň 2 znaky.');
      return;
    }

    setStartError(undefined);
    setPlayerName(trimmedName);
    setElapsedMs(0);
    setStartTimeMs(Date.now());
    setScreen('playing');
  }

  function handleTemporaryFinish() {
    const time = elapsedMs;

    setFinalTimeMs(time);
    setScreen('finish');
  }

  async function loadLeaderboard() {
    setIsLeaderboardLoading(true);
    setLeaderboardError(undefined);

    try {
      const items = await getLeaderboard();
      setLeaderboardItems(items);
    } catch (error) {
      setLeaderboardError(
        error instanceof Error ? error.message : 'Nepodařilo se načíst leaderboard.',
      );
    } finally {
      setIsLeaderboardLoading(false);
    }
  }

  function handleShowLeaderboard() {
    setScreen('leaderboard');
    void loadLeaderboard();
  }

  function handleRestart() {
    setElapsedMs(0);
    setFinalTimeMs(0);
    setStartTimeMs(null);
    setScreen('start');
  }

  if (screen === 'start') {
    return (
      <StartScreen
        playerName={playerName}
        isStarting={false}
        errorMessage={startError}
        onPlayerNameChange={setPlayerName}
        onStart={handleStart}
      />
    );
  }

  if (screen === 'playing') {
    return (
      <main className="game-placeholder">
        <GameHud
          elapsedMs={elapsedMs}
          playerName={playerName}
          onBackToMenu={handleRestart}
        />

        <div className="game-placeholder-box">
          <h1>Game canvas bude tady</h1>
          <p>
            Tohle je zatím placeholder. Později sem vložíme Phaser hru.
          </p>

          <button type="button" onClick={handleTemporaryFinish}>
            Dočasně dokončit run
          </button>
        </div>
      </main>
    );
  }

  if (screen === 'finish') {
    return (
      <FinishScreen
        playerName={playerName}
        timeMs={finalTimeMs}
        onRestart={handleRestart}
        onShowLeaderboard={handleShowLeaderboard}
      />
    );
  }

  return (
    <Leaderboard
      items={leaderboardItems}
      isLoading={isLeaderboardLoading}
      errorMessage={leaderboardError}
      onRefresh={loadLeaderboard}
      onBack={handleRestart}
    />
  );
}

export default App;