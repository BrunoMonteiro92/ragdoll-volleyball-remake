import { Assets, type Container, Sprite, Text, type Texture } from "pixi.js";
import { Vec2 } from "planck";
import { sound } from "../audio/sound";
import { spriteFrame } from "../core/assets";
import { campaign, type LevelId } from "../core/campaign";
import {
  GAME_FPS,
  GAME_SET,
  PLAYER_SPAWN,
  SIDE_THRESHOLD,
  TIMESTEP_GAME,
  TIMESTEP_GOAL,
  worldToScreen,
} from "../core/constants";
import type { PlayerId } from "../core/types";
import type { Ball } from "../entities/Ball";
import type { Player } from "../entities/Player";
import type { Contacts } from "../physics/Contacts";

const FIXED_DT = 1000 / GAME_FPS; // real ms per fixed step
const CONTACT_DEBOUNCE_MS = 200; // contact_timer1/2
const GOAL_MS = 2000; // goal_timer
const DANGER_POS: Record<PlayerId, number> = { 1: 210, 2: 405 };

type DangerState = "off" | "red" | "green";

/**
 * Match state machine — 1:1 with game.as.
 * Phase 6a: contacts/3-touches/faults/fall/score. Phase 6b: goal slow-motion,
 * serve countdown, win/loss, danger lights and ball pointer.
 *
 * Real timers (flash.utils.Timer) become ms accumulators; they run ALWAYS,
 * including during the slow-motion (disableUpdate), as in the original.
 */
export class Game {
  point1 = 0;
  point2 = 0;
  ended = false;
  campaignLevel = 0; // 0 = 2P local (no live-points); 1-5 = campaign level

  private win1 = false; // won the last point? (decides who serves)
  private disableUpdate = false;

  // touch debounce
  private bContact1 = false;
  private bContact2 = false;
  private cTimer1 = 0;
  private cTimer2 = 0;

  // serve countdown (delay_timer: 6 ticks of 1s)
  private delayRunning = false;
  private delayMs = 0;
  private delayCount = 0;

  // goal slow-motion (goal_timer: 2s)
  private goalRunning = false;
  private goalMs = 0;

  // display (screen space)
  private scoreboard!: Text;
  private pointer!: Sprite;
  private danger1!: Sprite;
  private danger2!: Sprite;
  private dangerOff!: Texture;
  private dangerRed!: Texture;
  private dangerGreen!: Texture;
  private liveText!: Text; // +/- points popup (campaign)
  private liveMs = 0;

  constructor(
    private readonly ball: Ball,
    private readonly p1: Player,
    private readonly p2: Player,
    private readonly contacts: Contacts,
    private readonly setTimeStep: (n: number) => void,
  ) {}

  async load(hud: Container): Promise<void> {
    await document.fonts.load('22px "LCD"').catch(() => {});
    const [off, red, green, pointerTex] = await Promise.all([
      Assets.load(spriteFrame("DefineSprite_257_mc_DangerLight", 1)),
      Assets.load(spriteFrame("DefineSprite_257_mc_DangerLight", 2)),
      Assets.load(spriteFrame("DefineSprite_257_mc_DangerLight", 5)),
      Assets.load(spriteFrame("DefineSprite_131_clip_ball_pointer", 1)),
    ]);
    this.dangerOff = off;
    this.dangerRed = red;
    this.dangerGreen = green;

    this.pointer = new Sprite(pointerTex);
    this.pointer.anchor.set(0.5, 0);
    this.pointer.y = 6;
    this.pointer.visible = false;

    this.scoreboard = new Text({
      text: "0 - 0",
      style: {
        fontFamily: "LCD",
        fontSize: 22,
        fill: 0xfd1c1c,
        align: "center",
      },
    });
    this.scoreboard.anchor.set(0.5, 0);
    this.scoreboard.position.set(300, 28);

    this.danger1 = this.makeDanger(DANGER_POS[1]);
    this.danger2 = this.makeDanger(DANGER_POS[2]);

    await document.fonts.load('16px "Alba Super"').catch(() => {});
    this.liveText = new Text({
      text: "",
      style: { fontFamily: "Alba Super", fontSize: 16, fill: 0x00ff00 },
    });
    this.liveText.anchor.set(0.5);
    this.liveText.visible = false;

    // z: pointer (back), scoreboard, danger (glow), live-points (top)
    hud.addChild(this.pointer, this.scoreboard, this.danger1, this.danger2, this.liveText);
  }

