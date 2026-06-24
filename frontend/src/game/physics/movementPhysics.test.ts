import { describe, expect, it } from 'vitest';
import { PLAYER_CONFIG } from '../gameplayConfig';
import {
  canStandOnSupportedSlope,
  getIceVelocityX,
  getSlopeSlideVelocity,
  getWallBounce,
  isSlopeSurfaceContact,
} from './movementPhysics';

describe('wall bounce', () => {
  it('always bounces away from a wall hit from the left', () => {
    const result = getWallBounce({
      preStepVelocity: { x: 6, y: -4 },
      normal: { x: -1, y: 0 },
      moveDirection: 1,
      wasGrounded: false,
    });

    expect(result).not.toBeNull();
    expect(result?.velocity.x).toBeLessThan(0);
    expect(result?.velocity.y).toBeCloseTo(
      -4 * PLAYER_CONFIG.wallBounceVerticalDampening,
    );
  });

  it('always bounces away from a wall hit from the right', () => {
    const result = getWallBounce({
      preStepVelocity: { x: -5, y: 3 },
      normal: { x: 1, y: 0 },
      moveDirection: -1,
      wasGrounded: false,
    });

    expect(result).not.toBeNull();
    expect(result?.velocity.x).toBeGreaterThan(0);
  });

  it('does not mistake a floor corner for a wall', () => {
    const result = getWallBounce({
      preStepVelocity: { x: 5, y: 5 },
      normal: { x: -0.7, y: -0.7 },
      moveDirection: 1,
      wasGrounded: false,
    });

    expect(result).toBeNull();
  });

  it('does not bounce while walking into a wall on the ground', () => {
    const result = getWallBounce({
      preStepVelocity: { x: 5, y: 0 },
      normal: { x: -1, y: 0 },
      moveDirection: 1,
      wasGrounded: true,
    });

    expect(result).toBeNull();
  });
});

describe('ice movement', () => {
  it('keeps momentum and decelerates gradually without input', () => {
    const nextVelocity = getIceVelocityX(
      6,
      0,
      PLAYER_CONFIG.fixedPhysicsStepMs,
    );

    expect(nextVelocity).toBeGreaterThan(0);
    expect(nextVelocity).toBeLessThan(6);
  });

  it('accelerates toward input without exceeding ice max speed', () => {
    let velocity = 0;

    for (let index = 0; index < 200; index += 1) {
      velocity = getIceVelocityX(
        velocity,
        1,
        PLAYER_CONFIG.fixedPhysicsStepMs,
      );
    }

    expect(velocity).toBe(PLAYER_CONFIG.iceMaxGroundSpeed);
  });
});

describe('slope movement', () => {
  it('forces an uphill-moving player down a right-facing slope', () => {
    const velocity = getSlopeSlideVelocity(
      { x: -8, y: -4 },
      { x: Math.SQRT1_2, y: Math.SQRT1_2 },
      PLAYER_CONFIG.fixedPhysicsStepMs,
    );

    expect(velocity.x).toBeGreaterThan(0);
    expect(velocity.y).toBeGreaterThan(0);
  });

  it('forces an uphill-moving player down a left-facing slope', () => {
    const velocity = getSlopeSlideVelocity(
      { x: 8, y: -4 },
      { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
      PLAYER_CONFIG.fixedPhysicsStepMs,
    );

    expect(velocity.x).toBeLessThan(0);
    expect(velocity.y).toBeGreaterThan(0);
  });

  it('allows the supported edge only before the 75 percent threshold', () => {
    expect(canStandOnSupportedSlope(0.74, true)).toBe(true);
    expect(canStandOnSupportedSlope(0.75, true)).toBe(false);
    expect(canStandOnSupportedSlope(0.2, false)).toBe(false);
  });

  it('accepts only the diagonal surface normal of a slope body', () => {
    const downhill = { x: Math.SQRT1_2, y: Math.SQRT1_2 };

    expect(
      isSlopeSurfaceContact(
        { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
        downhill,
      ),
    ).toBe(true);
    expect(isSlopeSurfaceContact({ x: 0, y: -1 }, downhill)).toBe(false);
    expect(isSlopeSurfaceContact({ x: -1, y: 0 }, downhill)).toBe(false);
  });
});
