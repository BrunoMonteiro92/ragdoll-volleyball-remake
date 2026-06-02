import { Assets, Container, Sprite, Text } from "pixi.js";
import { sound } from "../audio/sound";
import { spriteFrame } from "../core/assets";
import { STAGE } from "../core/constants";
import { textButton } from "./ui";

export interface MenuCallbacks {
  onTournament: () => void;
  onOptions: () => void;
  onInstructions: () => void;
}

/**
 * Start menu. Original mc_Fon logo-panel (with the "ragdoll volleyball" art +
 * ragdoll/net) as background; the BUTTONS are real strings (Text), and the music is an
 * icon (sprite).
 */
export class StartMenu {
  readonly container = new Container();

  constructor(private readonly cb: MenuCallbacks) {}

  async load(): Promise<void> {
    await document.fonts.load('22px "Alba Super"').catch(() => {});

    const fon = new Sprite(await Assets.load(spriteFrame("DefineSprite_125_mc_Fon", 2)));
    fon.position.set(-811, -65); // solid panel (811,65) → stage (0,0)
    this.container.addChild(fon);

    const music = new Sprite(await Assets.load(spriteFrame("DefineSprite_143_mcb_musicIcon", 1)));
    music.position.set(580, 5);
    music.eventMode = "static";
    music.cursor = "pointer";
    music.on("pointerover", () => (music.alpha = 0.6));
    music.on("pointerout", () => (music.alpha = 1));
    music.on("pointertap", () => sound.toggleMute());
    this.container.addChild(music);

    this.container.addChild(textButton("tournament", 490, 105, this.cb.onTournament, { size: 24 }));
    this.container.addChild(textButton("instructions", 490, 145, this.cb.onInstructions));
    this.container.addChild(textButton("options", 490, 185, this.cb.onOptions));

    // credit (default sans font for legibility at the small size)
    const credit = new Text({
      text: "Remake by Bruno Monteiro  /  Original by Bedalaga & iLDico (2008)",
      style: { fontSize: 10, fill: 0xdddddd },
    });
    credit.anchor.set(1, 1);
    credit.position.set(STAGE.width - 6, STAGE.height - 4);
    credit.alpha = 0.7;
    this.container.addChild(credit);
  }
}
