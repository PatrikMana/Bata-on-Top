import { useEffect, useState } from 'react';
import { getLeaderboard, type LeaderboardItem } from './api/leaderboardApi';
import { PhaserGame } from './game/PhaserGame';
import { AVAILABLE_MAPS, type AvailableMap } from './game/map/availableMaps';
import { FinishScreen } from './ui/FinishScreen';
import { GameHud } from './ui/GameHud';
import { Leaderboard } from './ui/Leaderboard';
import { NicknameModal } from './ui/NicknameModal';
import { PauseMenuModal } from './ui/PauseMenuModal';
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
  const [pauseStartedAtMs, setPauseStartedAtMs] = useState<number | null>(null);
  const [totalPausedMs, setTotalPausedMs] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finalTimeMs, setFinalTimeMs] = useState(0);
  const [runInstanceId, setRunInstanceId] = useState(0);

  const [leaderboardItems, setLeaderboardItems] = useState<LeaderboardItem[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string>();

  const isRunPaused = pauseStartedAtMs !== null;

  useEffect(() => {
    if (screen !== 'playing' || startTimeMs === null || isRunPaused) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setElapsedMs(Date.now() - startTimeMs - totalPausedMs);
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRunPaused, screen, startTimeMs, totalPausedMs]);

  useEffect(() => {
    if (screen !== 'playing') {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.repeat || pauseStartedAtMs !== null) {
        return;
      }

      event.preventDefault();
      setPauseStartedAtMs(Date.now());
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pauseStartedAtMs, screen]);

  function handleShowMapSelect() {
    setScreen('map-select');
  }

  function resetRunClock() {
    setElapsedMs(0);
    setFinalTimeMs(0);
    setTotalPausedMs(0);
    setPauseStartedAtMs(null);
    setStartTimeMs(Date.now());
  }

  function startMap(map: AvailableMap) {
    setSelectedMap(map);
    setRunInstanceId((currentId) => currentId + 1);
    resetRunClock();
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

  function handleResumeRun() {
    if (pauseStartedAtMs === null) {
      return;
    }

    setTotalPausedMs((currentTotal) => currentTotal + Date.now() - pauseStartedAtMs);
    setPauseStartedAtMs(null);
  }

  function handleRestartRun() {
    setRunInstanceId((currentId) => currentId + 1);
    resetRunClock();
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
    setPauseStartedAtMs(null);
    setTotalPausedMs(0);
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
      <main className="game-placeholder" data-paused={isRunPaused}>
        <GameHud elapsedMs={elapsedMs} playerName={playerName} />

        <div className="game-shell">
          <PhaserGame
            key={`${selectedMap.id}-${runInstanceId}`}
            isPaused={isRunPaused}
            mapId={selectedMap.id}
          />
        </div>

        {isRunPaused && (
          <PauseMenuModal
            onResume={handleResumeRun}
            onRestart={handleRestartRun}
            onBackToMenu={handleRestart}
          />
        )}
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