  private makeDanger(x: number): Sprite {
    // always-visible lamp (frame 1 = off); lights up red/green via setDanger
    const s = new Sprite(this.dangerOff);
    s.anchor.set(0.5);
    s.position.set(x, 40);
    s.blendMode = "overlay";
    return s;
  }

  private setDanger(side: PlayerId, state: DangerState): void {
    const s = side === 1 ? this.danger1 : this.danger2;
    s.texture =
      state === "off" ? this.dangerOff : state === "red" ? this.dangerRed : this.dangerGreen;
  }

  /** Initial serve (P1 serves first). */
  start(): void {
    this.win1 = true;
    this.newRound();
    this.updateScoreboard();
  }

  /** Full manual re-serve (Enter key, temporary until Phase 9). */
  restartMatch(): void {
    this.point1 = 0;
    this.point2 = 0;
    this.ended = false;
    this.win1 = true;
    this.updateScoreboard();
    this.newRound();
  }

  /** true during the goal slow-motion and at game end (turns off the AI). */
  get paused(): boolean {
    return this.disableUpdate;
  }

  update(): void {
    this.tickTimers(); // real timers always run
    if (this.disableUpdate) return;

    const c = this.contacts;
    const ballHeld = this.ball.ballOfPlayer !== 0;

    // touch debounce (200 ms)
    if (this.cTimer1 > 0) {
      this.cTimer1 -= FIXED_DT;
      if (this.cTimer1 <= 0) this.bContact1 = false;
    }
    if (this.cTimer2 > 0) {
      this.cTimer2 -= FIXED_DT;
      if (this.cTimer2 <= 0) this.bContact2 = false;
    }

    // danger lights on the 3rd touch
    if (this.p1.contact === 3) this.setDanger(1, "red");
    if (this.p2.contact === 3) this.setDanger(2, "red");

    // ball pointer (when it rises above the top)
    const c2 = this.ball.body.getWorldCenter();
    if (c2.y < -11) {
      this.pointer.visible = true;
      this.pointer.x = worldToScreen(c2.x, c2.y).x;
    } else {
      this.pointer.visible = false;
    }

    // touch count (rule of 3): increment whoever touched, reset the opponent
    if (!ballHeld && c.ballTouchedPlayer !== 0) {
      if (c.ballTouchedPlayer === 1 && !this.bContact1) {
        this.p1.contact++;
        this.p2.contact = 0;
        this.setDanger(2, "off");
        this.ball.body.applyLinearImpulse(new Vec2(0, -1), this.ball.body.getWorldCenter(), true);
        this.bContact1 = true;
        this.cTimer1 = CONTACT_DEBOUNCE_MS;
        this.ball.setTintOffset(this.p1.colorOffset);
        sound.vh();
      } else if (c.ballTouchedPlayer === 2 && !this.bContact2) {
        this.p2.contact++;
        this.p1.contact = 0;
        this.setDanger(1, "off");
        this.ball.body.applyLinearImpulse(new Vec2(0, -1), this.ball.body.getWorldCenter(), true);
        this.bContact2 = true;
        this.cTimer2 = CONTACT_DEBOUNCE_MS;
        this.ball.setTintOffset(this.p2.colorOffset);
        sound.vh();
      }
    }

    // fault: 4th touch → point for the opponent
    if (this.p1.contact > 3) {
      this.setDanger(1, "red");
      this.setDanger(2, "green");
      this.win1 = false;
      this.point2++;
      this.afterScore();
      return;
    }
    if (this.p2.contact > 3) {
      this.setDanger(2, "red");
      this.setDanger(1, "green");
      this.win1 = true;
      this.point1++;
      this.afterScore();
      return;
    }

    // fall to the floor: landing on your side gives the point to the opponent
    if (c.ballOnFloor && !ballHeld) {
      const x = c2.x;
      if (x < SIDE_THRESHOLD) {
        this.point2++;
        this.setDanger(2, "green");
        this.setDanger(1, "off");
        this.win1 = false;
        this.afterScore();
      } else if (x > SIDE_THRESHOLD) {
        this.point1++;
        this.setDanger(1, "green");
        this.setDanger(2, "off");
        this.win1 = true;
        this.afterScore();
      }
    }
  }

