import { Assets, Container, Sprite } from "pixi.js";
import { type Body, Box, Circle, PrismaticJoint, RevoluteJoint, Vec2, type World } from "planck";
import { sound } from "../audio/sound";
import { spriteFrame } from "../core/assets";
import { FRICTION_P1, FRICTION_P2, GAME_FPS, m2px, PAS_THRESHOLD, px2m } from "../core/constants";
import type { BodyUserData, PlayerId } from "../core/types";
import { additiveColorMatrix } from "../render/colorize";
import type { Ball } from "./Ball";

const DEG = Math.PI / 180;
const FIXED_DT = 1000 / GAME_FPS; // ms per logic step

// vertical offset (texture px) of clothing pieces over the part —
// the frame nearly matches, but the piece needs to drop a bit. Eyeballed.
const BODYDRESS_DY = 4; // bra (sex 1)
const ASSDRESS_DY = 6; // panties / trunks (piece embedded in mc_Ass starts at y6)

export type PartName =
  | "HandLeft"
  | "HandRight"
  | "ArmLeft"
  | "ArmRight"
  | "Tors"
  | "Head"
  | "FingerLeft"
  | "FingerRight"
  | "FootLeft"
  | "FootRight"
  | "LegLeft"
  | "LegRight"
  | "Ass";

type Shape = { box: [number, number] } | { circle: number };
interface PartDef {
  name: PartName;
  dx: number; // px, relative to spawn
  dy: number;
  shape: Shape; // half-extents/radius in px
  density: number;
  rest: number;
}

/** Parts in CREATION ORDER = original's z order (addChild). */
const PART_DEFS: PartDef[] = [
  { name: "HandLeft", dx: -41, dy: 18, shape: { box: [12, 4] }, density: 1, rest: 1 },
  { name: "HandRight", dx: 41, dy: 18, shape: { box: [12, 4] }, density: 1, rest: 1 },
  { name: "ArmLeft", dx: -22, dy: 18, shape: { box: [12, 4] }, density: 1, rest: 1 },
  { name: "ArmRight", dx: 22, dy: 18, shape: { box: [12, 4] }, density: 1, rest: 1 },
  { name: "Tors", dx: 0, dy: 32, shape: { box: [10, 17] }, density: 0.1, rest: 1 },
  { name: "Head", dx: 0, dy: 2, shape: { circle: 10 }, density: 1, rest: 1.2 },
  { name: "FingerLeft", dx: -54, dy: 18, shape: { box: [4, 4] }, density: 1, rest: 1 },
  { name: "FingerRight", dx: 54, dy: 18, shape: { box: [4, 4] }, density: 1, rest: 1 },
  { name: "FootLeft", dx: -7, dy: 90, shape: { box: [5, 11] }, density: 1, rest: 1 },
  { name: "FootRight", dx: 7, dy: 90, shape: { box: [5, 11] }, density: 1, rest: 1 },
  { name: "LegLeft", dx: -7, dy: 69, shape: { box: [5, 13] }, density: 1, rest: 1 },
  { name: "LegRight", dx: 7, dy: 69, shape: { box: [5, 13] }, density: 1, rest: 1 },
  { name: "Ass", dx: 0, dy: 50, shape: { box: [10, 6] }, density: 1, rest: 1 },
];

/** [bodyA, bodyB, anchorDx, anchorDy(px rel. spawn), lowerDeg, upperDeg] */
const JOINT_DEFS: [PartName, PartName, number, number, number, number][] = [
  ["Tors", "Head", 0, 10, -30, 30],
  ["Ass", "Tors", 0, 45, -30, 30],
  ["ArmRight", "Tors", 12, 18, -100, 85],
  ["ArmLeft", "Tors", -12, 18, -85, 100],
  ["ArmRight", "HandRight", 31, 18, -10, 100],
  ["ArmLeft", "HandLeft", -31, 18, -100, 10],
  ["FingerRight", "HandRight", 53, 18, -10, 40],
  ["FingerLeft", "HandLeft", -53, 18, -40, 10],
  ["LegLeft", "Ass", -6, 56, -30, 3],
  ["LegRight", "Ass", 6, 56, -3, 30],
  ["LegRight", "FootRight", 6, 80, -10, 25],
  ["LegLeft", "FootLeft", -6, 80, -25, 10],
];

/** Horizontal cage limits per player (PrismBody↔ground). */
const CAGE_H: Record<PlayerId, { lo: number; hi: number }> = {
  1: { lo: -13, hi: 5.8 },
  2: { lo: -4.4, hi: 14 },
};

