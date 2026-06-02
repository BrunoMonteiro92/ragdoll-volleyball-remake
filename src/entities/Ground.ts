import { type Body, Box, Vec2, type World } from "planck";
import { COURT, px2m } from "../core/constants";
import type { BodyKind, BodyUserData } from "../core/types";

interface BoxOpts {
  friction?: number;
  label?: string;
}

function addStaticBox(
  world: World,
  cxPx: number,
  cyPx: number,
  hxPx: number,
  hyPx: number,
  kind: BodyKind,
  opts: BoxOpts = {},
): Body {
  const ud: BodyUserData = { kind, label: opts.label };
  const body = world.createBody({
    type: "static",
    position: new Vec2(px2m(cxPx), px2m(cyPx)),
    userData: ud,
  });
  body.createFixture({
    shape: new Box(px2m(hxPx), px2m(hyPx)),
    friction: opts.friction ?? 0.2, // Box2D default (walls/floor/ceiling)
    userData: ud,
  });
  return body;
}

/**
 * Static court geometry — 1:1 with staff/ground.as.
 * Side walls, ceiling, floor and the central net (friction 2.5).
 */
export function buildGround(world: World): void {
  const c = COURT;
  addStaticBox(world, c.leftWall.x, c.leftWall.y, c.leftWall.hx, c.leftWall.hy, "wall", {
    label: "leftWall",
  });
  addStaticBox(world, c.rightWall.x, c.rightWall.y, c.rightWall.hx, c.rightWall.hy, "wall", {
    label: "rightWall",
  });
  addStaticBox(world, c.ceiling.x, c.ceiling.y, c.ceiling.hx, c.ceiling.hy, "ceiling", {
    label: "ceiling",
  });
  addStaticBox(world, c.floor.x, c.floor.y, c.floor.hx, c.floor.hy, "floor", { label: "floor" });
  addStaticBox(world, c.net.x, c.net.y, c.net.hx, c.net.hy, "net", {
    friction: c.net.friction,
    label: "net",
  });
}
