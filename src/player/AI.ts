import { Vec2 } from "planck";
import { GAME_FPS } from "../core/constants";
import { options } from "../core/options";
import type { Ball } from "../entities/Ball";
import type { Player } from "../entities/Player";

const FIXED_DT = 1000 / GAME_FPS;
const PAS_TICK_MS = 700; // Pas_timer = Timer(700, 5)
const PAS_MAX_TICKS = 5;

/**
 * Computer AI (player 2 in 1-player mode) — 1:1 with player/AI.as.
 * Chases the ball with turnComp (clamped to maxSpeed), and once holding the ball runs
 * the Pas_timer sequence (position → jump → serve).
 */
export class AI {
  disabled = false;

  private actCount = 0;
  private disableMoveAfterPas = false;
  private prevBallOwner = 0;

  // Pas_timer as a real-time accumulator
  private pasRunning = false;
  private pasMs = 0;
  private pasTicks = 0;

  constructor(
    private readonly computer: Player,
    private readonly ball: Ball,
  ) {}

  update(): void {
    if (this.disabled) return;
    const comp = this.computer;
    const ball = this.ball;

    // on (re)gaining the ball, reset the serve sequence
    if (ball.ballOfPlayer === 2 && this.prevBallOwner !== 2) this.resetServe();
    this.prevBallOwner = ball.ballOfPlayer;

    this.tickPasTimer();

    // holding the ball: position and then start the serve sequence
    if (ball.ballOfPlayer === 2 && this.actCount === 0) {
      if (ball.body.getWorldCenter().x < 11) comp.turn(new Vec2(1, 0));
      else this.startPasTimer();
    }

    const bc = ball.body.getWorldCenter();
    const head = comp.bodies.Head.getWorldCenter();
    const lx = bc.x - head.x; // head→ball vector
    const ly = bc.y - head.y;

    // chase the ball when it's on the CPU side and free
    if (bc.x > 10 && ball.ballOfPlayer !== 2 && !this.disableMoveAfterPas) {
      let spd = Math.abs(ball.body.getLinearVelocity().x);
      if (Math.abs(lx) > 1 && spd < 4) spd *= 2;
      if (spd > options.AImaxSpeed) spd = options.AImaxSpeed;
      if (head.x < bc.x + 0.3) comp.turnComp(new Vec2(spd, 0));
      else comp.turnComp(new Vec2(-spd, 0));
    }

    // decision by the CPU's touch count
    switch (comp.contact) {
      case 0:
        if (bc.x < 10.7) {
          if (lx > -7 && lx < 0 && ly > -7 && ly < 0 && ball.ballOfPlayer === 0) comp.jump();
          else this.goToXPlace(12.7, 2);
        }
        if (bc.x > 10 && ly > -3 && ball.ballOfPlayer !== 2) comp.turnDown();
        break;
      case 2:
        if (lx < 1.5 && lx > 0.5 && bc.x > 9) comp.turnComp(new Vec2(1.5, 0));
        if (lx > -1.5 && lx < 0 && ly > -2.5 && ly < 0) comp.jump();
        break;
      case 1:
        if (lx > -1.5 && lx < 0 && ly > -5.5 && ly < 0) comp.jump();
        break;
    }
  }

  private goToXPlace(x: number, speed: number): void {
    const headX = this.computer.bodies.Head.getWorldCenter().x;
    if (headX > x) this.computer.turn(new Vec2(-speed, 0));
    else if (headX < x) this.computer.turn(new Vec2(speed, 0));
  }

  // ── Pas_timer (serve sequence) ─────────────────────────────────────────────
  private startPasTimer(): void {
    if (this.pasRunning) return;
    this.pasRunning = true;
    this.pasMs = 0;
    this.pasTicks = 0;
  }

  private resetServe(): void {
    this.actCount = 0;
    this.disableMoveAfterPas = false;
    this.pasRunning = false;
    this.pasMs = 0;
    this.pasTicks = 0;
  }

  private tickPasTimer(): void {
    if (!this.pasRunning) return;
    this.pasMs += FIXED_DT;
    while (this.pasMs >= PAS_TICK_MS && this.pasTicks < PAS_MAX_TICKS) {
      this.pasMs -= PAS_TICK_MS;
      this.pasTicks++;
      this.onPasTick();
    }
    if (this.pasTicks >= PAS_MAX_TICKS) this.pasRunning = false;
  }

  private onPasTick(): void {
    const comp = this.computer;
    if (this.ball.ballOfPlayer === 2 || this.disableMoveAfterPas) this.actCount++;
    switch (this.actCount) {
      case 2:
        comp.jump();
        break;
      case 3:
        comp.pas(this.ball);
        comp.turn(new Vec2(16, 0));
        if (this.ball.ballOfPlayer === 2)
          this.actCount = 1; // still holding: try again
        else this.disableMoveAfterPas = true;
        break;
      case 4:
        this.resetServe();
        break;
    }
  }
}
