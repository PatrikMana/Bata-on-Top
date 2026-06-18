import i18n from './i18n';

type ErrorPayload = {
  message?: string;
  messageKey?: string;
  messageParams?: Record<string, unknown>;
};

export function translateMessageKey(key: string, params?: Record<string, unknown>): string {
  return i18n.t(key, params);
}

export function resolveErrorMessage(error: unknown, fallbackKey: string): string {
  if (error instanceof Error) {
    if (error.message.startsWith('errors.')) {
      return translateMessageKey(error.message);
    }

    return error.message;
  }

  return translateMessageKey(fallbackKey);
}

export async function readJsonResponse<T extends object>(response: Response) {
  const data = (await response.json()) as T | ErrorPayload;

  if (!response.ok) {
    const payload = data as ErrorPayload;
    const messageKey = payload.messageKey ?? payload.message;

    if (messageKey?.startsWith('errors.')) {
      throw new Error(translateMessageKey(messageKey, payload.messageParams));
    }

    throw new Error(translateMessageKey('errors.operationFailed'));
  }

  return data as T;
}
