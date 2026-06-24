import type Matter from 'matter-js';
import { PLAYER_CONFIG } from '../gameplayConfig';

type WallBounceInput = {
  preStepVelocity: Matter.Vector;
  normal: Matter.Vector;
  moveDirection: number;
  wasGrounded: boolean;
};

export type WallBounceResult = {
  approachSpeed: number;
  velocity: Matter.Vector;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

export function getIceVelocityX(
  currentVelocityX: number,
  moveDirection: number,
  deltaMs: number,
) {
  const stepScale = deltaMs / PLAYER_CONFIG.fixedPhysicsStepMs;
  let nextVelocityX = currentVelocityX;

  if (moveDirection !== 0) {
    nextVelocityX += moveDirection * PLAYER_CONFIG.iceAcceleration * stepScale;
  } else {
    nextVelocityX *= Math.pow(PLAYER_CONFIG.iceDeceleration, stepScale);

    if (Math.abs(nextVelocityX) < PLAYER_CONFIG.iceStopSpeed) {
      nextVelocityX = 0;
    }
  }

  return clamp(
    nextVelocityX,
    -PLAYER_CONFIG.iceMaxGroundSpeed,
    PLAYER_CONFIG.iceMaxGroundSpeed,
  );
}

export function getSlopeSlideVelocity(
  currentVelocity: Matter.Vector,
  downhill: Matter.Vector,
  deltaMs: number,
): Matter.Vector {
  const stepScale = deltaMs / PLAYER_CONFIG.fixedPhysicsStepMs;
  const downhillSpeed =
    currentVelocity.x * downhill.x + currentVelocity.y * downhill.y;
  const nextSpeed = clamp(
    Math.max(PLAYER_CONFIG.slopeSlideMinSpeed, downhillSpeed) +
      PLAYER_CONFIG.slopeSlideAcceleration * stepScale,
    PLAYER_CONFIG.slopeSlideMinSpeed,
    PLAYER_CONFIG.slopeMaxSlideSpeed,
  );

  return {
    x: downhill.x * nextSpeed,
    y: downhill.y * nextSpeed,
  };
}

export function getWallBounce(
  input: WallBounceInput,
): WallBounceResult | null {
  const { preStepVelocity, normal, moveDirection, wasGrounded } = input;
  const isWallNormal =
    Math.abs(normal.x) >= PLAYER_CONFIG.wallContactNormalMin &&
    Math.abs(normal.x) > Math.abs(normal.y) * 1.2;

  if (!isWallNormal) {
    return null;
  }

  const isHoldingIntoWall =
    moveDirection !== 0 &&
    moveDirection === -Math.sign(normal.x);
  const approachSpeed = -(
    preStepVelocity.x * normal.x +
    preStepVelocity.y * normal.y
  );
  const isAirImpact = !wasGrounded || Math.abs(preStepVelocity.y) > 0.75;

  if (
    !isAirImpact ||
    (approachSpeed < PLAYER_CONFIG.wallBounceMinSpeed && !isHoldingIntoWall)
  ) {
    return null;
  }

  const resolvedApproachSpeed = Math.max(
    approachSpeed,
    PLAYER_CONFIG.wallBumpSpeed,
  );
  const bounceDirection = Math.sign(normal.x) || 1;

  return {
    approachSpeed: resolvedApproachSpeed,
    velocity: {
      x: bounceDirection * getWallBounceSpeed(resolvedApproachSpeed),
      y: preStepVelocity.y * PLAYER_CONFIG.wallBounceVerticalDampening,
    },
  };
}

export function canStandOnSupportedSlope(overlapRatio: number, isSupported: boolean) {
  return isSupported && overlapRatio < PLAYER_CONFIG.slopeSlideMinOverlapRatio;
}

export function isSlopeSurfaceContact(
  normal: Matter.Vector,
  downhill: Matter.Vector,
) {
  const tangentAlignment = Math.abs(
    normal.x * downhill.x + normal.y * downhill.y,
  );

  return normal.y <= -0.2 && tangentAlignment <= 0.35;
}

function getWallBounceSpeed(impactSpeed: number) {
  if (impactSpeed < PLAYER_CONFIG.wallBounceMinSpeed) {
    return PLAYER_CONFIG.wallBumpSpeed;
  }

  const impactRatio = clamp(
    (impactSpeed - PLAYER_CONFIG.wallBounceMinSpeed) /
      (PLAYER_CONFIG.wallBounceHighImpactSpeed - PLAYER_CONFIG.wallBounceMinSpeed),
    0,
    1,
  );
  const multiplier = lerp(
    PLAYER_CONFIG.wallBounceLowImpactMultiplier,
    PLAYER_CONFIG.wallBounceHighImpactMultiplier,
    impactRatio,
  );

  return clamp(
    impactSpeed * multiplier,
    PLAYER_CONFIG.wallBumpSpeed,
    PLAYER_CONFIG.wallBounceMaxSpeed,
  );
}
