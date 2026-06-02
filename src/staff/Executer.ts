import { AnimatedSprite, type Container, type Texture } from "pixi.js";
import { type Body, Circle, Vec2, type World } from "planck";
import { sound } from "../audio/sound";
import { EXECUTER, GAME_FPS, m2px, px2m } from "../core/constants";
import { options } from "../core/options";
import type { BodyUserData } from "../core/types";
import type { Player } from "../entities/Player";
import { additiveColorMatrix } from "../render/colorize";

const FIXED_DT = 1000 / GAME_FPS;
const LIFE_TICK_MS = 1000;

/**
 * Homing projectile (wrecking ball) — 1:1 with staff/executer.as.
 * Mass forced to 400 (plows through the ragdoll), homes in on the target by overwriting
 * the velocity each step (ignores gravity). Lives ~Life s and then explodes.
 */
export class Executer {
  readonly body: Body;
  life: number; // s remaining; -1 = dead (prizeButton destroys)
  paused = false; // stopExecutors/startExecutors (pause/goal → Phase 9)

  private readonly target: Player;
  private readonly sprite: AnimatedSprite;
  private ticks = 0;
  private timerMs = 0;
  private exploded = false;

  constructor(world: World, target: Player, frames: Texture[], parent: Container) {
    this.target = target;
    const isP1 = target.id === 1;
    this.life = isP1 ? options.myExLife : options.compExLife;
    const spawn = isP1 ? EXECUTER.spawnP1 : EXECUTER.spawnP2;

    const ud: BodyUserData = { kind: "executer", playerId: target.id, label: "executer" };
    this.body = world.createBody({
      type: "dynamic",
      position: new Vec2(spawn.x, spawn.y),
      userData: ud,
    });
    this.body.createFixture({
      shape: new Circle(px2m(EXECUTER.radiusPx)),
      density: EXECUTER.density,
      friction: EXECUTER.friction,
      restitution: EXECUTER.restitution,
      userData: ud,
    });
    this.body.setMassData({ mass: EXECUTER.mass, center: new Vec2(0, 0), I: EXECUTER.inertia });

    this.sprite = new AnimatedSprite(frames);
    // the ball (frame 1) sits at (146,94) on the 243×192 canvas — aligns the body to it
    this.sprite.anchor.set(146 / 243, 94 / 192);
    this.sprite.animationSpeed = 0.4;
    this.sprite.loop = false;
    this.sprite.gotoAndStop(0); // frame 1 = the ball
    this.sprite.filters = [additiveColorMatrix(target.colorOffset)]; // target's color
    parent.addChild(this.sprite);
  }

  update(): void {
    // homing — overwrites the velocity toward the target's (Tors.x, Head.y)
    const c = this.body.getWorldCenter();
    const vx = this.target.bodies.Tors.getWorldCenter().x - c.x;
    const vy = this.target.bodies.Head.getWorldCenter().y - c.y;
    const len = Math.hypot(vx, vy) || 1;
    const speed =
      (this.target.id === 1 ? options.myExSpeed : options.compExSpeed) * this.rampMultiplier();
    this.body.setLinearVelocity(new Vec2((vx / len) * speed, (vy / len) * speed));

    // sprite sync
    this.sprite.position.set(m2px(c.x), m2px(c.y));
    this.sprite.rotation = this.body.getAngle();

    // life timer (real, 1/s) — pausable
    if (!this.paused && this.life >= 0) {
      this.timerMs += FIXED_DT;
      while (this.timerMs >= LIFE_TICK_MS) {
        this.timerMs -= LIFE_TICK_MS;
        this.ticks++;
        if (this.ticks >= this.life && !this.exploded) this.explode();
      }
    }
  }

  /** Difficulty ramp per level (campaign) — speed bursts. */
  private rampMultiplier(): number {
    const n = this.ticks;
    switch (options.currentLevel) {
      case 2:
        return n / 4 - Math.floor(n / 10) === 0 ? 2 : 1;
      case 3:
        return n / 4 - Math.floor(n / 7) === 0 ? 2 : 1;
      case 4:
        if (n / 3 - Math.floor(n / 4) === 0) return 2;
        return n / 3 - Math.floor(n / 3) === 0 ? 2.5 : 1;
      case 5:
        return n / 3 - Math.floor(n / 3) === 0 ? 2.5 : 1;
      default:
        return 1;
    }
  }

  private explode(): void {
    this.exploded = true;
    this.sprite.blendMode = "subtract";
    this.sprite.loop = false;
    this.sprite.onComplete = () => {
      this.life = -1; // prizeButton.update() destroys after the animation
    };
    this.sprite.gotoAndPlay(1); // skips the ball, animates the explosion (frames 2-8)
    sound.sfx("EXPLOSION1");
  }

  destroy(world: World): void {
    this.sprite.parent?.removeChild(this.sprite);
    this.sprite.destroy();
    world.destroyBody(this.body);
  }
}