/** Standing pose (standPlayer) — offsets px rel. spawn (note the FootRight quirk). */
const STAND: [PartName, number, number][] = [
  ["Head", 0, 2],
  ["Tors", 0, 28],
  ["ArmRight", 22, 18],
  ["ArmLeft", -22, 18],
  ["HandRight", 41, 18],
  ["HandLeft", -41, 18],
  ["FingerRight", 54, 18],
  ["FingerLeft", -54, 18],
  ["Ass", 0, 47],
  ["LegLeft", -7, 69],
  ["LegRight", 7, 69],
  ["FootLeft", -7, 90],
  ["FootRight", -7, 90],
];

/** DefineSprite per part and per sex (1 = mc_*, 2 = mc_*2). */
const PART_SPRITE: Record<PartName, Record<1 | 2, string>> = {
  Head: { 1: "DefineSprite_107_mc_Head", 2: "DefineSprite_171_mc_Head2" },
  Tors: { 1: "DefineSprite_104_mc_Body", 2: "DefineSprite_168_mc_Body2" },
  Ass: { 1: "DefineSprite_99_mc_Ass", 2: "DefineSprite_196_mc_Ass2" },
  ArmLeft: { 1: "DefineSprite_82_mc_ArmL", 2: "DefineSprite_174_mc_ArmL2" },
  ArmRight: { 1: "DefineSprite_84_mc_ArmR", 2: "DefineSprite_176_mc_ArmR2" },
  HandLeft: { 1: "DefineSprite_89_mc_HandL", 2: "DefineSprite_163_mc_HandL2" },
  HandRight: { 1: "DefineSprite_87_mc_HandR", 2: "DefineSprite_165_mc_HandR2" },
  FingerLeft: { 1: "DefineSprite_133_mc_FingersL", 2: "DefineSprite_179_mc_FingersL2" },
  FingerRight: { 1: "DefineSprite_110_mc_FingersR", 2: "DefineSprite_181_mc_FingersR2" },
  LegLeft: { 1: "DefineSprite_94_mc_LegL", 2: "DefineSprite_186_mc_LegL2" },
  LegRight: { 1: "DefineSprite_92_mc_LegR", 2: "DefineSprite_184_mc_LegR2" },
  FootLeft: { 1: "DefineSprite_77_mc_FootL", 2: "DefineSprite_189_mc_FootL2" },
  FootRight: { 1: "DefineSprite_79_mc_FootR", 2: "DefineSprite_191_mc_FootR2" },
};

interface Part {
  name: PartName;
  body: Body;
  sprite?: Sprite;
}

/**
 * Ragdoll of a player — 1:1 with player/player.as.
 * Bodies+joints+cage, standPlayer/takeBall and the moves (turn/jump/turnDown/pas).
 */
export class Player {
  readonly id: PlayerId;
  readonly sex: 1 | 2;
  readonly container = new Container();
  readonly bodies = {} as Record<PartName, Body>;
  PrismBody!: Body;

  /** rally touch counter (read by the scoreboard — Phase 6). */
  contact = 0;

  /** color offset (0xRRGGBB) — used to tint this player's ball/executer. */
  colorOffset = 0x2b2b2b;

  private readonly parts: Part[] = [];
  private ballJoint?: RevoluteJoint;
  private pasTimerMs = 0;
  // tintable clothing pieces (overlaid on the parts): bra, panties/trunks
  private bodyDressSprite?: Sprite;
  private assDressSprite?: Sprite;

  constructor(
    private readonly world: World,
    private readonly parentLayer: Container,
    x: number,
    y: number,
    id: PlayerId,
    sex: 1 | 2,
    groundAnchor: Body,
  ) {
    this.id = id;
    this.sex = sex;
    const friction = id === 1 ? FRICTION_P1 : FRICTION_P2;

    // ── Bodies of the 13 parts ────────────────────────────────────────────
    for (const def of PART_DEFS) {
      const pos = new Vec2(px2m(x + def.dx), px2m(y + def.dy));
      const ud: BodyUserData = { kind: "playerPart", playerId: id, label: def.name };
      const body = world.createBody({
        type: "dynamic",
        position: pos,
        angularDamping: 0,
        userData: ud,
      });
      const shape =
        "circle" in def.shape
          ? new Circle(px2m(def.shape.circle))
          : new Box(px2m(def.shape.box[0]), px2m(def.shape.box[1]));
      body.createFixture({
        shape,
        density: def.density,
        friction,
        restitution: def.rest,
        userData: ud,
      });
      this.bodies[def.name] = body;
      this.parts.push({ name: def.name, body });
    }

    // ── Revolute joints with angle limits ─────────────────────────────────
    for (const [a, b, adx, ady, lo, hi] of JOINT_DEFS) {
      world.createJoint(
        new RevoluteJoint(
          { enableLimit: true, lowerAngle: lo * DEG, upperAngle: hi * DEG },
          this.bodies[a],
          this.bodies[b],
          new Vec2(px2m(x + adx), px2m(y + ady)),
        ),
      );
    }

    // ── PrismBody cage (sensor) + 2 prismatic joints ──────────────────────
    const cageUd: BodyUserData = { kind: "prismCage", playerId: id, label: "PrismBody" };
    this.PrismBody = world.createBody({
      type: "dynamic",
      position: new Vec2(px2m(x), px2m(-645)),
      angularDamping: 0,
      fixedRotation: true,
      userData: cageUd,
    });
    this.PrismBody.createFixture({
      shape: new Box(px2m(1), px2m(1)),
      density: 1,
      friction: 0.1,
      restitution: 1,
      isSensor: true,
      userData: cageUd,
    });
    const cage = CAGE_H[id];
    world.createJoint(
      new PrismaticJoint(
        {
          enableLimit: true,
          lowerTranslation: cage.lo,
          upperTranslation: cage.hi,
          enableMotor: false,
        },
        groundAnchor,
        this.PrismBody,
        this.PrismBody.getWorldCenter(),
        new Vec2(1, 0),
      ),
    );
    world.createJoint(
      new PrismaticJoint(
        { enableLimit: true, lowerTranslation: 0.2, upperTranslation: 55, enableMotor: false },
        this.PrismBody,
        this.bodies.Head,
        this.bodies.Head.getWorldCenter(),
        new Vec2(0, -1),
      ),
    );
  }

