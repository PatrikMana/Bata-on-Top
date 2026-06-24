import Phaser from 'phaser';
import Matter from 'matter-js';
import i18n from '../../i18n/i18n';
import { PLAYER_CONFIG } from '../gameplayConfig';
import {
  getObstaclePhysicsData,
  type ObstaclePhysicsData,
} from '../map/createLevel';
import type { ObstacleType } from '../map/mapTypes';
import {
  canStandOnSupportedSlope,
  getIceVelocityX,
  getSlopeSlideVelocity,
  getWallBounce,
  isSlopeSurfaceContact,
} from '../physics/movementPhysics';
import {
  getIdleFrame,
  getJumpFrame,
  PLAYER_ANIMATION_KEYS,
  PLAYER_TEXTURE_KEYS,
} from './playerAnimations';

type GroundType = Extract<ObstacleType, 'normal' | 'ice'>;

type PhysicsContact = {
  obstacleBody: Matter.Body;
  obstacle: ObstaclePhysicsData;
  normal: Matter.Vector;
  started: boolean;
};

type ActiveSlope = {
  downhill: Matter.Vector;
};

const PLAYER_FALLBACK_TEXTURE_KEY = 'player:fallback';
const JUMP_GROUND_IGNORE_MS = 80;

function ensurePlayerTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(PLAYER_FALLBACK_TEXTURE_KEY)) {
    return PLAYER_FALLBACK_TEXTURE_KEY;
  }

  const graphics = scene.add.graphics();

  graphics.fillStyle(0xf5f5f5);
  graphics.fillRect(0, 0, PLAYER_CONFIG.width, PLAYER_CONFIG.height);
  graphics.fillStyle(0xe10600);
  graphics.fillRect(0, 0, PLAYER_CONFIG.width, 14);
  graphics.fillStyle(0x111111);
  graphics.fillRect(8, 22, 8, 8);
  graphics.fillRect(26, 22, 8, 8);
  graphics.generateTexture(PLAYER_FALLBACK_TEXTURE_KEY, PLAYER_CONFIG.width, PLAYER_CONFIG.height);
  graphics.destroy();

  return PLAYER_FALLBACK_TEXTURE_KEY;
}

export class Player {
  readonly body: Matter.Body;

  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly keyA: Phaser.Input.Keyboard.Key;
  private readonly keyD: Phaser.Input.Keyboard.Key;
  private readonly jumpKey: Phaser.Input.Keyboard.Key;
  private readonly visual: Phaser.GameObjects.Sprite;
  private readonly contacts = new Map<string, PhysicsContact>();
  private groundType: GroundType | null = null;
  private activeSlope: ActiveSlope | null = null;
  private physicsTimeMs = 0;
  private lastGroundedAtMs = Number.NEGATIVE_INFINITY;
  private lastSlopeContactAtMs = Number.NEGATIVE_INFINITY;
  private ignoreGroundUntilMs = 0;
  private lastWallBounceAtMs = Number.NEGATIVE_INFINITY;
  private preStepVelocity: Matter.Vector = { x: 0, y: 0 };
  private wasGroundedAtStepStart = false;
  private jumpChargeMs = 0;
  private jumpChargeDirection: -1 | 0 | 1 = 0;
  private wasJumpDown = false;
  private isChargingJump = false;
  private facingDirection: -1 | 1 = 1;
  private activeVisualKey = '';

  constructor(
    scene: Phaser.Scene,
    world: Matter.World,
    x: number,
    y: number,
  ) {
    if (!scene.input.keyboard) {
      throw new Error(i18n.t('errors.keyboardUnavailable'));
    }

    this.cursors = scene.input.keyboard.createCursorKeys();
    this.keyA = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.jumpKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.body = Matter.Bodies.rectangle(
      x,
      y,
      PLAYER_CONFIG.width,
      PLAYER_CONFIG.height,
      {
        label: 'player',
        friction: 0,
        frictionAir: 0.01,
        frictionStatic: 0,
        restitution: 0,
        slop: 0.01,
        chamfer: {
          radius: PLAYER_CONFIG.colliderChamferRadius,
        },
      },
    );
    Matter.Body.setInertia(this.body, Number.POSITIVE_INFINITY);
    Matter.Composite.add(world, this.body);

    ensurePlayerTexture(scene);
    this.visual = scene.add
      .sprite(x, y, PLAYER_TEXTURE_KEYS.idle, getIdleFrame())
      .setDisplaySize(PLAYER_CONFIG.width, PLAYER_CONFIG.height)
      .setDepth(20);
  }

  get x() {
    return this.body.position.x;
  }

  get y() {
    return this.body.position.y;
  }

