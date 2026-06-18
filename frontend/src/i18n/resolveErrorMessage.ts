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

export function getHttpErrorMessage(
  response: Response,
  data: ErrorPayload | null,
  fallbackKey: string,
): string {
  if (data?.messageKey) {
    return translateMessageKey(data.messageKey, data.messageParams);
  }

  if (data?.message?.startsWith('errors.')) {
    return translateMessageKey(data.message, data.messageParams);
  }

  return translateMessageKey(fallbackKey, { status: response.status });
}
