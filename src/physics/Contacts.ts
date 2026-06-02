import type { Contact } from "planck";
import { Vec2, type World } from "planck";
import type { BodyUserData, PlayerId } from "../core/types";
import type { Ball } from "../entities/Ball";

/**
 * Contact listener — analogous to libs/MyContactListener.as (via post-solve, which
 * carries the resolved contact, the closest equivalent to b2ContactResult).
 * Instead of reading friction (0.05/0.5/0.51) and e_bodytype, it reads the typed userData.
 *
 * Flags are SET during world.step and CONSUMED right after (damping +
 * reads by the Game), so `clear()` must be called at the end of each fixed step.
 */
export class Contacts {
  ballHitWall = false; // wall or net (damps vx ×0.6)
  ballHitButton = false; // prize button (damps vx ×0.4) — Phase 8
  ballOnFloor = false; // floor → onBallDown
  ballTouchedPlayer: 0 | PlayerId = 0; // last player part touched
  ballContacted = false; // any ball contact (bYesContact)

  constructor(world: World) {
    const handle = (contact: Contact) => {
      const udA = contact.getFixtureA().getBody().getUserData() as BodyUserData | null;
      const udB = contact.getFixtureB().getBody().getUserData() as BodyUserData | null;
      const ballIsA = udA?.kind === "ball";
      const ballIsB = udB?.kind === "ball";
      if (!ballIsA && !ballIsB) return;
      const other = ballIsA ? udB : udA;
      if (!other) return;

      this.ballContacted = true;
      switch (other.kind) {
        case "wall":
        case "net":
          this.ballHitWall = true;
          break;
        case "button":
          this.ballHitButton = true;
          break;
        case "floor":
          this.ballOnFloor = true;
          break;
        case "playerPart":
          if (other.playerId) this.ballTouchedPlayer = other.playerId;
          break;
      }
    };
    // begin-contact catches quick touches (ball is bullet); post-solve catches sustained contacts
    world.on("begin-contact", handle);
    world.on("post-solve", handle);
  }

  /** Damps the ball's X: wall/net ×0.6, button ×0.4 (MyContactListener.Result). */
  applyBallDamping(ball: Ball): void {
    if (!this.ballHitWall && !this.ballHitButton) return;
    const v = ball.body.getLinearVelocity();
    const factor = this.ballHitButton ? 0.4 : 0.6;
    ball.body.setLinearVelocity(new Vec2(v.x * factor, v.y));
  }

  /** Resets the step's flags. */
  clear(): void {
    this.ballHitWall = false;
    this.ballHitButton = false;
    this.ballOnFloor = false;
    this.ballTouchedPlayer = 0;
    this.ballContacted = false;
  }
}
