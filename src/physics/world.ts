import { Vec2, World } from "planck";
import { GRAVITY } from "../core/constants";

/** Creates the b2World equivalent of the original: gravity (0,10). */
export function createWorld(): World {
  return new World({ gravity: new Vec2(GRAVITY.x, GRAVITY.y) });
}