  /** Loads the part sprites (z order = PART_DEFS) and displays them. */
  async load(): Promise<void> {
    for (const def of PART_DEFS) {
      const tex = await Assets.load(spriteFrame(PART_SPRITE[def.name][this.sex], 1));
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      const part = this.parts.find((p) => p.name === def.name)!;
      part.sprite = sprite;
      this.container.addChild(sprite);
    }

    // clothing pieces: overlaid on the part, aligned to top-left (same
    // coord frame as FFDec). Sex 1 = bra (Tors) + panties (Ass);
    // sex 2 = only trunks (Ass). Only these pieces get color (player.setColor).
    const ass = this.parts.find((p) => p.name === "Ass")!.sprite!;
    const assDir = this.sex === 1 ? "DefineSprite_98_mc_AssDress" : "DefineSprite_195_mc_AssDress2";
    this.assDressSprite = await this.addDress(ass, assDir, ASSDRESS_DY);
    if (this.sex === 1) {
      const tors = this.parts.find((p) => p.name === "Tors")!.sprite!;
      this.bodyDressSprite = await this.addDress(
        tors,
        "DefineSprite_103_mc_BodyDress",
        BODYDRESS_DY,
      );
    }

    this.parentLayer.addChild(this.container);
  }

  /** Creates the clothing piece as a child of the part, aligned to top-left (+dy). */
  private async addDress(part: Sprite, dir: string, dy: number): Promise<Sprite> {
    const tex = await Assets.load(spriteFrame(dir, 1));
    const dress = new Sprite(tex);
    dress.anchor.set(0, 0);
    dress.position.set(-part.texture.width / 2, -part.texture.height / 2 + dy);
    part.addChild(dress);
    return dress;
  }

  /** Per fixed step: advances the pas timer and syncs the sprites. */
  update(): void {
    if (this.pasTimerMs > 0) {
      this.pasTimerMs -= FIXED_DT;
      if (this.pasTimerMs <= 0 && this.contact !== 0) this.contact = 3;
    }
    for (const p of this.parts) {
      if (!p.sprite) continue;
      const pos = p.body.getPosition();
      p.sprite.position.set(m2px(pos.x), m2px(pos.y));
      p.sprite.rotation = p.body.getAngle();
    }
  }

  // ── Moves (player.as) ───────────────────────────────────────────────────
  /** turn: on the ground (head-y>200px) pushes the Ass; in the air, the head. */
  turn(v: Vec2): void {
    const { Ass, Head } = this.bodies;
    Ass.setLinearVelocity(new Vec2(0, 0));
    if (m2px(Head.getWorldCenter().y) > 200) {
      Ass.applyLinearImpulse(v, Ass.getWorldCenter(), true);
    } else {
      Head.applyLinearImpulse(v, Head.getWorldCenter(), true);
    }
  }

  /** turnComp: AI variant — on the ground splits the impulse into Head+Ass; in the air, only Ass. */
  turnComp(v: Vec2): void {
    const { Ass, Head } = this.bodies;
    Ass.setLinearVelocity(new Vec2(0, 0));
    Head.setLinearVelocity(new Vec2(0, 0));
    if (m2px(Head.getWorldCenter().y) > 200) {
      Head.applyLinearImpulse(new Vec2(v.x * 0.5, v.y * 0.5), Head.getWorldCenter(), true);
      Ass.applyLinearImpulse(new Vec2(v.x * 0.5, v.y * 0.5), Ass.getWorldCenter(), true);
    } else {
      Ass.applyLinearImpulse(v, Ass.getWorldCenter(), true);
    }
  }

