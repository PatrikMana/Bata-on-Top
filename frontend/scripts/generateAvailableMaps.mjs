import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, '..');
const mapsRoot = join(frontendRoot, 'public', 'maps');
const outputPath = join(frontendRoot, 'src', 'game', 'map', 'availableMaps.generated.ts');

const SECTION_WIDTH = 1280;
const SECTION_HEIGHT = 720;
const DEFAULT_VERSION = 'dev-1';

function toDisplayName(mapId) {
  return mapId
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function hasObstacleData(sectionPath) {
  return (
    existsSync(join(sectionPath, 'obstacles', 'obstacles.json')) ||
    existsSync(join(sectionPath, 'obstacles.json'))
  );
}

function getSectionCount(mapPath) {
  const sectionsPath = join(mapPath, 'sections');

  if (!existsSync(sectionsPath)) {
    return 0;
  }

  const sectionIndexes = readdirSync(sectionsPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => Number(entry.name))
    .filter((sectionIndex) => hasObstacleData(join(sectionsPath, String(sectionIndex))))
    .sort((a, b) => a - b);

  const availableSectionIndexes = new Set(sectionIndexes);
  let sectionCount = 0;

  while (availableSectionIndexes.has(sectionCount)) {
    sectionCount += 1;
  }

  return sectionCount;
}

const maps = existsSync(mapsRoot)
  ? readdirSync(mapsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const sectionCount = getSectionCount(join(mapsRoot, entry.name));

      if (sectionCount === 0) {
        return null;
      }

      return {
        id: entry.name,
        name: toDisplayName(entry.name),
        version: DEFAULT_VERSION,
        sectionCount,
        sectionWidth: SECTION_WIDTH,
        sectionHeight: SECTION_HEIGHT,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id))
  : [];

const generatedFile = `import type { AvailableMap } from './availableMaps';

export const AVAILABLE_MAPS = ${JSON.stringify(maps, null, 2)} as const satisfies readonly AvailableMap[];
`;

writeFileSync(outputPath, generatedFile);
