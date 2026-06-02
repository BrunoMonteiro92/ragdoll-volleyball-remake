import { Vec2 } from "planck";
import type { Ball } from "../entities/Ball";
import type { Player } from "../entities/Player";
import type { Keys } from "./keys";

/**
 * Keyboard → movement mapping, 1:1 with input/control.as.
 * P1 = arrows + Space (pas) · P2 = WASD + R (pas). Called per player on the fixed step.
 * jump is edge-triggered (1×/press); turn/turnDown/pas are continuous while held.
 */
export class Control {
  disabled = false;

  constructor(
    private readonly keys: Keys,
    private readonly ball: Ball,
  ) {}

  update(p: Player): void {
    if (this.disabled) return;
    const k = this.keys;
    if (p.id === 1) {
      if (k.wasPressed("ArrowUp")) p.jump();
      if (k.isDown("ArrowDown")) p.turnDown();
      if (k.isDown("ArrowLeft")) p.turn(new Vec2(-4, 0));
      if (k.isDown("ArrowRight")) p.turn(new Vec2(4, 0));
      if (k.isDown("Space")) p.pas(this.ball);
    } else {
      if (k.wasPressed("KeyW")) p.jump();
      if (k.isDown("KeyS")) p.turnDown();
      if (k.isDown("KeyA")) p.turn(new Vec2(-4, 0));
      if (k.isDown("KeyD")) p.turn(new Vec2(4, 0));
      if (k.isDown("KeyR")) p.pas(this.ball);
    }
  }
}
