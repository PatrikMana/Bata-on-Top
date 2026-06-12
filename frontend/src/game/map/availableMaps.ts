export const AVAILABLE_MAPS = [
  {
    id: 'bata-tower',
    name: 'Baťa Tower',
    version: 'dev-1',
    sectionCount: 3,
    sectionWidth: 1280,
    sectionHeight: 720,
  },
] as const;

export type AvailableMap = (typeof AVAILABLE_MAPS)[number];
