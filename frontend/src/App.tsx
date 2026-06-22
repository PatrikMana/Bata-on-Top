import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getLeaderboard, type LeaderboardItem } from './api/leaderboardApi';
import {
  abortRun,
  finishRun,
  heartbeatRun,
  sendAbortRunBeacon,
  startRun,
  type StartRunResponse,
} from './api/runsApi';
import { PhaserGame } from './game/PhaserGame';
import { AVAILABLE_MAPS, type AvailableMap } from './game/map/availableMaps';
import { FinishScreen } from './ui/FinishScreen';
import { GameHud } from './ui/GameHud';
import { Leaderboard } from './ui/Leaderboard';
import { NicknameModal } from './ui/NicknameModal';
import { PauseMenuModal } from './ui/PauseMenuModal';
import { LanguageSwitcher } from './ui/LanguageSwitcher';
import { resolveErrorMessage } from './i18n/resolveErrorMessage';
import { StartScreen } from './ui/StartScreen';

type AppScreen = 'start' | 'map-select' | 'playing' | 'finish' | 'leaderboard';
type KeyboardRegion = 'content' | 'language';
const PLAYER_NAME_STORAGE_KEY = 'bata-on-top-player-name';
const RUN_HEARTBEAT_INTERVAL_MS = 5_000;

