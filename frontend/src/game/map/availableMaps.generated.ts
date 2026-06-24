import type { AvailableMap } from './availableMaps';

export const AVAILABLE_MAPS = [
  {
    "id": "skyscraper-21",
    "name": "Skyscraper 21",
    "version": "dev-1",
    "sectionCount": 10,
    "sectionWidth": 1280,
    "sectionHeight": 720
  },
  {
    "id": "skyscraper-21-corrupted",
    "name": "Skyscraper 21 Corrupted",
    "version": "dev-1",
    "sectionCount": 8,
    "sectionWidth": 1280,
    "sectionHeight": 720
  }
] as const satisfies readonly AvailableMap[];
