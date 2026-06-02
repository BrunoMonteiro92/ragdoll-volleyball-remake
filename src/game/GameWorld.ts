import { Container } from "pixi.js";
import { DropShadowFilter } from "pixi-filters";
import type { Body } from "planck";
import { sound } from "../audio/sound";
import { campaign, type LevelId } from "../core/campaign";
import { ITERATIONS, PLAYER_SPAWN, TIMESTEP_GAME } from "../core/constants";
import { options } from "../core/options";
import { Ball } from "../entities/Ball";
import { buildGround } from "../entities/Ground";
import { Player } from "../entities/Player";
import { Control } from "../input/Control";
import type { Keys } from "../input/keys";
import { Contacts } from "../physics/Contacts";
import { createWorld } from "../physics/world";
import { AI } from "../player/AI";
import { BloodDraw } from "../render/BloodDraw";
import { DebugDraw } from "../render/DebugDraw";
import { WorldView } from "../render/WorldView";
import { PrizeButton } from "../staff/PrizeButton";
import { Game } from "./Game";

/**
 * Game world orchestrator.
 * Phase 2-5: court/ball/ragdolls/controls. Phase 6a: contacts + rules + score.
 */
export class GameWorld {
  readonly world = createWorld();
  readonly view = new WorldView();
  readonly contacts: Contacts;
  readonly debug: DebugDraw;
  readonly blood: BloodDraw;
  readonly ball: Ball;
  readonly prizeButton: PrizeButton;
  readonly groundAnchor: Body;
  readonly player1: Player;
  readonly player2: Player;
  readonly control: Control;
  readonly ai: AI;
  readonly game: Game;

  /** mode: true = 1 player vs CPU (P2 = AI); false = 2 players local. */
  vsAI = true;

  /** pause: freezes physics + logic + timers (gameMenu.click_pauseB). */
  paused = false;

  /** physics timestep (1/28 in game; becomes 1/200 in the goal slow-motion — 6b). */
  timeStep = TIMESTEP_GAME;

  /** HUD in screen space (scoreboard, danger, pointer, live-points). */
  readonly hud = new Container();

  constructor(stage: Container, keys: Keys, p1Sex: 1 | 2 = 1, p2Sex: 1 | 2 = 2) {
    stage.addChild(this.view.layer);
    stage.addChild(this.hud);
    buildGround(this.world);
    this.groundAnchor = this.world.createBody({ type: "static" });
    this.contacts = new Contacts(this.world);
    this.debug = new DebugDraw(this.view.layer, /* visible */ false);
    this.blood = new BloodDraw(this.view.layer); // behind the parts
    this.prizeButton = new PrizeButton(this.world, this.view.layer);
    this.ball = new Ball(this.world, this.view.layer);
    this.player1 = new Player(
      this.world,
      this.view.layer,
      PLAYER_SPAWN[1].x,
      PLAYER_SPAWN[1].y,
      1,
      p1Sex,
      this.groundAnchor,
    );
    this.player2 = new Player(
      this.world,
      this.view.layer,
      PLAYER_SPAWN[2].x,
      PLAYER_SPAWN[2].y,
      2,
      p2Sex,
      this.groundAnchor,
    );
    this.control = new Control(keys, this.ball);
    this.ai = new AI(this.player2, this.ball);
    this.game = new Game(this.ball, this.player1, this.player2, this.contacts, (n) => {
      this.timeStep = n;
    });
  }

  async load(): Promise<void> {
    await this.view.loadCourt();
    await this.prizeButton.load();
    await this.player1.load();
    await this.player2.load();
    await this.ball.load(); // ball in front of the parts
    await this.game.load(this.hud); // scoreboard in the HUD (screen space)
    this.view.layer.addChild(this.debug.g); // debug on top of everything
    this.applyShadows();
    sound.music("GAMEMUSIC"); // unlocks on the 1st gesture (autoplay)
    // the level/mode is set by the setup (loadLevel / setup2P) right after load.
  }

  /** Loads a campaign level (called by the screen flow). */
  loadLevel(n: LevelId): void {
    campaign.applyLevel(n);
    this.player1.setColor(options.player1_color);
    this.player2.setColor(options.computer_color); // CPU color per level
    this.vsAI = true;
    this.game.campaignLevel = n;
    this.prizeButton.destroyAll();
    this.game.restartMatch();
    if (options.bFirstExecuter) this.triggerPrize(); // level 5 starts with one already
  }

  /** One logic step (fixed step). Order ~ original's world.Update. */
  update(): void {
    this.world.step(this.timeStep, ITERATIONS, 8);
    // bounce sound (W1) — reads the post-bounce velocity, before damping
    const bv = this.ball.body.getLinearVelocity();
    if (this.contacts.ballHitWall && Math.abs(bv.x) > 2) sound.sfx("W1");
    if (this.contacts.ballOnFloor && Math.abs(bv.y) > 1) sound.sfx("W1");
    this.contacts.applyBallDamping(this.ball); // wall/net ×0.6
    this.control.update(this.player1);
    if (this.vsAI) {
      if (!this.game.paused) this.ai.update(); // AI turns off in the goal slow-motion
    } else {
      this.control.update(this.player2);
    }
    this.ball.update();
    this.player1.update();
    this.player2.update();
    this.game.update();
    // prize trigger: ball touched a button (game.bYesPrize)
    if (this.contacts.ballHitButton) {
      this.prizeButton.sendPrize(this.player1, this.player2, this.ball.body.getWorldCenter().x);
    }
    this.prizeButton.update();
    this.contacts.clear();
  }

  /** Drop-shadow on the players when options.Shadows (world.CreateLevel). */
  private applyShadows(): void {
    if (!options.Shadows) return;
    const shadow = (angleDeg: number) => {
      const a = (angleDeg * Math.PI) / 180;
      return new DropShadowFilter({
        offset: { x: -10 * Math.cos(a), y: -10 * Math.sin(a) },
        color: 0x000000,
        alpha: 0.2,
        blur: 2,
      });
    };
    this.player1.container.filters = [shadow(70)];
    this.player2.container.filters = [shadow(110)];
  }

  /** Temporary (8a): forces an executer on the ball's side, to test without aiming at the button. */
  triggerPrize(): void {
    this.prizeButton.sendPrize(this.player1, this.player2, this.ball.body.getWorldCenter().x);
  }

  /** Syncs the per-frame render work. */
  render(): void {
    this.blood.redraw(this.world);
    this.debug.redraw(this.world);
  }

  /** Removes everything from the screen (when going back to the menu). Textures stay cached. */
  destroy(): void {
    this.prizeButton.destroyAll();
    this.view.layer.removeFromParent();
    this.view.layer.destroy({ children: true });
    this.hud.removeFromParent();
    this.hud.destroy({ children: true });
  }
}
