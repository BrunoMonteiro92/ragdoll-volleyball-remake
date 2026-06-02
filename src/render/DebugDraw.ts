import { type Container, Graphics } from "pixi.js";
import type { World } from "planck";
import { m2px } from "../core/constants";
import type { BodyKind, BodyUserData } from "../core/types";

const KIND_COLOR: Record<BodyKind, number> = {
  wall: 0x888888,
  net: 0xffd000,
  ceiling: 0x4488ff,
  floor: 0x33dd66,
  ball: 0xffffff,
  playerPart: 0xff5599,
  button: 0xff8800,
  executer: 0xff2222,
  prismCage: 0x9966ff,
};

/** Physics overlay: outlines each fixture (planck) in "world pixels". */
export class DebugDraw {
  readonly g = new Graphics();
  visible: boolean;

  constructor(parent: Container, visible = false) {
    this.visible = visible;
    this.g.visible = visible;
    parent.addChild(this.g);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.g.visible = this.visible;
  }

  redraw(world: World): void {
    if (!this.visible) return;
    const g = this.g;
    g.clear();

    for (let b = world.getBodyList(); b; b = b.getNext()) {
      const ud = b.getUserData() as BodyUserData | null;
      const color = ud?.kind ? KIND_COLOR[ud.kind] : 0xffffff;

      for (let f = b.getFixtureList(); f; f = f.getNext()) {
        const shape = f.getShape();
        const type = shape.getType();

        if (type === "polygon") {
          const poly = shape as unknown as {
            m_vertices: { x: number; y: number }[];
            m_count: number;
          };
          const pts: number[] = [];
          for (let i = 0; i < poly.m_count; i++) {
            const wp = b.getWorldPoint(poly.m_vertices[i]);
            pts.push(m2px(wp.x), m2px(wp.y));
          }
          g.poly(pts);
          g.stroke({ width: 2, color, alpha: 0.9 });
        } else if (type === "circle") {
          const circ = shape as unknown as { m_p: { x: number; y: number }; m_radius: number };
          const wc = b.getWorldPoint(circ.m_p);
          g.circle(m2px(wc.x), m2px(wc.y), m2px(circ.m_radius));
          g.stroke({ width: 2, color, alpha: 0.9 });
        }
      }
    }
  }
}
