import Phaser from 'phaser';
import { PLAYER_CONFIG } from '../gameplayConfig';
import type { ObstacleType } from '../map/mapTypes';

type GroundType = Extract<ObstacleType, 'normal' | 'ice'>;

const PLAYER_TEXTURE_KEY = 'player:fallback';

function ensurePlayerTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(PLAYER_TEXTURE_KEY)) {
    return PLAYER_TEXTURE_KEY;
  }

  const graphics = scene.add.graphics();

  graphics.fillStyle(0xf5f5f5);
  graphics.fillRect(0, 0, PLAYER_CONFIG.width, PLAYER_CONFIG.height);
  graphics.fillStyle(0xe10600);
  graphics.fillRect(0, 0, PLAYER_CONFIG.width, 14);
  graphics.fillStyle(0x111111);
  graphics.fillRect(8, 22, 8, 8);
  graphics.fillRect(26, 22, 8, 8);
  graphics.generateTexture(PLAYER_TEXTURE_KEY, PLAYER_CONFIG.width, PLAYER_CONFIG.height);
  graphics.destroy();

  return PLAYER_TEXTURE_KEY;
}

export class Player {
  readonly gameObject: Phaser.Physics.Matter.Image;

  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly keyA: Phaser.Input.Keyboard.Key;
  private readonly keyD: Phaser.Input.Keyboard.Key;
  private readonly jumpKey: Phaser.Input.Keyboard.Key;
  private readonly scene: Phaser.Scene;
  private groundType: GroundType | null = null;
  private lastGroundedAtMs = 0;
  private lastWallBounceAtMs = 0;
  private lastAirVelocity = { x: 0, y: 0 };
  private jumpChargeMs = 0;
  private wasJumpDown = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
  ) {
    if (!scene.input.keyboard) {
      throw new Error('Keyboard input není dostupný.');
    }

    this.scene = scene;
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.keyA = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.jumpKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.gameObject = scene.matter.add.image(x, y, ensurePlayerTexture(scene), undefined, {
      label: 'player',
      friction: 0.02,
      frictionAir: 0.01,
      frictionStatic: 0,
    });
    this.gameObject
      .setDisplaySize(PLAYER_CONFIG.width, PLAYER_CONFIG.height)
      .setRectangle(PLAYER_CONFIG.width, PLAYER_CONFIG.height)
      .setFixedRotation()
      .setDepth(20);

    this.getBody().label = 'player';
  }

  update(deltaMs: number, sectionWidth: number) {
    const isGrounded = this.isGrounded();
    const moveDirection = this.getMoveDirection();
    const isJumpDown = this.jumpKey.isDown;
    const isChargingJump = isGrounded && (isJumpDown || this.jumpChargeMs > 0);

    if (isGrounded && !isChargingJump) {
      this.applyGroundMovement(moveDirection);
    }

    if (isGrounded && isJumpDown) {
      this.jumpChargeMs += deltaMs;

      if (this.jumpChargeMs >= PLAYER_CONFIG.jumpMaxHoldMs) {
        this.jump(moveDirection);
      }
    }

    if (this.wasJumpDown && !isJumpDown && isGrounded) {
      if (this.jumpChargeMs >= PLAYER_CONFIG.jumpMinHoldMs) {
        this.jump(moveDirection);
      } else {
        this.jumpChargeMs = 0;
      }
    }

    if (!isJumpDown && !isGrounded) {
      this.jumpChargeMs = 0;
    }

    if (!isGrounded) {
      this.groundType = null;
      this.recordAirVelocity();
      this.applyScreenEdgeBounce(sectionWidth);
    }

    this.wasJumpDown = isJumpDown;
  }

  recordObstacleContact(obstacleType: ObstacleType, obstacleBody: MatterJS.BodyType) {
    this.applyWallBounce(obstacleBody);

    if (obstacleType !== 'normal' && obstacleType !== 'ice') {
      return;
    }

    const playerBody = this.getBody();

    const isStandingOnObstacle =
      playerBody.bounds.max.y <= obstacleBody.bounds.min.y + 18 &&
      playerBody.velocity.y >= -0.5;

    if (!isStandingOnObstacle) {
      return;
    }

    this.groundType = obstacleType;
    this.lastGroundedAtMs = this.scene.time.now;
  }

  getVelocity() {
    const body = this.getBody();

    return {
      x: body.velocity.x,
      y: body.velocity.y,
    };
  }

  setPositionAndVelocity(x: number, y: number, velocity: { x: number; y: number }) {
    this.gameObject.setPosition(x, y);
    this.gameObject.setVelocity(velocity.x, velocity.y);
    this.groundType = null;
    this.lastGroundedAtMs = 0;
    this.lastWallBounceAtMs = 0;
    this.lastAirVelocity = { x: velocity.x, y: velocity.y };
    this.jumpChargeMs = 0;
    this.wasJumpDown = false;
  }

  destroy() {
    this.gameObject.destroy();
  }

  private isGrounded() {
    return this.scene.time.now - this.lastGroundedAtMs <= PLAYER_CONFIG.groundedContactGraceMs;
  }

  private getMoveDirection() {
    const left = this.keyA.isDown || this.cursors.left.isDown;
    const right = this.keyD.isDown || this.cursors.right.isDown;

    if (left === right) {
      return 0;
    }

    return left ? -1 : 1;
  }

  private applyGroundMovement(moveDirection: number) {
    const velocity = this.getBody().velocity;

    if (this.groundType === 'ice') {
      const nextVelocityX = Phaser.Math.Clamp(
        velocity.x + moveDirection * PLAYER_CONFIG.iceAcceleration,
        -PLAYER_CONFIG.iceMaxGroundSpeed,
        PLAYER_CONFIG.iceMaxGroundSpeed,
      );

      this.gameObject.setVelocityX(nextVelocityX);
      return;
    }

    if (moveDirection === 0) {
      this.gameObject.setVelocityX(velocity.x * PLAYER_CONFIG.normalGroundDeceleration);
      return;
    }

    this.gameObject.setVelocityX(moveDirection * PLAYER_CONFIG.maxGroundSpeed);
  }

  private jump(moveDirection: number) {
    const chargeRatio = Phaser.Math.Clamp(
      this.jumpChargeMs / PLAYER_CONFIG.jumpMaxHoldMs,
      0,
      1,
    );
    const horizontalCharge = Math.pow(chargeRatio, PLAYER_CONFIG.jumpHorizontalPowerCurve);
    const verticalCharge = Math.pow(chargeRatio, PLAYER_CONFIG.jumpVerticalPowerCurve);
    const velocityY = Phaser.Math.Linear(
      PLAYER_CONFIG.jumpMinVelocityY,
      PLAYER_CONFIG.jumpMaxVelocityY,
      verticalCharge,
    );
    const velocityX =
      moveDirection *
      Phaser.Math.Linear(
        PLAYER_CONFIG.jumpMinVelocityX,
        PLAYER_CONFIG.jumpMaxVelocityX,
        horizontalCharge,
      );

    this.gameObject.setVelocity(velocityX, velocityY);
    this.lastAirVelocity = { x: velocityX, y: velocityY };
    this.groundType = null;
    this.lastGroundedAtMs = 0;
    this.jumpChargeMs = 0;
    this.wasJumpDown = false;
  }

  private applyWallBounce(obstacleBody: MatterJS.BodyType) {
    const playerBody = this.getBody();
    const velocity = playerBody.velocity;
    const moveDirection = this.getMoveDirection();
    const overlapX =
      Math.min(playerBody.bounds.max.x, obstacleBody.bounds.max.x) -
      Math.max(playerBody.bounds.min.x, obstacleBody.bounds.min.x);
    const overlapY =
      Math.min(playerBody.bounds.max.y, obstacleBody.bounds.max.y) -
      Math.max(playerBody.bounds.min.y, obstacleBody.bounds.min.y);
    const isStandingOnObstacle =
      playerBody.bounds.max.y <= obstacleBody.bounds.min.y + 18 && velocity.y >= -0.5;

    if (isStandingOnObstacle || overlapX <= 0 || overlapY <= 0) {
      return;
    }

    const isSideCollision =
      overlapX <= PLAYER_CONFIG.wallBounceMaxHorizontalOverlap || overlapX < overlapY;

    if (!isSideCollision) {
      return;
    }

    const isPlayerLeftOfObstacle = playerBody.position.x < obstacleBody.position.x;
    const isPlayerRightOfObstacle = playerBody.position.x > obstacleBody.position.x;
    const isHoldingIntoWall =
      (isPlayerLeftOfObstacle && moveDirection > 0) ||
      (isPlayerRightOfObstacle && moveDirection < 0);
    const cooldownMs = isHoldingIntoWall
      ? PLAYER_CONFIG.wallInputBounceCooldownMs
      : PLAYER_CONFIG.wallBounceCooldownMs;

    if (this.scene.time.now - this.lastWallBounceAtMs < cooldownMs) {
      return;
    }

    const incomingVelocityX =
      Math.abs(velocity.x) >= PLAYER_CONFIG.wallBounceMinSpeed
        ? velocity.x
        : this.lastAirVelocity.x;
    const fallbackDirection =
      Math.abs(velocity.x) > 0.1
        ? Math.sign(velocity.x)
        : Math.sign(playerBody.position.x - obstacleBody.position.x) * -1;
    const resolvedIncomingVelocityX = isHoldingIntoWall
      ? moveDirection * Math.max(Math.abs(incomingVelocityX), PLAYER_CONFIG.wallBumpSpeed)
      : Math.abs(incomingVelocityX) >= 0.1
        ? incomingVelocityX
        : fallbackDirection * PLAYER_CONFIG.wallBumpSpeed;

    if (resolvedIncomingVelocityX === 0) {
      return;
    }

    const isHittingLeftSide =
      resolvedIncomingVelocityX > 0 && isPlayerLeftOfObstacle;
    const isHittingRightSide =
      resolvedIncomingVelocityX < 0 && isPlayerRightOfObstacle;

    if (!isHittingLeftSide && !isHittingRightSide) {
      return;
    }

    const bounceDirection = isHittingLeftSide ? -1 : 1;
    const isSoftBump = Math.abs(resolvedIncomingVelocityX) < PLAYER_CONFIG.wallBounceMinSpeed;
    const bounceSpeed = Phaser.Math.Clamp(
      isSoftBump
        ? PLAYER_CONFIG.wallBumpSpeed
        : Math.abs(resolvedIncomingVelocityX) * PLAYER_CONFIG.wallBounceMultiplier,
      0,
      PLAYER_CONFIG.wallBounceMaxSpeed,
    );
    const separatedX = isHittingLeftSide
      ? obstacleBody.bounds.min.x - PLAYER_CONFIG.width / 2 - PLAYER_CONFIG.wallBounceSeparationPx
      : obstacleBody.bounds.max.x + PLAYER_CONFIG.width / 2 + PLAYER_CONFIG.wallBounceSeparationPx;

    this.gameObject.setPosition(separatedX, this.gameObject.y);
    this.gameObject.setVelocity(
      bounceDirection * bounceSpeed,
      velocity.y * PLAYER_CONFIG.wallBounceVerticalDampening,
    );
    this.lastWallBounceAtMs = this.scene.time.now;
    this.lastAirVelocity = {
      x: bounceDirection * bounceSpeed,
      y: velocity.y * PLAYER_CONFIG.wallBounceVerticalDampening,
    };
  }

  private applyScreenEdgeBounce(sectionWidth: number) {
    const playerBody = this.getBody();
    const velocity = playerBody.velocity;
    const moveDirection = this.getMoveDirection();
    const incomingVelocityX =
      Math.abs(velocity.x) >= PLAYER_CONFIG.wallBounceMinSpeed
        ? velocity.x
        : this.lastAirVelocity.x;
    const resolvedIncomingVelocityX =
      Math.abs(incomingVelocityX) >= 0.1
        ? incomingVelocityX
        : moveDirection * PLAYER_CONFIG.wallBumpSpeed;
    const hitLeftEdge =
      playerBody.bounds.min.x <= 1 &&
      (resolvedIncomingVelocityX < -PLAYER_CONFIG.wallBounceMinSpeed || moveDirection < 0);
    const hitRightEdge =
      playerBody.bounds.max.x >= sectionWidth - 1 &&
      (resolvedIncomingVelocityX > PLAYER_CONFIG.wallBounceMinSpeed || moveDirection > 0);

    if (!hitLeftEdge && !hitRightEdge) {
      return;
    }

    const isHoldingIntoEdge = (hitLeftEdge && moveDirection < 0) || (hitRightEdge && moveDirection > 0);
    const cooldownMs = isHoldingIntoEdge
      ? PLAYER_CONFIG.wallInputBounceCooldownMs
      : PLAYER_CONFIG.wallBounceCooldownMs;

    if (this.scene.time.now - this.lastWallBounceAtMs < cooldownMs) {
      return;
    }

    const bounceDirection = hitLeftEdge ? 1 : -1;
    const bounceSpeed = Phaser.Math.Clamp(
      Math.abs(resolvedIncomingVelocityX) < PLAYER_CONFIG.wallBounceMinSpeed
        ? PLAYER_CONFIG.wallBumpSpeed
        : Math.abs(resolvedIncomingVelocityX) * PLAYER_CONFIG.wallBounceMultiplier,
      0,
      PLAYER_CONFIG.wallBounceMaxSpeed,
    );

    this.gameObject.setPosition(
      hitLeftEdge ? PLAYER_CONFIG.width / 2 + 2 : sectionWidth - PLAYER_CONFIG.width / 2 - 2,
      this.gameObject.y,
    );
    this.gameObject.setVelocity(
      bounceDirection * bounceSpeed,
      velocity.y * PLAYER_CONFIG.wallBounceVerticalDampening,
    );
    this.lastWallBounceAtMs = this.scene.time.now;
    this.lastAirVelocity = {
      x: bounceDirection * bounceSpeed,
      y: velocity.y * PLAYER_CONFIG.wallBounceVerticalDampening,
    };
  }

  private recordAirVelocity() {
    const velocity = this.getBody().velocity;

    if (Math.abs(velocity.x) >= PLAYER_CONFIG.wallBounceMinSpeed) {
      this.lastAirVelocity = { x: velocity.x, y: velocity.y };
    }
  }

  private getBody() {
    return this.gameObject.body as MatterJS.BodyType;
  }
}
