import { Assets, BlurFilter, ColorMatrixFilter, type Container, Sprite } from "pixi.js";
import { type Body, Circle, Vec2, type World } from "planck";
import { spriteFrame } from "../core/assets";
import { BALL, m2px, px2m } from "../core/constants";
import type { BodyUserData, PlayerId } from "../core/types";
import { applyAdditive } from "../render/colorize";

/**
 * The ball — 1:1 with staff/ball.as.
 * isBullet circle, mass forced to 0.1, friction 0.05. update() clamps the
 * velocity, motion-blur and the trail (ball_track), and syncs the sprite.
 */
export class Ball {
  readonly body: Body;
  /** 0 = free, 1/2 = held by that player (ball.as: ballOfPlayer). */
  ballOfPlayer: 0 | PlayerId = 0;

  private ballSprite!: Sprite;
  private trail!: Sprite;
  private readonly blur = new BlurFilter({ strength: 0, quality: 3 });
  private readonly colorFilter = new ColorMatrixFilter(); // identity = no tint

  constructor(
    world: World,
    private readonly parent: Container,
  ) {
    const ud: BodyUserData = { kind: "ball", label: "ball" };
    this.body = world.createBody({
      type: "dynamic",
      position: new Vec2(px2m(BALL.start.x), px2m(BALL.start.y)),
      bullet: true, // continuous collision (isBullet)
      linearDamping: 0,
      angularDamping: 0,
      userData: ud,
    });
    this.body.createFixture({
      shape: new Circle(px2m(BALL.radiusPx)),
      density: BALL.density,
      friction: BALL.friction,
      restitution: BALL.restitution,
      userData: ud,
    });
    // forced mass (ball.as: SetMass mass=0.1, I=0.01)
    this.body.setMassData({ mass: BALL.mass, center: new Vec2(0, 0), I: BALL.inertia });
  }

  async load(): Promise<void> {
    const [ballTex, trailTex] = await Promise.all([
      Assets.load(spriteFrame("DefineSprite_118_mc_Ball", 1)),
      Assets.load(spriteFrame("DefineSprite_303_ball_track", 1)),
    ]);
    this.trail = new Sprite(trailTex);
    // solid head of the trail on the right → anchor there so it sits ON the ball
    // and the fade stays behind (rotation points +x along the velocity).
    this.trail.anchor.set(1, 0.5);
    this.trail.filters = [this.colorFilter];
    this.ballSprite = new Sprite(ballTex);
    this.ballSprite.anchor.set(0.5);
    this.ballSprite.filters = [this.blur, this.colorFilter];
    this.parent.addChild(this.trail); // trail behind
    this.parent.addChild(this.ballSprite); // ball in front
  }

  /** Tints the ball+trail with the color of the last to touch (ball.as). */
  setTintOffset(rgbOffset: number): void {
    applyAdditive(this.colorFilter, rgbOffset);
  }

  /** ball.as update(): velocity clamp + blur + trail + sprite sync. */
  update(): void {
    const b = this.body;
    const v = b.getLinearVelocity();
    let vx = v.x;
    let vy = v.y;
    if (vy > BALL.maxVY) vy = BALL.maxVY;
    else if (vy < -BALL.maxVY) vy = -BALL.maxVY;
    if (vx > BALL.maxVX) vx = BALL.maxVX;
    else if (vx < -BALL.maxVX) vx = -BALL.maxVX;
    if (vx !== v.x || vy !== v.y) b.setLinearVelocity(new Vec2(vx, vy));

    const c = b.getWorldCenter();
    const cx = m2px(c.x);
    const cy = m2px(c.y);
    const speed = Math.hypot(vx, vy);

    // ball
    this.ballSprite.position.set(cx, cy);
    this.ballSprite.rotation = b.getAngle();
    this.blur.strength = speed > 4.5 ? Math.abs(vx) / 7 : Math.abs(b.getAngularVelocity()) / 11;

    // trail (ball_track): stretches with the velocity, aligned to the motion vector
    this.trail.position.set(cx, cy);
    this.trail.rotation = Math.atan2(vy, vx);
    this.trail.scale.x = this.ballOfPlayer !== 0 ? 0 : speed / 25;
  }
}
