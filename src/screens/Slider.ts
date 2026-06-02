import { Container, type FederatedPointerEvent, Graphics } from "pixi.js";

/** Draggable horizontal slider (value 0..1) — equivalent to color_changerPick. */
export class Slider extends Container {
  value = 0;
  onChange?: (v: number) => void;

  private readonly knob: Graphics;
  private readonly len: number;
  private dragging = false;

  constructor(length = 60) {
    super();
    this.len = length;
    const track = new Graphics()
      .roundRect(0, -3, length, 6, 3)
      .fill({ color: 0xffffff, alpha: 0.3 });
    track.eventMode = "static";
    track.cursor = "pointer";
    this.knob = new Graphics().circle(0, 0, 6).fill(0xffe066);
    this.addChild(track, this.knob);

    const move = (e: FederatedPointerEvent) => {
      const lx = this.toLocal(e.global).x;
      this.set(Math.max(0, Math.min(1, lx / this.len)));
    };
    track.on("pointerdown", (e: FederatedPointerEvent) => {
      this.dragging = true;
      move(e);
    });
    track.on("globalpointermove", (e: FederatedPointerEvent) => {
      if (this.dragging) move(e);
    });
    track.on("pointerup", () => (this.dragging = false));
    track.on("pointerupoutside", () => (this.dragging = false));
  }

  /** Sets the value and moves the knob; fires onChange (if assigned). */
  set(v: number): void {
    this.value = v;
    this.knob.x = v * this.len;
    this.onChange?.(v);
  }
}
