import "pixi.js/advanced-blend-modes"; // registers blend modes "overlay"/"subtract"
import { Application, type Container, Graphics, Text } from "pixi.js";
import { sound } from "./audio/sound";
import { campaign, type LevelId } from "./core/campaign";
import { GAME_FPS, STAGE } from "./core/constants";
import { options } from "./core/options";
import { GameWorld } from "./game/GameWorld";
import { Keys } from "./input/keys";
import { GameMenu } from "./screens/GameMenu";
import { Instructions } from "./screens/Instructions";
import { LevelSelect } from "./screens/LevelSelect";
import { OptionsMenu } from "./screens/OptionsMenu";
import { StartMenu } from "./screens/StartMenu";

/**
 * Phase 10c — complete menus + polish.
 * Menu → Tournament(selection) / Options / Instructions → game.
 * Game: P1=arrows+Space, P2=WASD+R · buttons (menu/pause/music) · Esc=menu
 *       · P=pause · N=mute · ` =debug (hidden).
 */
async function main() {
  const app = new Application();
  // resolution = backing sharpness (tunable for HD; cap 2 avoids huge buffers).
  // The LOGICAL space stays 601×401 — no positions change.
  const RESOLUTION = Math.min(2, window.devicePixelRatio || 1);
  await app.init({
    width: STAGE.width,
    height: STAGE.height,
    background: "#3c3c3c",
    antialias: true,
    resolution: RESOLUTION,
    autoDensity: true,
  });
  document.getElementById("game")!.appendChild(app.canvas);

  // responsive: scales the canvas to fill the window keeping the aspect ratio (~3:2),
  // with letterbox. Internal render fixed; the browser scales the image.
  const fit = () => {
    const scale = Math.min(window.innerWidth / STAGE.width, window.innerHeight / STAGE.height);
    app.canvas.style.width = `${Math.round(STAGE.width * scale)}px`;
    app.canvas.style.height = `${Math.round(STAGE.height * scale)}px`;
  };
  fit();
  window.addEventListener("resize", fit);

  const keys = new Keys();
  sound.init();

  const hint = new Text({
    text: "",
    style: { fill: "#cccccc", fontSize: 11, fontFamily: "Alba Super" },
  });
  hint.anchor.set(0, 1);
  hint.position.set(8, STAGE.height - 6);
  app.stage.addChild(hint);

  // transition: black curtain that fades in on each screen change
  const fade = new Graphics().rect(0, 0, STAGE.width, STAGE.height).fill(0x000000);
  fade.eventMode = "none";
  app.stage.addChild(fade);

  // unlocks audio on the 1st gesture (browser autoplay)
  const startAudio = () => {
    sound.ensureMusic();
    window.removeEventListener("keydown", startAudio);
    window.removeEventListener("pointerdown", startAudio);
  };
  window.addEventListener("keydown", startAudio);
  window.addEventListener("pointerdown", startAudio);

  let state: "menu" | "levelselect" | "options" | "instructions" | "loading" | "game" = "menu";
  let gameWorld: GameWorld | null = null;
  let curLevel: LevelId = 1;
  let is2P = false;
  let postGameShown = false;

  const menu = new StartMenu({
    onTournament: () => showLevelSelect(),
    onOptions: () => showScreen(optionsMenu.container, "options"),
    onInstructions: () => {
      instructions.reset();
      showScreen(instructions.container, "instructions");
    },
  });
  await menu.load();

  const levelSelect = new LevelSelect({
    onPlayLevel: (n) => enterCampaign(n),
    onPlay2P: () => enter2P(),
  });
  await levelSelect.load();

  const optionsMenu = new OptionsMenu();
  await optionsMenu.load();

  const instructions = new Instructions();
  await instructions.load();

  const gameMenu = new GameMenu({
    onPause: () => {
      if (gameWorld) gameWorld.paused = !gameWorld.paused;
    },
    onMainMenu: () => showMenu(),
    onMusic: () => sound.toggleMute(),
    onPlayAgain: () => (is2P ? enter2P() : enterCampaign(curLevel)),
    onNextLevel: () => {
      if (curLevel < 5) enterCampaign((curLevel + 1) as LevelId);
    },
  });
  await gameMenu.load();

  function clearScreens(): void {
    if (gameWorld) {
      gameWorld.destroy();
      gameWorld = null;
    }
    for (const c of [
      menu.container,
      levelSelect.container,
      optionsMenu.container,
      instructions.container,
      gameMenu.container,
    ]) {
      if (c.parent) c.removeFromParent();
    }
  }

  /** Top of the stack (hint + curtain) + triggers the fade-in. */
  function bringOverlaysToTop(): void {
    app.stage.addChild(hint);
    app.stage.addChild(fade);
    fade.alpha = 1;
  }

  function showScreen(container: Container, st: typeof state): void {
    clearScreens();
    app.stage.addChildAt(container, 0);
    bringOverlaysToTop();
    sound.music("MENUMUSIC");
    state = st;
  }

  function showMenu(): void {
    showScreen(menu.container, "menu");
  }
  function showLevelSelect(): void {
    levelSelect.refresh();
    showScreen(levelSelect.container, "levelselect");
  }

  /** local 2 players mode — tunables from playgameMenu.click_level2players. */
  function setup2P(gw: GameWorld): void {
    options.bFirstExecuter = false;
    options.myExSpeed = 2;
    options.compExSpeed = 2;
    options.AImaxSpeed = 10;
    options.myExLife = 50;
    options.compExLife = 50;
    gw.vsAI = false;
    gw.game.campaignLevel = 0;
    gw.player1.setColor(options.player1_color);
    gw.player2.setColor(options.player2_color);
    gw.game.restartMatch();
  }

  async function startGame(
    p1Sex: 1 | 2,
    p2Sex: 1 | 2,
    setup: (gw: GameWorld) => void,
  ): Promise<void> {
    if (state === "loading") return;
    state = "loading";
    clearScreens();
    const gw = new GameWorld(app.stage, keys, p1Sex, p2Sex);
    await gw.load();
    setup(gw);
    gameWorld = gw;
    gameMenu.hidePostGame();
    postGameShown = false;
    app.stage.addChild(gameMenu.container);
    bringOverlaysToTop();
    state = "game";
  }

  function enterCampaign(n: LevelId): void {
    curLevel = n;
    is2P = false;
    campaign.applyLevel(n); // sets comp_sex/color BEFORE creating the ragdolls
    void startGame(options.player1_sex, options.comp_sex, (gw) => gw.loadLevel(n));
  }

  function enter2P(): void {
    is2P = true;
    void startGame(options.player1_sex, options.player2_sex, setup2P);
  }

  showMenu();

  // ── Loop ───────────────────────────────────────────────────────────────────
  const FIXED_DT_MS = 1000 / GAME_FPS;
  let accumulator = 0;

  app.ticker.add((ticker) => {
    if (fade.alpha > 0) fade.alpha = Math.max(0, fade.alpha - ticker.deltaMS / 200);

    if (state === "game" && gameWorld) {
      if (keys.wasPressed("Escape")) {
        showMenu();
        keys.clearPressed();
        return;
      }
      accumulator += ticker.deltaMS;
      if (accumulator > 250) accumulator = 250;
      while (accumulator >= FIXED_DT_MS) {
        if (keys.wasPressed("Backquote")) gameWorld.debug.toggle();
        if (keys.wasPressed("KeyN")) sound.toggleMute();
        if (keys.wasPressed("KeyP")) gameWorld.paused = !gameWorld.paused;
        if (!gameWorld.paused) gameWorld.update();
        keys.clearPressed();
        accumulator -= FIXED_DT_MS;
      }
      gameWorld.render();

      if (gameWorld.game.ended && !postGameShown) {
        const canNext =
          !is2P &&
          curLevel < 5 &&
          gameWorld.game.point1 >= options.gameSet &&
          campaign.access > curLevel;
        gameMenu.showPostGame(canNext);
        postGameShown = true;
      }
      hint.style = { fill: "#cccccc", fontSize: 22, fontFamily: "Alba Super" };
      hint.anchor.set(0.5);
      hint.position.set(app.screen.width / 2, app.screen.height / 2);
      hint.text = gameWorld.paused ? "PAUSED" : "";
    } else {
      if (state !== "menu" && state !== "loading" && keys.wasPressed("Escape")) showMenu();
      keys.clearPressed();
      accumulator = 0;
      hint.style = { fill: "#cccccc", fontSize: 11, fontFamily: "Alba Super" };
      hint.anchor.set(0, 1);
      hint.position.set(8, STAGE.height - 6);
      hint.text = state === "loading" ? "loading…" : state === "menu" ? "" : "Esc — back";
    }
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  document.body.insertAdjacentHTML(
    "beforeend",
    `<pre style="color:#f55;position:fixed;top:0;left:0;padding:8px">${String(err)}</pre>`,
  );
});
