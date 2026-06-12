const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api';
const MAP_VERSION = import.meta.env.VITE_MAP_VERSION ?? 'dev-1';

export type LeaderboardItem = {
  id: number;
  playerName: string;
  timeMs: number;
  mapVersion: string;
  finishedAt: string;
};

type GetLeaderboardOptions = {
  mapVersion?: string;
  limit?: number;
};

export async function getLeaderboard(
  options: GetLeaderboardOptions = {},
): Promise<LeaderboardItem[]> {
  const params = new URLSearchParams({
    mapVersion: options.mapVersion ?? MAP_VERSION,
    limit: String(options.limit ?? 10),
  });

  const response = await fetch(`${API_BASE_URL}/leaderboard?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.message ??
      data?.error ??
      `Leaderboard request failed with status ${response.status}`;

    throw new Error(message);
  }

  return data as LeaderboardItem[];
}