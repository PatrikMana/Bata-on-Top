import { getHttpErrorMessage } from '../i18n/resolveErrorMessage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api';

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
  mapName: string;
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
    throw new Error(getHttpErrorMessage(response, data, 'errors.apiRequestFailed'));
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
      mapName: payload.mapName,
    }),
  });
}

export async function heartbeatRun(
  payload: FinishRunPayload,
): Promise<void> {
  await requestJson(`${API_BASE_URL}/runs/heartbeat`, {
    method: 'POST',
    body: JSON.stringify({
      runId: payload.runId,
      runToken: payload.runToken,
    }),
  });
}

export async function abortRun(
  payload: FinishRunPayload,
): Promise<void> {
  await requestJson(`${API_BASE_URL}/runs/abort`, {
    method: 'POST',
    body: JSON.stringify({
      runId: payload.runId,
      runToken: payload.runToken,
    }),
  });
}

export function sendAbortRunBeacon(payload: FinishRunPayload): boolean {
  const body = JSON.stringify({
    runId: payload.runId,
    runToken: payload.runToken,
  });
  const blob = new Blob([body], { type: 'application/json' });

  return navigator.sendBeacon(`${API_BASE_URL}/runs/abort`, blob);
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
