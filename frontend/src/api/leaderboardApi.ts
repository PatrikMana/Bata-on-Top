import { getHttpErrorMessage } from '../i18n/resolveErrorMessage';
import { API_BASE_URL } from './apiConfig';

export type LeaderboardItem = {
  id: number;
  playerName: string;
  timeMs: number;
  mapName: string;
  finishedAt: string;
};

type GetLeaderboardOptions = {
  mapName?: string;
  limit?: number;
};

export async function getLeaderboard(
  options: GetLeaderboardOptions = {},
): Promise<LeaderboardItem[]> {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 10),
  });

  if (options.mapName) {
    params.set('mapName', options.mapName);
  }

  const response = await fetch(`${API_BASE_URL}/leaderboard?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      getHttpErrorMessage(response, data, 'errors.leaderboardRequestFailed'),
    );
  }

  return data as LeaderboardItem[];
}
