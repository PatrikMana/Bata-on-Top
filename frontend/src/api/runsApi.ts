const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api';
const MAP_VERSION = import.meta.env.VITE_MAP_VERSION ?? 'dev-1';

export type StartRunResponse = {
  runId: number;
  runToken: string;
  startedAt: string;
};

export type FinishRunResponse = {
  runId: number;
  status: 'FINISHED' | 'INVALID';
  timeMs: number;
  finishedAt: string;
};

type StartRunPayload = {
  playerName: string;
  mapVersion?: string;
};

type FinishRunPayload = {
  runId: number;
  runToken: string;
};

async function requestJson<TResponse>(
  url: string,
  options: RequestInit,
): Promise<TResponse> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.message ??
      data?.error ??
      `API request failed with status ${response.status}`;

    throw new Error(message);
  }

  return data as TResponse;
}

export async function startRun(
  payload: StartRunPayload,
): Promise<StartRunResponse> {
  return requestJson<StartRunResponse>(`${API_BASE_URL}/runs/start`, {
    method: 'POST',
    body: JSON.stringify({
      playerName: payload.playerName,
      mapVersion: payload.mapVersion ?? MAP_VERSION,
    }),
  });
}

export async function finishRun(
  payload: FinishRunPayload,
): Promise<FinishRunResponse> {
  return requestJson<FinishRunResponse>(`${API_BASE_URL}/runs/finish`, {
    method: 'POST',
    body: JSON.stringify({
      runId: payload.runId,
      runToken: payload.runToken,
    }),
  });
}