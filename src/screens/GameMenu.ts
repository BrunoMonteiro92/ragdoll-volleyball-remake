import { Assets, Container, Sprite, type Text } from "pixi.js";
import { spriteFrame } from "../core/assets";
import { textButton } from "./ui";

export interface GameMenuCallbacks {
  onPause: () => void;
  onMainMenu: () => void;
  onMusic: () => void;
  onPlayAgain: () => void;
  onNextLevel: () => void;
}

/**
 * Game-menu HUD. Buttons as real strings: menu, pause (always), play again
 * / next level (on game over). Music is an icon (sprite).
 */
export class GameMenu {
  readonly container = new Container();
  private playAgain!: Text;
  private nextLevel!: Text;

  constructor(private readonly cb: GameMenuCallbacks) {}

  async load(): Promise<void> {
    await document.fonts.load('16px "Alba Super"').catch(() => {});

    this.container.addChild(textButton("menu", 38, 386, this.cb.onMainMenu, { size: 16 }));
    this.container.addChild(textButton("pause", 562, 386, this.cb.onPause, { size: 16 }));

    const music = new Sprite(await Assets.load(spriteFrame("DefineSprite_143_mcb_musicIcon", 1)));
    music.position.set(580, 3);
    music.eventMode = "static";
    music.cursor = "pointer";
    music.on("pointerover", () => (music.alpha = 0.6));
    music.on("pointerout", () => (music.alpha = 1));
    music.on("pointertap", () => this.cb.onMusic());
    this.container.addChild(music);

    this.playAgain = textButton("play again", 256, 249, this.cb.onPlayAgain);
    this.nextLevel = textButton("next level", 376, 249, this.cb.onNextLevel);
    this.container.addChild(this.playAgain, this.nextLevel);
    this.hidePostGame();
  }

  /** showNext = won a campaign level that unlocked the next one. */
  showPostGame(showNext: boolean): void {
    this.playAgain.visible = true;
    this.nextLevel.visible = showNext;
  }

  hidePostGame(): void {
    this.playAgain.visible = false;
    this.nextLevel.visible = false;
  }
}