  /** jump: only with the Ass near the ground; upward impulse on Head+Ass. */
  jump(): void {
    const { Ass, Head, Tors, FingerLeft, FingerRight } = this.bodies;
    if (m2px(Ass.getWorldCenter().y) <= 296) return;
    const hc = Head.getWorldCenter();
    const tc = Tors.getWorldCenter();
    const dx = hc.x - tc.x;
    const dy = hc.y - tc.y;
    const len = Math.hypot(dx, dy) || 1;
    const dir = new Vec2((dx / len) * 13, (dy / len) * 13);
    Ass.setLinearVelocity(new Vec2(0, 0));
    Head.setLinearVelocity(new Vec2(0, 0));
    Head.applyLinearImpulse(new Vec2(0, -4), Head.getWorldCenter(), true);
    Head.applyLinearImpulse(dir, FingerLeft.getWorldCenter(), true);
    Head.applyLinearImpulse(dir, FingerRight.getWorldCenter(), true);
    Ass.applyLinearImpulse(new Vec2(0, -4), Head.getWorldCenter(), true);
  }

  /** turnDown: pushes the feet down (fall fast / spike). */
  turnDown(): void {
    const { FootLeft, FootRight } = this.bodies;
    FootLeft.applyLinearImpulse(new Vec2(0, 1), FootLeft.getWorldCenter(), true);
    FootRight.applyLinearImpulse(new Vec2(0, 1), FootRight.getWorldCenter(), true);
  }

  /** pas: serve/spike — only while holding the ball and on its own side. */
  pas(ball: Ball): void {
    if (!this.ballJoint || ball.ballOfPlayer !== this.id) return;
    const ballX = ball.body.getWorldCenter().x;
    if (this.id === 1 ? ballX >= PAS_THRESHOLD : ballX <= PAS_THRESHOLD) return;

    this.releaseBall();
    const finger = this.id === 1 ? this.bodies.FingerRight : this.bodies.FingerLeft;
    const fImp = this.id === 1 ? new Vec2(1, -1.5) : new Vec2(-1, -1.5);
    const bImp = this.id === 1 ? new Vec2(0.7, -0.5) : new Vec2(-0.7, -0.5);
    finger.applyLinearImpulse(fImp, finger.getWorldCenter(), true);
    ball.body.applyLinearImpulse(bImp, ball.body.getWorldCenter(), true);
    ball.ballOfPlayer = 0;
    this.contact = 2;
    this.pasTimerMs = 50; // 50 ms later → contact = 3 (player.on_Timer)
    sound.sfx("VH1");
  }

  private setLinVelZero(): void {
    for (const p of this.parts) p.body.setLinearVelocity(new Vec2(0, 0));
    this.PrismBody.setLinearVelocity(new Vec2(0, 0));
  }

  /** Standing pose — 1:1 with player.standPlayer (exact offsets, includes the quirk). */
  standPlayer(x: number, y: number): void {
    this.setLinVelZero();
    for (const [name, dx, dy] of STAND) {
      this.bodies[name].setTransform(new Vec2(px2m(x + dx), px2m(y + dy)), 0);
    }
    this.setLinVelZero();
  }

  /**
   * Tints ONLY the clothing pieces — 1:1 with player.setColor. Sex 1 = bra+panties;
   * sex 2 = trunks. The skin (body parts) is not affected.
   */
  setColor(rgbOffset: number): void {
    this.colorOffset = rgbOffset;
    if (this.bodyDressSprite) this.bodyDressSprite.filters = [additiveColorMatrix(rgbOffset)];
    if (this.assDressSprite) this.assDressSprite.filters = [additiveColorMatrix(rgbOffset)];
  }

  /** Creates the ball↔finger joint (FingerRight P1 / FingerLeft P2). player.takeBall. */
  takeBall(ballBody: Body): boolean {
    if (ballBody.getJointList() != null) return false; // already held
    const finger = this.id === 1 ? this.bodies.FingerRight : this.bodies.FingerLeft;
    const fc = finger.getWorldCenter();
    ballBody.setTransform(new Vec2(fc.x, fc.y), 0);
    const joint = this.world.createJoint(
      new RevoluteJoint(
        { enableLimit: true, lowerAngle: -40 * DEG, upperAngle: 40 * DEG },
        finger,
        ballBody,
        ballBody.getWorldCenter(),
      ),
    );
    this.ballJoint = (joint as RevoluteJoint) ?? undefined;
    return true;
  }

  /** Releases the ball (destroys the joint), if this player is holding it. */
  releaseBall(): void {
    if (this.ballJoint) {
      this.world.destroyJoint(this.ballJoint);
      this.ballJoint = undefined;
    }
  }
}