  preparePhysicsStep(deltaMs: number) {
    this.physicsTimeMs += deltaMs;
    this.wasGroundedAtStepStart = this.isGrounded();

    const moveDirection = this.getMoveDirection();
    const isJumpDown = this.jumpKey.isDown;
    const isSlopeSliding = this.isSlopeSliding();

    if (moveDirection !== 0 && !this.isChargingJump) {
      this.facingDirection = moveDirection as -1 | 1;
    }

    if (isSlopeSliding && this.activeSlope) {
      this.isChargingJump = false;
      this.jumpChargeMs = 0;
      this.jumpChargeDirection = 0;
      this.applySlopeSlide(this.activeSlope, deltaMs);
    } else {
      this.applyGroundAndJumpInput(deltaMs, moveDirection, isJumpDown);
    }

    this.wasJumpDown = isJumpDown;
    this.preStepVelocity = {
      x: this.body.velocity.x,
      y: this.body.velocity.y,
    };
    this.contacts.clear();
  }

  recordContact(pair: Matter.Pair, started: boolean) {
    const collision = pair.collision;
    const playerIsBodyA = collision.parentA === this.body;
    const playerIsBodyB = collision.parentB === this.body;

    if (!playerIsBodyA && !playerIsBodyB) {
      return;
    }

    const obstacleBody = playerIsBodyA ? collision.parentB : collision.parentA;
    const obstacle = getObstaclePhysicsData(obstacleBody);

    if (!obstacle) {
      return;
    }

    const normal = playerIsBodyA
      ? { x: collision.normal.x, y: collision.normal.y }
      : { x: -collision.normal.x, y: -collision.normal.y };
    const existingContact = this.contacts.get(pair.id);

    this.contacts.set(pair.id, {
      obstacleBody,
      obstacle,
      normal,
      started: started || existingContact?.started === true,
    });
  }

  finishPhysicsStep(deltaMs: number) {
    if (this.resolveWallBounce()) {
      this.groundType = null;
      this.activeSlope = null;
      this.lastGroundedAtMs = Number.NEGATIVE_INFINITY;
      this.syncVisualToBody();
      return;
    }

    this.resolveSurfaceContacts(deltaMs);
    this.syncVisualToBody();
  }

  updateVisual() {
    const isGrounded = this.isGrounded();
    const moveDirection = this.getMoveDirection();
    const velocity = this.body.velocity;

    if (!isGrounded) {
      const airDirection =
        Math.abs(velocity.x) > 0.25
          ? (Math.sign(velocity.x) as -1 | 1)
          : this.facingDirection;

      this.facingDirection = airDirection;
      this.setStaticFrame(
        airDirection === -1 ? PLAYER_TEXTURE_KEYS.jumpLeft : PLAYER_TEXTURE_KEYS.jumpRight,
        getJumpFrame(airDirection, velocity.y),
      );
      return;
    }

    if (this.isChargingJump) {
      this.playAnimation(PLAYER_ANIMATION_KEYS.charge);
      return;
    }

    if (moveDirection === 0 || Math.abs(velocity.x) < 0.35) {
      this.setStaticFrame(PLAYER_TEXTURE_KEYS.idle, getIdleFrame());
      return;
    }

    const runDirection = moveDirection as -1 | 1;

    this.facingDirection = runDirection;
    this.playAnimation(
      runDirection === -1 ? PLAYER_ANIMATION_KEYS.runLeft : PLAYER_ANIMATION_KEYS.runRight,
    );
  }

  getVelocity() {
    return {
      x: this.body.velocity.x,
      y: this.body.velocity.y,
    };
  }

  getDebugState() {
    return {
      x: this.x,
      y: this.y,
      velocity: this.getVelocity(),
      groundType: this.isGrounded() ? this.groundType : null,
      isSlopeSliding: this.isSlopeSliding(),
    };
  }

  setPositionAndVelocity(x: number, y: number, velocity: Matter.Vector) {
    Matter.Body.setPosition(this.body, { x, y });
    Matter.Body.setVelocity(this.body, velocity);
    this.groundType = null;
    this.activeSlope = null;
    this.lastGroundedAtMs = Number.NEGATIVE_INFINITY;
    this.lastSlopeContactAtMs = Number.NEGATIVE_INFINITY;
    this.lastWallBounceAtMs = Number.NEGATIVE_INFINITY;
    this.preStepVelocity = { ...velocity };
    this.jumpChargeMs = 0;
    this.jumpChargeDirection = 0;
    this.wasJumpDown = false;
    this.isChargingJump = false;
    this.syncVisualToBody();
  }

  stop() {
    Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
  }

  destroy(world: Matter.World) {
    Matter.Composite.remove(world, this.body, true);
    this.visual.destroy();
  }

