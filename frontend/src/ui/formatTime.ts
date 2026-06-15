export function formatTimeMs(timeMs: number): string {
  const safeTime = Math.max(0, timeMs);

  const minutes = Math.floor(safeTime / 60_000);
  const seconds = Math.floor((safeTime % 60_000) / 1_000);
  const milliseconds = Math.floor((safeTime % 1_000) / 10);

  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds
    .toString()
    .padStart(2, '0')}`;
}

export function formatClockTimeMs(timeMs: number): string {
  const safeTime = Math.max(0, timeMs);

  const hours = Math.floor(safeTime / 3_600_000);
  const minutes = Math.floor((safeTime % 3_600_000) / 60_000);
  const seconds = Math.floor((safeTime % 60_000) / 1_000);

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