function App() {
  const { t } = useTranslation();
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
  const [activeRun, setActiveRun] = useState<StartRunResponse | null>(null);

  const [leaderboardItems, setLeaderboardItems] = useState<LeaderboardItem[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string>();
  const [leaderboardMap, setLeaderboardMap] = useState<AvailableMap>(AVAILABLE_MAPS[0]);
  const [keyboardRegions, setKeyboardRegions] = useState<Record<string, KeyboardRegion>>({});
  const activeRunRef = useRef<StartRunResponse | null>(null);
  const isFinishingRunRef = useRef(false);

  const isRunPaused = pauseStartedAtMs !== null;
  const showLanguageSwitcher = screen !== 'playing' || isRunPaused;
  const keyboardRegionKey = `${screen}:${isRunPaused}:${pendingMap ? 'modal' : 'none'}`;
  const keyboardRegion = keyboardRegions[keyboardRegionKey] ?? 'content';
  const contentMenuKeysEnabled = keyboardRegion === 'content' && !pendingMap;
  const languageMenuKeysEnabled = showLanguageSwitcher && keyboardRegion === 'language' && !pendingMap;

  function setKeyboardRegion(region: KeyboardRegion) {
    setKeyboardRegions((currentRegions) => ({
      ...currentRegions,
      [keyboardRegionKey]: region,
    }));
  }

  useEffect(() => {
    activeRunRef.current = activeRun;
  }, [activeRun]);

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

  useEffect(() => {
    if (screen !== 'playing' || !activeRun) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void heartbeatRun({
        runId: activeRun.runId,
        runToken: activeRun.runToken,
      });
    }, RUN_HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeRun, screen]);

  useEffect(() => {
    function handlePageHide() {
      const run = activeRunRef.current;

      if (!run) {
        return;
      }

      sendAbortRunBeacon({
        runId: run.runId,
        runToken: run.runToken,
      });
      activeRunRef.current = null;
    }

    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

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

  async function startMap(map: AvailableMap, runPlayerName = playerName) {
    const run = await startRun({
      playerName: runPlayerName,
      mapName: map.name,
    });

    setActiveRun(run);
    isFinishingRunRef.current = false;
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

    void startMap(map);
  }

  function handleSaveNickname() {
    const trimmedName = nicknameDraft.trim();

    if (trimmedName.length < 2) {
      setNicknameError(t('errors.nicknameMinLength'));
      return;
    }

    window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, trimmedName);
    setPlayerName(trimmedName);
    setNicknameError(undefined);

    const mapToStart = pendingMap;
    setPendingMap(null);

    if (mapToStart) {
      void startMap(mapToStart, trimmedName);
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

  async function abortActiveRun() {
    const run = activeRunRef.current;

    if (!run) {
      return;
    }

    activeRunRef.current = null;
    isFinishingRunRef.current = false;
    setActiveRun(null);

    await abortRun({
      runId: run.runId,
      runToken: run.runToken,
    }).catch(() => undefined);
  }

  function handleRestartRun() {
    void (async () => {
      await abortActiveRun();
      await startMap(selectedMap);
    })();
  }

  async function loadLeaderboard(map = leaderboardMap) {
    setIsLeaderboardLoading(true);
    setLeaderboardError(undefined);

    try {
      const items = await getLeaderboard({ mapName: map.name });
      setLeaderboardItems(items);
    } catch (error) {
      setLeaderboardError(resolveErrorMessage(error, 'errors.leaderboardLoadFailed'));
    } finally {
      setIsLeaderboardLoading(false);
    }
  }

  function handleShowLeaderboard() {
    setLeaderboardMap(selectedMap);
    setScreen('leaderboard');
    void loadLeaderboard(selectedMap);
  }

  function handleSelectLeaderboardMap(map: AvailableMap) {
    setLeaderboardMap(map);
    void loadLeaderboard(map);
  }

  function handleGameFinish() {
    if (screen !== 'playing' || startTimeMs === null || isFinishingRunRef.current) {
      return;
    }

    isFinishingRunRef.current = true;
    const finishedElapsedMs = Date.now() - startTimeMs - totalPausedMs;
    const run = activeRunRef.current;

    if (!run) {
      setElapsedMs(finishedElapsedMs);
      setFinalTimeMs(finishedElapsedMs);
      setPauseStartedAtMs(null);
      setStartTimeMs(null);
      setScreen('finish');
      return;
    }

    activeRunRef.current = null;
    setActiveRun(null);

    void finishRun({
      runId: run.runId,
      runToken: run.runToken,
    })
      .then((finishedRun) => {
        setElapsedMs(finishedRun.timeMs);
        setFinalTimeMs(finishedRun.timeMs);
      })
      .catch(() => {
        setElapsedMs(finishedElapsedMs);
        setFinalTimeMs(finishedElapsedMs);
      })
      .finally(() => {
        setPauseStartedAtMs(null);
        setStartTimeMs(null);
        setScreen('finish');
      });
  }

  function handleRestart() {
    void abortActiveRun();
    isFinishingRunRef.current = false;
    setElapsedMs(0);
    setFinalTimeMs(0);
    setStartTimeMs(null);
    setPauseStartedAtMs(null);
    setTotalPausedMs(0);
    setScreen('start');
  }

  let screenContent: ReactNode;

  if (screen === 'start') {
    screenContent = (
      <StartScreen
        mode="menu"
        maps={AVAILABLE_MAPS}
        menuKeysEnabled={contentMenuKeysEnabled}
        onLeaveLanguageMenu={() => setKeyboardRegion('language')}
        onStart={handleShowMapSelect}
        onShowLeaderboard={handleShowLeaderboard}
      />
    );
  } else if (screen === 'map-select') {
    screenContent = (
      <>
        <StartScreen
          mode="map-select"
          maps={AVAILABLE_MAPS}
          menuKeysEnabled={contentMenuKeysEnabled}
          onLeaveLanguageMenu={() => setKeyboardRegion('language')}
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
  } else if (screen === 'playing') {
    screenContent = (
      <main className="game-placeholder" data-paused={isRunPaused}>
        <GameHud elapsedMs={elapsedMs} playerName={playerName} />

        <div className="game-shell">
          <PhaserGame
            key={`${selectedMap.id}-${runInstanceId}`}
            isPaused={isRunPaused}
            mapId={selectedMap.id}
            onFinish={handleGameFinish}
          />
        </div>

        {isRunPaused && (
          <PauseMenuModal
            menuKeysEnabled={contentMenuKeysEnabled}
            onLeaveLanguageMenu={() => setKeyboardRegion('language')}
            onResume={handleResumeRun}
            onRestart={handleRestartRun}
            onBackToMenu={handleRestart}
          />
        )}
      </main>
    );
  } else if (screen === 'finish') {
    screenContent = (
      <FinishScreen
        playerName={playerName}
        timeMs={finalTimeMs}
        menuKeysEnabled={contentMenuKeysEnabled}
        onLeaveLanguageMenu={() => setKeyboardRegion('language')}
        onBackToMenu={handleRestart}
        onShowLeaderboard={handleShowLeaderboard}
      />
    );
  } else {
    screenContent = (
      <Leaderboard
        items={leaderboardItems}
        maps={AVAILABLE_MAPS}
        selectedMap={leaderboardMap}
        isLoading={isLeaderboardLoading}
        errorMessage={leaderboardError}
        menuKeysEnabled={contentMenuKeysEnabled}
        onLeaveLanguageMenu={() => setKeyboardRegion('language')}
        onSelectMap={handleSelectLeaderboardMap}
        onRefresh={() => void loadLeaderboard()}
        onBack={handleRestart}
      />
    );
  }

  return (
    <>
      {showLanguageSwitcher && (
        <LanguageSwitcher
          menuKeysEnabled={languageMenuKeysEnabled}
          onLeaveLanguageMenu={() => setKeyboardRegion('content')}
        />
      )}
      {screenContent}
    </>
  );
}

export default App;