  // ── Real timers ──────────────────────────────────────────────────────────
  private tickTimers(): void {
    // live-points popup (rises and fades) — runs even during slow-motion
    if (this.liveMs > 0) {
      this.liveMs -= FIXED_DT;
      this.liveText.y -= 0.6;
      this.liveText.alpha = Math.max(0, this.liveMs / 1000);
      if (this.liveMs <= 0) this.liveText.visible = false;
    }
    // serve countdown
    if (this.delayRunning) {
      this.delayMs += FIXED_DT;
      while (this.delayMs >= 1000 && this.delayCount < 6) {
        this.delayMs -= 1000;
        this.delayCount++;
        this.onDelay(this.delayCount);
      }
      if (this.ball.ballOfPlayer === 0) {
        this.delayRunning = false;
        this.updateScoreboard();
      }
    }
    // goal slow-motion
    if (this.goalRunning) {
      this.goalMs += FIXED_DT;
      if (this.goalMs >= GOAL_MS) {
        this.goalRunning = false;
        this.onGoal();
      }
    }
  }

  private onDelay(count: number): void {
    if (count <= 2) return;
    this.scoreboard.text = `${6 - count} sec`; // 3→"3 sec" … 6→"0 sec"
    if (count === 6) {
      // did not serve in time → fault (penalty)
      if (this.ball.ballOfPlayer === 1) {
        this.p1.releaseBall();
        this.p1.contact = 4;
        this.p2.contact = 0;
      } else if (this.ball.ballOfPlayer === 2) {
        this.p2.releaseBall();
        this.p2.contact = 4;
        this.p1.contact = 0;
      }
    }
  }

  private onGoal(): void {
    if (this.point1 >= GAME_SET) {
      this.endGame(1);
      return;
    }
    if (this.point2 >= GAME_SET) {
      this.endGame(2);
      return;
    }
    this.newRound();
  }

  // ── Round flow ───────────────────────────────────────────────────────────
  private afterScore(): void {
    this.updateScoreboard();
    sound.sfx("SCORE3");
    if (this.campaignLevel > 0) this.showLivePoints(this.win1);
    this.p1.contact = 0;
    this.p2.contact = 0;
    this.viewGoal();
  }

  /** Floating popup: +100×level (you scored) / −25×level (you conceded). viewLivePoints. */
  private showLivePoints(scoredByP1: boolean): void {
    const lvl = this.campaignLevel;
    const s = worldToScreen(this.ball.body.getWorldCenter().x, this.ball.body.getWorldCenter().y);
    this.liveText.text = scoredByP1 ? `+${100 * lvl} points` : `-${25 * lvl} points`;
    this.liveText.style.fill = scoredByP1 ? 0x00ff00 : 0xff0000;
    this.liveText.position.set(s.x, s.y);
    this.liveText.alpha = 1;
    this.liveText.visible = true;
    this.liveMs = 1000;
  }

  /** Dramatic slow-motion of the point (viewGoal). */
  private viewGoal(): void {
    this.disableUpdate = true;
    this.delayRunning = false;
    this.goalRunning = true;
    this.goalMs = 0;
    this.setTimeStep(TIMESTEP_GOAL);
  }

  /** Stands players up again, gives the serve to the winner and starts the countdown (game.newRound). */
  newRound(): void {
    this.p1.standPlayer(PLAYER_SPAWN[1].x, PLAYER_SPAWN[1].y);
    this.p2.standPlayer(PLAYER_SPAWN[2].x, PLAYER_SPAWN[2].y);
    this.p1.contact = 0;
    this.p2.contact = 0;
    this.setDanger(1, "off");
    this.setDanger(2, "off");
    this.p1.releaseBall();
    this.p2.releaseBall();
    if (this.win1) {
      if (this.p1.takeBall(this.ball.body)) this.ball.ballOfPlayer = 1;
    } else {
      if (this.p2.takeBall(this.ball.body)) this.ball.ballOfPlayer = 2;
    }
    this.ball.setTintOffset((this.win1 ? this.p1 : this.p2).colorOffset);
    // resume normal speed and arm the countdown
    this.disableUpdate = false;
    this.setTimeStep(TIMESTEP_GAME);
    this.delayRunning = true;
    this.delayMs = 0;
    this.delayCount = 0;
  }

  private endGame(side: PlayerId): void {
    this.ended = true;
    this.disableUpdate = true;
    this.setDanger(1, "off");
    this.setDanger(2, "off");
    this.scoreboard.text = side === 1 ? "you win" : "you lose";
    if (this.campaignLevel > 0) {
      campaign.recordResult(this.campaignLevel as LevelId, this.point1, this.point2, side === 1);
    }
  }

  private updateScoreboard(): void {
    this.scoreboard.text = `${this.point1} - ${this.point2}`;
  }
}
