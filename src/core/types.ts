import type { Container } from "pixi.js";

/**
 * Replaces the magic `e_bodytype` values (1/2/3/7/15/777) and the friction-as-identity
 * of the original with typed userData, read in the contact listeners.
 */
export type BodyKind =
  | "wall" // 2
  | "net" // 2 (friction 2.5)
  | "ceiling" // 0
  | "floor" // 15
  | "ball" // 3
  | "playerPart" // 1
  | "button" // 7
  | "executer" // 777
  | "prismCage"; // prismatic cage (sensor, invisible)

export type PlayerId = 1 | 2;

export interface BodyUserData {
  kind: BodyKind;
  playerId?: PlayerId;
  /** display sprite/clip synced to this body (when present) */
  view?: Container;
  /** part/object name, for debug (e.g. 'Head', 'leftWall') */
  label?: string;
}
