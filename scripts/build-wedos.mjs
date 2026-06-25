import { randomBytes } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const frontendRoot = join(repositoryRoot, 'frontend');
const backendRoot = join(repositoryRoot, 'backend');
const templateRoot = join(repositoryRoot, 'deployment', 'wedos');
const deployRoot = join(repositoryRoot, 'deploy', 'wedos');
const frontendDeployRoot = join(deployRoot, 'frontend');
const backendDeployRoot = join(deployRoot, 'backend');
const backendAppRoot = join(backendDeployRoot, '_app');

function run(command, args, cwd, extraEnv = {}) {
  const isWindows = process.platform === 'win32';
  const executable = isWindows ? (process.env.ComSpec || 'cmd.exe') : command;
  const commandArgs = isWindows
    ? ['/d', '/s', '/c', [command, ...args].join(' ')]
    : args;
  const result = spawnSync(executable, commandArgs, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed.`);
  }
}

function cleanGeneratedDirectory(directory) {
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
    return;
  }

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.gitignore') {
      continue;
    }

    rmSync(join(directory, entry.name), { recursive: true, force: true });
  }
}

function copyTemplate(sourceName, destination) {
  cpSync(join(templateRoot, sourceName), destination);
}

const resolvedDeployRoot = resolve(deployRoot);
if (!resolvedDeployRoot.startsWith(resolve(repositoryRoot, 'deploy'))) {
  throw new Error('Refusing to clean a deployment path outside the repository.');
}

rmSync(deployRoot, { recursive: true, force: true });
mkdirSync(frontendDeployRoot, { recursive: true });
mkdirSync(backendAppRoot, { recursive: true });

console.log('\nBuilding frontend for https://ontop.bata.eu ...');
run('npm', ['run', 'build'], frontendRoot, {
  VITE_API_BASE_URL: 'https://ontop-be.bata.eu/api',
});

cpSync(join(frontendRoot, 'dist'), frontendDeployRoot, { recursive: true });
copyTemplate('frontend.htaccess', join(frontendDeployRoot, '.htaccess'));

console.log('\nPreparing Laravel 12 backend ...');
for (const directory of [
  'app',
  'bootstrap',
  'config',
  'database',
  'resources',
  'routes',
  'storage',
]) {
  cpSync(join(backendRoot, directory), join(backendAppRoot, directory), {
    recursive: true,
  });
}

for (const file of ['artisan', 'composer.json', 'composer.lock']) {
  cpSync(join(backendRoot, file), join(backendAppRoot, file));
}

mkdirSync(join(backendAppRoot, 'public'), { recursive: true });
cleanGeneratedDirectory(join(backendAppRoot, 'bootstrap', 'cache'));
cleanGeneratedDirectory(join(backendAppRoot, 'storage', 'framework', 'cache', 'data'));
cleanGeneratedDirectory(join(backendAppRoot, 'storage', 'framework', 'sessions'));
cleanGeneratedDirectory(join(backendAppRoot, 'storage', 'framework', 'testing'));
cleanGeneratedDirectory(join(backendAppRoot, 'storage', 'framework', 'views'));
cleanGeneratedDirectory(join(backendAppRoot, 'storage', 'logs'));

copyTemplate('protected-app.htaccess', join(backendAppRoot, '.htaccess'));
copyTemplate('backend-index.php', join(backendDeployRoot, 'index.php'));
copyTemplate('backend.htaccess', join(backendDeployRoot, '.htaccess'));
copyTemplate('robots.txt', join(backendDeployRoot, 'robots.txt'));

const customEnvironmentPath = join(templateRoot, 'backend.env');
const environmentTemplatePath = existsSync(customEnvironmentPath)
  ? customEnvironmentPath
  : join(templateRoot, 'backend.env.template');
const appKey = `base64:${randomBytes(32).toString('base64')}`;
const environmentContents = readFileSync(environmentTemplatePath, 'utf8')
  .replaceAll('{{APP_KEY}}', appKey);
writeFileSync(join(backendAppRoot, '.env'), environmentContents);

console.log('\nInstalling PHP production dependencies ...');
run(
  'composer',
  [
    'install',
    '--no-dev',
    '--prefer-dist',
    '--classmap-authoritative',
    '--no-interaction',
  ],
  backendAppRoot,
);

console.log('\nWEDOS packages are ready:');
console.log(`Frontend: ${frontendDeployRoot}`);
console.log(`Backend:  ${backendDeployRoot}`);
console.log('\nSet DB_USERNAME and DB_PASSWORD in backend/_app/.env before upload.');
