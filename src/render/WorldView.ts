import { Assets, Container, Sprite } from "pixi.js";
import { spriteFrame } from "../core/assets";
import { COURT_IMG, WORLD_OFFSET, WORLD_SCALE } from "../core/constants";

/**
 * Physics world layer. Reproduces the original's `world` container:
 * scale 0.56 and position (124,180). This layer's LOCAL space is in
 * "world pixels" = meters × PHYS_SCALE — so any body is drawn
 * at (pos_m × 30) inside here, and the container scale/offset does the rest.
 */
export class WorldView {
  readonly layer: Container;

  constructor() {
    this.layer = new Container();
    this.layer.scale.set(WORLD_SCALE);
    this.layer.position.set(WORLD_OFFSET.x, WORLD_OFFSET.y);
  }

  /** Court background (mc_gameFon). Position/scale calibrated in COURT_IMG. */
  async loadCourt(): Promise<void> {
    const tex = await Assets.load(spriteFrame("DefineSprite_8_mc_gameFon", 1));
    const court = new Sprite(tex);
    court.position.set(COURT_IMG.x, COURT_IMG.y);
    court.scale.set(COURT_IMG.scale);
    this.layer.addChildAt(court, 0);
  }
}