  private applyGroundAndJumpInput(
    deltaMs: number,
    moveDirection: number,
    isJumpDown: boolean,
  ) {
    const isGrounded = this.isGrounded();

    this.isChargingJump = isGrounded && (isJumpDown || this.jumpChargeMs > 0);

    if (isGrounded) {
      if (this.isChargingJump) {
        this.applyPassiveGroundDeceleration(deltaMs);
      } else {
        this.applyGroundMovement(deltaMs, moveDirection);
      }
    }

    if (isGrounded && isJumpDown) {
      if (moveDirection !== 0) {
        this.jumpChargeDirection = moveDirection as -1 | 1;
      }

      this.jumpChargeMs += deltaMs;

      if (this.jumpChargeMs >= PLAYER_CONFIG.jumpMaxHoldMs) {
        this.jump(moveDirection || this.jumpChargeDirection);
      }
    }

    if (this.wasJumpDown && !isJumpDown && isGrounded) {
      if (this.jumpChargeMs >= PLAYER_CONFIG.jumpMinHoldMs) {
        this.jump(moveDirection || this.jumpChargeDirection);
      } else {
        this.jumpChargeMs = 0;
        this.jumpChargeDirection = 0;
        this.isChargingJump = false;
      }
    }

    if (!isJumpDown && !isGrounded) {
      this.jumpChargeMs = 0;
      this.jumpChargeDirection = 0;
      this.isChargingJump = false;
    }
  }

  private resolveSurfaceContacts(deltaMs: number) {
    const contacts = [...this.contacts.values()];
    const canBecomeGrounded =
      this.physicsTimeMs >= this.ignoreGroundUntilMs &&
      this.body.velocity.y >= -0.5;
    const flatGroundContacts = canBecomeGrounded
      ? contacts.filter((contact) => (
          (contact.obstacle.obstacleType === 'normal' ||
            contact.obstacle.obstacleType === 'ice') &&
          contact.normal.y <= -PLAYER_CONFIG.groundContactNormalMin
        ))
      : [];

    if (flatGroundContacts.length > 0) {
      const groundContact =
        flatGroundContacts.find((contact) => contact.obstacle.obstacleType === 'normal') ??
        flatGroundContacts[0];

      this.setGrounded(groundContact.obstacle.obstacleType as GroundType);
      this.activeSlope = null;
      this.stabilizeFlatGround();
      return;
    }

    const slopeContacts = contacts.filter((contact) => (
      contact.obstacle.obstacleType === 'slope' &&
      contact.obstacle.slopeDownhill &&
      isSlopeSurfaceContact(
        contact.normal,
        contact.obstacle.slopeDownhill,
      )
    ));
    const slopeContact = this.pickBestSlopeContact(slopeContacts);

    if (slopeContact && canBecomeGrounded) {
      const overlapRatio = this.getHorizontalOverlapRatio(slopeContact.obstacleBody);
      const canStandOnSupportedEdge = canStandOnSupportedSlope(
        overlapRatio,
        slopeContact.obstacle.standableSlope === true,
      );

      if (canStandOnSupportedEdge) {
        this.setGrounded('normal');
        this.activeSlope = null;
        this.stabilizeFlatGround();
        return;
      }

      this.groundType = null;
      this.lastGroundedAtMs = Number.NEGATIVE_INFINITY;
      this.activeSlope = {
        downhill: slopeContact.obstacle.slopeDownhill as Matter.Vector,
      };
      this.lastSlopeContactAtMs = this.physicsTimeMs;
      this.applySlopeSlide(this.activeSlope, deltaMs);
      return;
    }

    if (!this.isSlopeSliding()) {
      this.activeSlope = null;
    }

    if (!this.isGrounded()) {
      this.groundType = null;
    }
  }

  private pickBestSlopeContact(contacts: PhysicsContact[]) {
    return contacts.sort((a, b) => {
      const overlapDifference =
        this.getHorizontalOverlapRatio(b.obstacleBody) -
        this.getHorizontalOverlapRatio(a.obstacleBody);

      if (Math.abs(overlapDifference) > 0.01) {
        return overlapDifference;
      }

      return a.normal.y - b.normal.y;
    })[0];
  }

  private resolveWallBounce() {
    if (this.physicsTimeMs - this.lastWallBounceAtMs < PLAYER_CONFIG.wallBounceCooldownMs) {
      return false;
    }

    const moveDirection = this.getMoveDirection();
    const candidates = [...this.contacts.values()]
      .map((contact) => {
        if (!contact.started || contact.obstacle.obstacleType === 'finish') {
          return null;
        }

        const bounce = getWallBounce({
          preStepVelocity: this.preStepVelocity,
          normal: contact.normal,
          moveDirection,
          wasGrounded: this.wasGroundedAtStepStart,
        });

        return bounce ? { contact, bounce } : null;
      })
      .filter((candidate) => candidate !== null)
      .sort((a, b) => b.bounce.approachSpeed - a.bounce.approachSpeed);
    const impact = candidates[0];

    if (!impact) {
      return false;
    }

    const nextVelocity = impact.bounce.velocity;

    Matter.Body.translate(this.body, {
      x: impact.contact.normal.x * PLAYER_CONFIG.wallBounceSeparationPx,
      y: 0,
    });
    Matter.Body.setVelocity(this.body, nextVelocity);
    this.lastWallBounceAtMs = this.physicsTimeMs;
    this.preStepVelocity = nextVelocity;

    return true;
  }

