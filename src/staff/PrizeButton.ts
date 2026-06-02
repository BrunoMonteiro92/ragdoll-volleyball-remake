import { AnimatedSprite, Assets, Container, Sprite, type Texture } from "pixi.js";
import { Box, Vec2, type World } from "planck";
import { sound } from "../audio/sound";
import { spriteFrame } from "../core/assets";
import { GAME_FPS, PAS_THRESHOLD, PRIZE_BUTTON, px2m } from "../core/constants";
import type { BodyUserData } from "../core/types";
import type { Player } from "../entities/Player";
import { Executer } from "./Executer";

const FIXED_DT = 1000 / GAME_FPS;
const COOLDOWN_MS = 2000;

function loadFrames(dir: string, count: number): Promise<Texture[]> {
  return Promise.all(
    Array.from({ length: count }, (_, i) => Assets.load<Texture>(spriteFrame(dir, i + 1))),
  );
}

/**
 * Prize/hazard manager — 1:1 with staff/prizeButton.as.
 * Two button bars (kind 'button') on the back walls + the graphics
 * (mc_prizeButton B1/B2, hatches mc_Luk L1/L2). sendPrize spawns the Executer
 * on the ball's side, with a 2 s cooldown.
 */
export class PrizeButton {
  private readonly container = new Container();
  private prizes: Executer[] = [];
  // cooldown PER SIDE (independent): left = target P1, right = target P2
  private disableL = false;
  private disableR = false;
  private cooldownL = 0;
  private cooldownR = 0;

  private bFrames: Texture[] = [];
  private exFrames: Texture[] = [];
  private B1!: Sprite;
  private B2!: Sprite;
  private L1!: AnimatedSprite;
  private L2!: AnimatedSprite;

  constructor(
    private readonly world: World,
    parent: Container,
  ) {
    this.makeButton(PRIZE_BUTTON.left);
    this.makeButton(PRIZE_BUTTON.right);
    parent.addChild(this.container); // behind the players (as in the original)
  }

  private makeButton(b: { x: number; y: number; hx: number; hy: number; friction: number }): void {
    const ud: BodyUserData = { kind: "button", label: "button" };
    const body = this.world.createBody({
      type: "static",
      position: new Vec2(px2m(b.x), px2m(b.y)),
      userData: ud,
    });
    body.createFixture({
      shape: new Box(px2m(b.hx), px2m(b.hy)),
      friction: b.friction,
      userData: ud,
    });
  }

  async load(): Promise<void> {
    const [bFrames, lukFrames, exFrames] = await Promise.all([
      loadFrames("DefineSprite_235_mc_prizeButton", 2),
      loadFrames("DefineSprite_308_mc_Luk", 18),
      loadFrames("DefineSprite_209_mc_Executer", 8),
    ]);
    this.bFrames = bFrames;
    this.exFrames = exFrames;

    this.B1 = new Sprite(bFrames[0]);
    this.B1.anchor.set(0.5);
    this.B1.position.set(-190, -245);
    this.B1.scale.set(1.56);
    this.B2 = new Sprite(bFrames[0]);
    this.B2.anchor.set(0.5);
    this.B2.position.set(820, -245);
    this.B2.scale.set(-1.56, 1.56); // mirrored

    // hatch content sits in the lower half of the canvas (anchor y≈0.75);
    // centers each one on the Executer spawn point ((105,-120)/(525,-120) px).
    this.L1 = new AnimatedSprite(lukFrames);
    this.L1.anchor.set(0.5, 0.75);
    this.L1.position.set(104, -120);
    this.L1.scale.set(1.56);
    this.L1.loop = false;
    this.L1.animationSpeed = 0.4;
    this.L1.gotoAndStop(0);
    this.L2 = new AnimatedSprite(lukFrames);
    this.L2.anchor.set(0.5, 0.75);
    this.L2.position.set(522, -120); // ~9px left of the spawn to match by eye
    this.L2.scale.set(1.56);
    this.L2.loop = false;
    this.L2.animationSpeed = 0.4;
    this.L2.gotoAndStop(0);

    this.container.addChild(this.B1, this.B2, this.L1, this.L2);
  }

  /** Fires the executer on the ball's side (2 s cooldown). game.bYesPrize. */
  sendPrize(p1: Player, p2: Player, ballX: number): void {
    if (ballX < PAS_THRESHOLD) {
      if (this.disableL) return; // only the P1 side goes on cooldown
      this.disableL = true;
      this.cooldownL = COOLDOWN_MS;
      this.prizes.push(new Executer(this.world, p1, this.exFrames, this.container));
      this.B1.texture = this.bFrames[1]; // open
      this.L1.gotoAndPlay(0); // hatch opens (stays BEHIND the executer)
    } else {
      if (this.disableR) return; // only the P2 side goes on cooldown
      this.disableR = true;
      this.cooldownR = COOLDOWN_MS;
      this.prizes.push(new Executer(this.world, p2, this.exFrames, this.container));
      this.B2.texture = this.bFrames[1];
      this.L2.gotoAndPlay(0);
    }
    sound.sfx("EX1");
  }

  update(): void {
    if (this.disableL) {
      this.cooldownL -= FIXED_DT;
      if (this.cooldownL <= 0) {
        this.disableL = false;
        this.B1.texture = this.bFrames[0]; // closes
      }
    }
    if (this.disableR) {
      this.cooldownR -= FIXED_DT;
      if (this.cooldownR <= 0) {
        this.disableR = false;
        this.B2.texture = this.bFrames[0];
      }
    }
    for (let i = this.prizes.length - 1; i >= 0; i--) {
      const ex = this.prizes[i];
      ex.update();
      if (ex.life === -1) {
        ex.destroy(this.world);
        this.prizes.splice(i, 1);
      }
    }
  }

  /** pauses/resumes the life timers (pause/goal — Phase 9). */
  setPaused(paused: boolean): void {
    for (const ex of this.prizes) ex.paused = paused;
  }

  destroyAll(): void {
    for (const ex of this.prizes) ex.destroy(this.world);
    this.prizes = [];
  }
}
