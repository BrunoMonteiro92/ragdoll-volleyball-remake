/**
 * Physics and render constants extracted 1:1 from the original game (RV.swf).
 * Reference: rigdsos/scripts/world/world.as, game.as, staff/ground.as, ball.as,
 * player/player.as, staff/prizeButton.as, staff/executer.as.
 *
 * Original convention: display positions in PIXELS; Box2D positions in
 * METERS = pixels / PHYS_SCALE.
 */

// ── Stage ────────────────────────────────────────────────────────────────────
export const STAGE = { width: 601, height: 401 } as const;

// ── Box2D / planck ────────────────────────────────────────────────────────────
export const PHYS_SCALE = 30; // world.m_physScale — px <-> m
export const GRAVITY = { x: 0, y: 10 } as const; // world.as
export const ITERATIONS = 10; // world.m_iterations (velocity iterations)

// timesteps (seconds) — the original swaps m_timeStep depending on the state
export const TIMESTEP_MENU = 1 / 25; // world() initial
export const TIMESTEP_GAME = 1 / 28; // game() in a match
export const TIMESTEP_GOAL = 1 / 200; // viewGoal() slow camera
export const TIMESTEP_PAUSE = 0; // pause

/**
 * Logic loop cadence. The original runs 1 world.Step per ENTER_FRAME (at the
 * SWF frame rate, not exported). We run a fixed-timestep loop at this rate and
 * do 1 step of TIMESTEP_GAME per tick. Tunable to match the feel.
 */
export const GAME_FPS = 30;

// ── Camera / physics world render ───────────────────────────────────────────────
// world.as: container with scaleX/Y = 0.56, x = 124, y = 180.
export const WORLD_SCALE = 0.56;
export const WORLD_OFFSET = { x: 124, y: 180 } as const;

/** Converts a Box2D position (meters) -> SCREEN pixel (with scale+offset). */
export function worldToScreen(xMeters: number, yMeters: number) {
  return {
    x: WORLD_OFFSET.x + xMeters * PHYS_SCALE * WORLD_SCALE,
    y: WORLD_OFFSET.y + yMeters * PHYS_SCALE * WORLD_SCALE,
  };
}

export const px2m = (px: number) => px / PHYS_SCALE;
export const m2px = (m: number) => m * PHYS_SCALE;

/**
 * Court background (mc_gameFon) — DISPLAY transform in the worldLayer local
 * space. Pure decoration: does not affect physics. Original ≈ (-220,-320, /0.56).
 * x=-230 adjusted by measurement (painted mast img x≈308 → physics net screen x≈303);
 * y=-360 calibrated visually; scale = native (1/0.56).
 */
export const COURT_IMG = { x: -230, y: -360, scale: 1 / WORLD_SCALE };

// ── Court (staff/ground.as) — in PIXELS (centers and half-extents of the boxes) ──
// e_bodytype: 2 = wall/net, 15 = floor, (0) = ceiling.
export const COURT = {
  leftWall: { x: -265, y: -230, hx: 50, hy: 650, bodytype: 2 },
  rightWall: { x: 890, y: -230, hx: 50, hy: 650, bodytype: 2 },
  ceiling: { x: 320, y: -900, hx: 600, hy: 50, bodytype: 0 },
  floor: { x: 320, y: 405, hx: 600, hy: 50, bodytype: 15 },
  net: { x: 320, y: 281, hx: 1, hy: 75, friction: 2.5, bodytype: 2 },
} as const;

/** net x in meters (≈10.67). game.as uses 10.6/10.7 as the side threshold. */
export const NET_X_M = COURT.net.x / PHYS_SCALE;
export const SIDE_THRESHOLD = 10.6; // game.as: <10.6 -> P1 side; >10.6 -> P2 side
export const PAS_THRESHOLD = 10.7; // player.pas / prizeButton.sendPrize

// ── Ball (staff/ball.as) ───────────────────────────────────────────────────────
export const BALL = {
  start: { x: 200, y: 20 }, // px (world.CreateLevel)
  radiusPx: 15,
  density: 0.1,
  friction: 0.05,
  restitution: 1,
  mass: 0.1,
  inertia: 0.01,
  bodytype: 3,
  // velocity clamps (m/s) in update()
  maxVX: 15,
  maxVY: 20,
} as const;

// ── Players (player/player.as) ─────────────────────────────────────────────────
export const PLAYER_SPAWN = {
  1: { x: 100, y: 256 },
  2: { x: 500, y: 256 },
} as const;

// friction that encodes identity in the original (we keep the VALUE for physics;
// the IDENTITY goes through userData in the remake).
export const FRICTION_P1 = 0.5;
export const FRICTION_P2 = 0.51;

// ── Prize / Executer (staff/prizeButton.as, executer.as) ───────────────────────
export const PRIZE_BUTTON = {
  left: { x: -211, y: -245, hx: 3, hy: 35, friction: 0.4, bodytype: 7 },
  right: { x: 837, y: -245, hx: 3, hy: 35, friction: 0.4, bodytype: 7 },
} as const;

export const EXECUTER = {
  spawnP1: { x: 3.5, y: -4 }, // meters
  spawnP2: { x: 17.5, y: -4 }, // meters
  radiusPx: 18,
  density: 1,
  friction: 0.3,
  restitution: 1,
  mass: 400,
  inertia: 0.1,
  bodytype: 777,
} as const;

// ── Rules (world/options.as, game.as) ──────────────────────────────────────────
export const GAME_SET = 10; // options.gameSet — points to win
