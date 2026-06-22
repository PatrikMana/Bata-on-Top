import type { AvailableMap } from './availableMaps';

export const AVAILABLE_MAPS = [
  {
    "id": "bata-tower",
    "name": "Bata Tower",
    "version": "dev-1",
    "sectionCount": 10,
    "sectionWidth": 1280,
    "sectionHeight": 720
  }
] as const satisfies readonly AvailableMap[];
