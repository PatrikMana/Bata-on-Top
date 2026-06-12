import { useEffect, useState } from 'react';
import { getLeaderboard, type LeaderboardItem } from './api/leaderboardApi';
import { AVAILABLE_MAPS, type AvailableMap } from './game/map/availableMaps';
import { FinishScreen } from './ui/FinishScreen';
import { GameHud } from './ui/GameHud';
import { Leaderboard } from './ui/Leaderboard';
import { NicknameModal } from './ui/NicknameModal';
import { StartScreen } from './ui/StartScreen';

type AppScreen = 'start' | 'map-select' | 'playing' | 'finish' | 'leaderboard';
const PLAYER_NAME_STORAGE_KEY = 'bata-on-top-player-name';

function App() {
  const [screen, setScreen] = useState<AppScreen>('start');

  const [playerName, setPlayerName] = useState(() => {
    return window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY)?.trim() ?? '';
  });
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [nicknameError, setNicknameError] = useState<string>();
  const [pendingMap, setPendingMap] = useState<AvailableMap | null>(null);
  const [selectedMap, setSelectedMap] = useState<AvailableMap>(AVAILABLE_MAPS[0]);
  const [startTimeMs, setStartTimeMs] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finalTimeMs, setFinalTimeMs] = useState(0);

  const [leaderboardItems, setLeaderboardItems] = useState<LeaderboardItem[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string>();

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

  function handleShowMapSelect() {
    setScreen('map-select');
  }

  function startMap(map: AvailableMap) {
    setSelectedMap(map);
    setElapsedMs(0);
    setStartTimeMs(Date.now());
    setScreen('playing');
  }

  function handleSelectMap(map: AvailableMap) {
    if (playerName.trim().length < 2) {
      setPendingMap(map);
      setNicknameDraft(playerName);
      setNicknameError(undefined);
      return;
    }

    startMap(map);
  }

  function handleSaveNickname() {
    const trimmedName = nicknameDraft.trim();

    if (trimmedName.length < 2) {
      setNicknameError('Nickname musí mít aspoň 2 znaky.');
      return;
    }

    window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, trimmedName);
    setPlayerName(trimmedName);
    setNicknameError(undefined);

    const mapToStart = pendingMap;
    setPendingMap(null);

    if (mapToStart) {
      startMap(mapToStart);
    }
  }

  function handleCancelNickname() {
    setPendingMap(null);
    setNicknameError(undefined);
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
        mode="menu"
        maps={AVAILABLE_MAPS}
        onStart={handleShowMapSelect}
        onShowLeaderboard={handleShowLeaderboard}
      />
    );
  }

  if (screen === 'map-select') {
    return (
      <>
        <StartScreen
          mode="map-select"
          maps={AVAILABLE_MAPS}
          onSelectMap={handleSelectMap}
          onBack={handleRestart}
        />

        {pendingMap && (
          <NicknameModal
            value={nicknameDraft}
            errorMessage={nicknameError}
            onChange={setNicknameDraft}
            onSubmit={handleSaveNickname}
            onCancel={handleCancelNickname}
          />
        )}
      </>
    );
  }

  if (screen === 'playing') {
    return (
      <main className="game-placeholder">
        <GameHud elapsedMs={elapsedMs} playerName={playerName} onBackToMenu={handleRestart} />

        <div className="game-placeholder-box">
          <h1>{selectedMap.name}</h1>
          <p>Game canvas bude tady. Později sem vložíme Phaser hru.</p>

          <button type="button" className="pixel-button primary-button" onClick={handleTemporaryFinish}>
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
