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
  const goToSection = (sectionIndex, x, y, velocity) => page.evaluate(
    async ({ nextSectionIndex, targetX, targetY, targetVelocity }) => {
      const scene = window.__BATA_GAME__.scene.getScene('GameScene');

      await scene.ensureSectionLoaded(nextSectionIndex);
      scene.switchSection(nextSectionIndex, targetY, {
        x: targetX,
        velocity: targetVelocity,
      });
    },
    {
      nextSectionIndex: sectionIndex,
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

  await teleport(60, 280, { x: 0, y: 0 });
  await page.waitForTimeout(300);
  await page.keyboard.down('ArrowRight');

  const platformSeamSamples = [];
  let walkOffState;

  for (let index = 0; index < 110; index += 1) {
    await page.waitForTimeout(16);
    const state = await readMovement();

    platformSeamSamples.push(state);

    if (state.x > 400 && state.groundType === null) {
      walkOffState = state;
      break;
    }
  }

  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(80);

  const platformTopSamples = platformSeamSamples.filter(
    (state) => state.x >= 80 && state.x <= 360,
  );
  const platformMinY = Math.min(...platformTopSamples.map((state) => state.y));
  const platformMaxY = Math.max(...platformTopSamples.map((state) => state.y));

  assert.ok(platformTopSamples.length > 10, 'Platform seam test did not cross enough tiles.');
  assert.ok(
    platformMaxY - platformMinY < 0.8,
    `Player bumped on a platform seam: ${platformMinY} -> ${platformMaxY}`,
  );
  assert.ok(
    platformTopSamples.every(
      (state) => state.groundType === 'normal' && Math.abs(state.velocity.y) < 0.2,
    ),
    'Player briefly entered jump state while walking across platform seams.',
  );
  assert.ok(walkOffState, 'Player did not leave the platform edge.');
  assert.ok(
    walkOffState.velocity.x > 3,
    `Player lost walking momentum at the platform edge: ${walkOffState.velocity.x}`,
  );

  await teleport(640, 691, { x: 0, y: 0 });
  await page.waitForTimeout(120);
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('Space');
  await page.waitForTimeout(400);
  await page.keyboard.up('Space');
  await page.waitForTimeout(40);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(80);

  const jumpState = await readMovement();

  assert.ok(jumpState.velocity.x > 0, 'Charged jump lost its horizontal direction.');
  assert.ok(jumpState.velocity.y < 0, 'Charged jump did not launch the player upward.');
  assert.equal(jumpState.groundType, null);

  await teleport(640, 691, { x: 0, y: 0 });
  await page.waitForTimeout(120);
  await page.keyboard.down('Space');
  await page.waitForTimeout(180);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(70);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(180);
  await page.keyboard.up('Space');
  await page.waitForTimeout(80);

  const releasedNeutralJumpState = await readMovement();

  assert.ok(releasedNeutralJumpState.velocity.y < 0);
  assert.ok(
    Math.abs(releasedNeutralJumpState.velocity.x) < 0.15,
    `Released jump remembered an old direction: ${JSON.stringify(releasedNeutralJumpState)}`,
  );

  await teleport(640, 691, { x: 0, y: 0 });
  await page.waitForTimeout(120);
  await page.keyboard.down('Space');
  await page.waitForTimeout(120);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(60);
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(760);
  await page.keyboard.up('Space');
  await page.waitForTimeout(50);

  const autoNeutralJumpState = await readMovement();

  assert.ok(autoNeutralJumpState.velocity.y < 0);
  assert.ok(
    Math.abs(autoNeutralJumpState.velocity.x) < 0.15,
    `Auto full jump remembered an old direction: ${JSON.stringify(autoNeutralJumpState)}`,
  );

  await teleport(21, 691, { x: 0, y: 0 });
  await page.waitForTimeout(120);
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.down('Space');
  await page.waitForTimeout(900);
  await page.keyboard.up('Space');
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(50);

  const activeWallJumpState = await readMovement();

  assert.ok(
    activeWallJumpState.velocity.x > 1,
    `Full jump from an active wall contact did not bounce: ${JSON.stringify(activeWallJumpState)}`,
  );
  assert.ok(activeWallJumpState.velocity.y < 0);

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

  await goToSection(8, 520, 320, { x: 3, y: 0 });
  await page.waitForTimeout(260);

  const iceState = await readMovement();

  assert.equal(
    iceState.groundType,
    'ice',
    `Ice landing state was incorrect: ${JSON.stringify(iceState)}`,
  );
  assert.ok(
    iceState.velocity.x > 0.3,
    `Ice did not preserve horizontal momentum: ${iceState.velocity.x}`,
  );

  await goToSection(6, 120, 245, { x: 0, y: 0 });
  await page.waitForTimeout(300);

  const supportedSlopeEdgeState = await readMovement();

  assert.equal(supportedSlopeEdgeState.groundType, 'normal');
  assert.equal(supportedSlopeEdgeState.isSlopeSliding, false);

  await goToSection(6, 115, 205, { x: 0, y: 3 });
  const supportedSlopeFallSamples = [];

  for (let index = 0; index < 28; index += 1) {
    await page.waitForTimeout(20);
    supportedSlopeFallSamples.push(await readMovement());
  }

  const airborneSupportedSlopeSamples = supportedSlopeFallSamples.filter(
    (state) => state.y < 249,
  );

  assert.ok(
    airborneSupportedSlopeSamples.every((state) => state.groundType === null),
    `Supported slope grounded the player in the air: ${JSON.stringify(supportedSlopeFallSamples)}`,
  );
  assert.ok(
    airborneSupportedSlopeSamples.every((state) => Math.abs(state.x - 115) < 3),
    `Supported slope pushed the player across an invisible barrier: ${JSON.stringify(supportedSlopeFallSamples)}`,
  );

  await goToSection(6, 130, 245, { x: 0, y: 0 });
  const singleSlopeSamples = [];

  for (let index = 0; index < 30; index += 1) {
    await page.waitForTimeout(25);
    singleSlopeSamples.push(await readMovement());
  }

  const singleSlopeSlideState = singleSlopeSamples.find(
    (state) => state.isSlopeSliding && state.velocity.x > 0 && state.velocity.y > 0,
  );

  assert.ok(
    singleSlopeSlideState,
    `Single supported slope did not slide after 60 percent overlap: ${JSON.stringify(singleSlopeSamples)}`,
  );
  const firstSingleSlopeSlideIndex = singleSlopeSamples.findIndex(
    (state) => state.isSlopeSliding,
  );
  const latchedSingleSlopeSamples = singleSlopeSamples
    .slice(firstSingleSlopeSlideIndex)
    .filter((state) => state.x <= 210);

  assert.ok(latchedSingleSlopeSamples.length > 3);
  assert.ok(
    latchedSingleSlopeSamples.every(
      (state) => state.isSlopeSliding && state.groundType === null,
    ),
    `Slope slide returned to standing between blocks: ${JSON.stringify(singleSlopeSamples)}`,
  );

  await goToSection(6, 280, 350, { x: 0, y: 0 });
  await page.waitForTimeout(100);

  const slopeSamples = [];

  for (let index = 0; index < 40; index += 1) {
    await page.waitForTimeout(25);
    slopeSamples.push(await readMovement());
  }

  const slopeStart = slopeSamples[0];
  const slopeEnd = slopeSamples.at(-1);
  const slopeSlidingSamples = slopeSamples.filter((state) => state.isSlopeSliding);
  const deepestSlopeState = slopeSamples.reduce(
    (deepest, state) => state.y > deepest.y ? state : deepest,
    slopeStart,
  );

  assert.ok(
    slopeSlidingSamples.length > 0,
    `Player never entered slope sliding state: ${JSON.stringify(slopeSamples)}`,
  );
  assert.ok(
    slopeEnd.x > slopeStart.x,
    `Right-facing slope moved player in the wrong direction: ${slopeStart.x} -> ${slopeEnd.x}`,
  );
  assert.ok(
    deepestSlopeState.y > slopeStart.y + 200,
    `Slope did not move player downward: ${JSON.stringify(slopeSamples)}`,
  );
  assert.ok(
    slopeSlidingSamples.every((state) => state.velocity.x >= 0),
    `Slope filler caused a reverse wall bounce: ${JSON.stringify(slopeSamples)}`,
  );

  await goToSection(6, 280, 410, { x: -4, y: 0 });
  const uphillSlopeSamples = [];

  for (let index = 0; index < 24; index += 1) {
    await page.waitForTimeout(25);
    uphillSlopeSamples.push(await readMovement());
  }

  const correctedUphillState = uphillSlopeSamples.find(
    (state) => state.isSlopeSliding && state.velocity.x > 0 && state.velocity.y > 0,
  );

  assert.ok(
    correctedUphillState,
    `Player was able to climb the right-facing slope: ${JSON.stringify(uphillSlopeSamples)}`,
  );

  await goToSection(0, 640, 691, { x: 0, y: 0 });
  await page.waitForTimeout(100);

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
    walkOffState,
    jumpState,
    releasedNeutralJumpState,
    autoNeutralJumpState,
    activeWallJumpState,
    wallBounceState,
    iceState,
    supportedSlopeEdgeState,
    singleSlopeSlideState,
    slopeStart,
    slopeEnd,
    correctedUphillState,
    upperSectionState,
    lowerSectionState,
  }, null, 2));
} finally {
  await browser.close();
}
