import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const baseUrl = process.env.MOVEMENT_TEST_URL ?? 'http://127.0.0.1:4173';
const edgePath =
  process.env.EDGE_PATH ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({
  executablePath: edgePath,
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const pageErrors = [];

page.on('pageerror', (error) => {
  pageErrors.push(error.message);
});

await page.addInitScript(() => {
  window.localStorage.setItem('bata-on-top-player-name', 'MovementTest');
});

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /hrát|play/i }).click();

  const mapCards = page.locator('.map-card');
  assert.ok(await mapCards.count(), 'No map cards were rendered.');
  await mapCards.first().getByRole('button').click();
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const game = window.__BATA_GAME__;
    return Boolean(game?.scene?.getScene('GameScene')?.player);
  });

  const readMovement = () => page.evaluate(() => {
    const scene = window.__BATA_GAME__.scene.getScene('GameScene');
    return scene.player.getDebugState();
  });
  const teleport = (x, y, velocity) => page.evaluate(
    ({ targetX, targetY, targetVelocity }) => {
      const scene = window.__BATA_GAME__.scene.getScene('GameScene');
      scene.player.setPositionAndVelocity(targetX, targetY, targetVelocity);
    },
    {
      targetX: x,
      targetY: y,
      targetVelocity: velocity,
    },
  );

  await page.waitForTimeout(300);
  const initialState = await readMovement();

  assert.equal(initialState.groundType, 'normal');

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(250);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(100);

  const stoppedState = await readMovement();

  assert.ok(stoppedState.x > initialState.x, 'Player did not move on normal ground.');
  assert.ok(
    Math.abs(stoppedState.velocity.x) < 0.1,
    `Player kept sliding on normal ground: ${stoppedState.velocity.x}`,
  );

  await teleport(640, 691, { x: 0, y: 0 });
  await page.waitForTimeout(120);
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('Space');
  await page.waitForTimeout(400);
  await page.keyboard.up('Space');
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(80);

  const jumpState = await readMovement();

  assert.ok(jumpState.velocity.x > 0, 'Charged jump lost its horizontal direction.');
  assert.ok(jumpState.velocity.y < 0, 'Charged jump did not launch the player upward.');
  assert.equal(jumpState.groundType, null);

  await teleport(1230, 430, { x: 6, y: 1 });
  const wallSamples = [];

  for (let index = 0; index < 20; index += 1) {
    await page.waitForTimeout(25);
    wallSamples.push(await readMovement());
  }

  const wallBounceState = wallSamples.find((state) => state.velocity.x < -1);

  assert.ok(
    wallBounceState,
    `Player did not bounce away from the right wall: ${JSON.stringify(wallSamples)}`,
  );

  await teleport(100, 550, { x: 3, y: 0 });
  await page.waitForTimeout(260);

  const iceState = await readMovement();

  assert.equal(iceState.groundType, 'ice');
  assert.ok(
    iceState.velocity.x > 0.3,
    `Ice did not preserve horizontal momentum: ${iceState.velocity.x}`,
  );

  await teleport(1130, 510, { x: 0, y: 0 });
  const slopeSamples = [];

  for (let index = 0; index < 40; index += 1) {
    await page.waitForTimeout(25);
    slopeSamples.push(await readMovement());
  }

  const slopeStart = slopeSamples[0];
  const slopeEnd = slopeSamples.at(-1);
  const slopeSlidingSamples = slopeSamples.filter((state) => state.isSlopeSliding);

  assert.ok(
    slopeSlidingSamples.length > 0,
    `Player never entered slope sliding state: ${JSON.stringify(slopeSamples)}`,
  );
  assert.ok(
    slopeEnd.x < slopeStart.x,
    `Left-facing slope moved player in the wrong direction: ${slopeStart.x} -> ${slopeEnd.x}`,
  );
  assert.ok(
    slopeEnd.y > slopeStart.y,
    `Slope did not move player downward: ${slopeStart.y} -> ${slopeEnd.y}`,
  );

  await teleport(1130, 570, { x: 4, y: 0 });
  const uphillSlopeSamples = [];

  for (let index = 0; index < 24; index += 1) {
    await page.waitForTimeout(25);
    uphillSlopeSamples.push(await readMovement());
  }

  const correctedUphillState = uphillSlopeSamples.find(
    (state) => state.isSlopeSliding && state.velocity.x < 0 && state.velocity.y > 0,
  );

  assert.ok(
    correctedUphillState,
    `Player was able to climb the left-facing slope: ${JSON.stringify(uphillSlopeSamples)}`,
  );

  await teleport(640, -40, { x: 1.5, y: -5 });
  await page.waitForFunction(() => {
    const scene = window.__BATA_GAME__.scene.getScene('GameScene');
    return scene.activeSectionIndex === 1;
  });

  const upperSectionState = await readMovement();

  assert.ok(
    upperSectionState.y > 600,
    `Player was placed incorrectly after upward section transition: ${upperSectionState.y}`,
  );
  assert.ok(
    upperSectionState.velocity.y < 0,
    'Upward section transition did not preserve vertical velocity.',
  );

  await teleport(640, 760, { x: -1.5, y: 5 });
  await page.waitForFunction(() => {
    const scene = window.__BATA_GAME__.scene.getScene('GameScene');
    return scene.activeSectionIndex === 0;
  });

  const lowerSectionState = await readMovement();

  assert.ok(
    lowerSectionState.y < 120,
    `Player was placed incorrectly after downward section transition: ${lowerSectionState.y}`,
  );
  assert.ok(
    lowerSectionState.velocity.y > 0,
    'Downward section transition did not preserve vertical velocity.',
  );

  assert.deepEqual(pageErrors, []);

  console.log(JSON.stringify({
    initialState,
    stoppedState,
    jumpState,
    wallBounceState,
    iceState,
    slopeStart,
    slopeEnd,
    correctedUphillState,
    upperSectionState,
    lowerSectionState,
  }, null, 2));
} finally {
  await browser.close();
}
