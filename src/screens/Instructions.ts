import { Assets, Container, Sprite, Text, type Texture } from "pixi.js";
import { spriteFrame } from "../core/assets";

/**
 * Instructions screen — 4 pages (mc_instructions) + "next" button that cycles.
 * Returns to menu via Esc (handled in main).
 */
export class Instructions {
  readonly container = new Container();
  private pageSprite!: Sprite;
  private frames: Texture[] = [];
  private idx = 0;

  async load(): Promise<void> {
    await document.fonts.load('14px "Alba Super"').catch(() => {});
    this.frames = await Promise.all(
      [1, 2, 3, 4].map((n) =>
        Assets.load<Texture>(spriteFrame("DefineSprite_302_mc_instructions", n)),
      ),
    );
    this.pageSprite = new Sprite(this.frames[0]);
    this.pageSprite.position.set(153, 61); // panel 295×278 centered
    this.container.addChild(this.pageSprite);

    const next = new Text({
      text: "next ▶",
      style: { fontFamily: "Alba Super", fontSize: 18, fill: 0xffe066 },
    });
    next.anchor.set(0.5);
    next.position.set(300, 360);
    next.eventMode = "static";
    next.cursor = "pointer";
    next.on("pointerover", () => next.scale.set(1.1));
    next.on("pointerout", () => next.scale.set(1));
    next.on("pointertap", () => {
      this.idx = (this.idx + 1) % this.frames.length;
      this.pageSprite.texture = this.frames[this.idx];
    });
    this.container.addChild(next);
  }

  /** returns to page 1 when reopened. */
  reset(): void {
    this.idx = 0;
    if (this.pageSprite) this.pageSprite.texture = this.frames[0];
  }
}
