import { type Container, Graphics } from "pixi.js";
import type { World } from "planck";
import { m2px } from "../core/constants";
import type { BodyUserData } from "../core/types";

/**
 * The ragdoll's "tissue lines" — 1:1 with world.DrawBlood().
 * For each joint linking TWO player parts, draws a thick dark-red segment
 * between the anchors (visually fills in the joints).
 * Sits behind the part sprites.
 */
export class BloodDraw {
  readonly g = new Graphics();

  constructor(parent: Container) {
    parent.addChild(this.g);
  }

  redraw(world: World): void {
    const g = this.g;
    g.clear();
    let any = false;
    for (let j = world.getJointList(); j; j = j.getNext()) {
      const a = j.getBodyA().getUserData() as BodyUserData | null;
      const b = j.getBodyB().getUserData() as BodyUserData | null;
      if (a?.kind === "playerPart" && b?.kind === "playerPart") {
        const an = j.getAnchorA();
        const bn = j.getAnchorB();
        g.moveTo(m2px(an.x), m2px(an.y));
        g.lineTo(m2px(bn.x), m2px(bn.y));
        any = true;
      }
    }
    if (any) g.stroke({ width: 4, color: 0xb40707, cap: "round", join: "round" });
  }
}