  private setGrounded(groundType: GroundType) {
    this.groundType = groundType;
    this.lastGroundedAtMs = this.physicsTimeMs;
  }

  private stabilizeFlatGround() {
    const moveDirection = this.getMoveDirection();
    const nextVelocityX =
      this.groundType === 'normal' && moveDirection === 0
        ? 0
        : this.body.velocity.x;
    const nextVelocityY = Math.min(this.body.velocity.y, 0);

    if (
      nextVelocityX !== this.body.velocity.x ||
      nextVelocityY !== this.body.velocity.y
    ) {
      Matter.Body.setVelocity(this.body, {
        x: nextVelocityX,
        y: nextVelocityY,
      });
    }
  }

  private isGrounded() {
    return (
      this.physicsTimeMs >= this.ignoreGroundUntilMs &&
      this.physicsTimeMs - this.lastGroundedAtMs <= PLAYER_CONFIG.groundedContactGraceMs
    );
  }

  private isSlopeSliding() {
    return (
      this.activeSlope !== null &&
      this.physicsTimeMs - this.lastSlopeContactAtMs <= PLAYER_CONFIG.slopeContactGraceMs
    );
  }

  private getMoveDirection() {
    const left = this.keyA.isDown || this.cursors.left.isDown;
    const right = this.keyD.isDown || this.cursors.right.isDown;

    if (left === right) {
      return 0;
    }

    return left ? -1 : 1;
  }

  private applyPassiveGroundDeceleration(deltaMs: number) {
    if (this.groundType !== 'ice') {
      Matter.Body.setVelocity(this.body, {
        x: 0,
        y: this.body.velocity.y,
      });
      return;
    }

    this.applyIceMovement(deltaMs, 0);
  }

  private applyGroundMovement(deltaMs: number, moveDirection: number) {
    if (this.groundType === 'ice') {
      this.applyIceMovement(deltaMs, moveDirection);
      return;
    }

    Matter.Body.setVelocity(this.body, {
      x: moveDirection * PLAYER_CONFIG.maxGroundSpeed,
      y: this.body.velocity.y,
    });
  }

  private applyIceMovement(deltaMs: number, moveDirection: number) {
    Matter.Body.setVelocity(this.body, {
      x: getIceVelocityX(this.body.velocity.x, moveDirection, deltaMs),
      y: this.body.velocity.y,
    });
  }

  private applySlopeSlide(activeSlope: ActiveSlope, deltaMs: number) {
    Matter.Body.setVelocity(
      this.body,
      getSlopeSlideVelocity(this.body.velocity, activeSlope.downhill, deltaMs),
    );
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

    Matter.Body.setVelocity(this.body, {
      x: velocityX,
      y: velocityY,
    });
    this.groundType = null;
    this.activeSlope = null;
    this.lastGroundedAtMs = Number.NEGATIVE_INFINITY;
    this.ignoreGroundUntilMs = this.physicsTimeMs + JUMP_GROUND_IGNORE_MS;
    this.jumpChargeMs = 0;
    this.jumpChargeDirection = 0;
    this.wasJumpDown = false;
    this.isChargingJump = false;
    this.wasGroundedAtStepStart = false;
  }

  private getHorizontalOverlapRatio(body: Matter.Body) {
    const overlap =
      Math.min(this.body.bounds.max.x, body.bounds.max.x) -
      Math.max(this.body.bounds.min.x, body.bounds.min.x);

    return Phaser.Math.Clamp(overlap / PLAYER_CONFIG.width, 0, 1);
  }

  private setStaticFrame(textureKey: string, frameName: string) {
    const visualKey = `${textureKey}:${frameName}`;

    if (this.activeVisualKey === visualKey) {
      this.syncVisualToBody();
      return;
    }

    this.visual.stop();
    this.visual.setTexture(textureKey, frameName);
    this.applyVisualSize();
    this.activeVisualKey = visualKey;
  }

  private playAnimation(animationKey: string) {
    if (this.activeVisualKey !== animationKey) {
      this.visual.play(animationKey, true);
      this.activeVisualKey = animationKey;
    }

    this.applyVisualSize();
  }

  private applyVisualSize() {
    this.visual.setDisplaySize(PLAYER_CONFIG.width, PLAYER_CONFIG.height);
    this.syncVisualToBody();
  }

  private syncVisualToBody() {
    this.visual.setPosition(this.body.position.x, this.body.position.y);
  }
}
