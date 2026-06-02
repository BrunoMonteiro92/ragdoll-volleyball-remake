import { Container, Graphics, Text } from "pixi.js";
import { sound } from "../audio/sound";
import { options } from "../core/options";
import { Slider } from "./Slider";

const PANEL_X = 153;
const PANEL_Y = 61;
const PANEL_W = 295;
const PANEL_H = 278;
const LABEL_X = PANEL_X + 24;
const SLIDER_X = PANEL_X + 105;
const SWATCH_X = PANEL_X + 180;
const FM_X = PANEL_X + 245;

/** color_changer hue: x∈[0,60] → RGB offset (rainbow, intensity 175). */
function hueColor(x: number): number {
  const I = 175;
  let r = 0;
  let g = 0;
  let b = 0;
  if (x <= 10) {
    r = I;
    g = (I * x) / 10;
  } else if (x <= 20) {
    r = I - (I * (x - 10)) / 10;
    g = I;
  } else if (x <= 30) {
    g = I;
    b = (I * (x - 20)) / 10;
  } else if (x <= 40) {
    g = I - (I * (x - 30)) / 10;
    b = I;
  } else if (x <= 50) {
    r = (I * (x - 40)) / 10;
    b = I;
  } else {
    r = I;
    b = I - (I * (x - 50)) / 10;
  }
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

/**
 * Options screen (clean internals). Own panel (without the baked-in
 * previews/symbols of mc_optionField, which cluttered the UI). Widgets: color (hue slider
 * 1:1 with the original + swatch), sex (F/M), volume (sliders), shadows (checkbox).
 */
export class OptionsMenu {
  readonly container = new Container();

  async load(): Promise<void> {
    await document.fonts.load('14px "Alba Super"').catch(() => {});

    const panel = new Graphics()
      .roundRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 14)
      .fill({ color: 0x202020, alpha: 0.82 })
      .stroke({ width: 2, color: 0xffffff, alpha: 0.15 });
    this.container.addChild(panel);

    const title = new Text({
      text: "options",
      style: { fontFamily: "Alba Super", fontSize: 20, fill: 0xffffff },
    });
    title.anchor.set(0.5, 0);
    title.position.set(PANEL_X + PANEL_W / 2, PANEL_Y + 12);
    this.container.addChild(title);

    this.label("player 1", LABEL_X, PANEL_Y + 55);
    this.label("player 2", LABEL_X, PANEL_Y + 83);
    this.label("shadows", LABEL_X, PANEL_Y + 125);
    this.label("sound", LABEL_X, PANEL_Y + 170);
    this.label("music", LABEL_X, PANEL_Y + 200);

    this.colorRow(1, PANEL_Y + 55);
    this.colorRow(2, PANEL_Y + 83);
    this.sexToggle(1, FM_X, PANEL_Y + 55);
    this.sexToggle(2, FM_X, PANEL_Y + 83);
    this.shadowsBox(SLIDER_X, PANEL_Y + 125);
    this.volumeRow("sound", PANEL_Y + 170);
    this.volumeRow("music", PANEL_Y + 200);
  }

  private label(s: string, x: number, y: number): void {
    const t = new Text({
      text: s,
      style: { fontFamily: "Alba Super", fontSize: 13, fill: 0xffffff },
    });
    t.anchor.set(0, 0.5);
    t.position.set(x, y);
    this.container.addChild(t);
  }

  private colorRow(id: 1 | 2, y: number): void {
    const slider = new Slider(60);
    slider.position.set(SLIDER_X, y);
    const swatch = new Graphics();
    const paint = (col: number) =>
      swatch
        .clear()
        .rect(0, -7, 16, 14)
        .fill(col || 0x2b2b2b);
    swatch.position.set(SWATCH_X, y);
    this.container.addChild(slider, swatch);
    paint(id === 1 ? options.player1_color : options.player2_color);
    slider.set(0.5); // neutral knob (doesn't change the color until dragged)
    slider.onChange = (v) => {
      const col = hueColor(v * 60);
      if (id === 1) options.player1_color = col;
      else options.player2_color = col;
      paint(col);
    };
  }

  private sexToggle(id: 1 | 2, x: number, y: number): void {
    const t = new Text({
      text: "",
      style: { fontFamily: "Alba Super", fontSize: 16, fill: 0xffe066 },
    });
    t.anchor.set(0.5);
    t.position.set(x, y);
    t.eventMode = "static";
    t.cursor = "pointer";
    const update = () => {
      const sex = id === 1 ? options.player1_sex : options.player2_sex;
      t.text = sex === 1 ? "F" : "M"; // sex 1 = female
    };
    t.on("pointertap", () => {
      if (id === 1) options.player1_sex = options.player1_sex === 1 ? 2 : 1;
      else options.player2_sex = options.player2_sex === 1 ? 2 : 1;
      update();
    });
    this.container.addChild(t);
    update();
  }

  private shadowsBox(x: number, y: number): void {
    const box = new Graphics()
      .rect(-9, -9, 18, 18)
      .fill({ color: 0xffffff, alpha: 0.08 }) // fill → clickable across the whole box
      .stroke({ width: 2, color: 0xffffff });
    box.position.set(x, y);
    box.eventMode = "static";
    box.cursor = "pointer";
    const check = new Text({
      text: "x",
      style: { fontFamily: "Alba Super", fontSize: 16, fill: 0xffe066 },
    });
    check.anchor.set(0.5);
    check.position.set(x, y);
    this.container.addChild(box, check);
    const update = () => (check.visible = options.Shadows);
    box.on("pointertap", () => {
      options.Shadows = !options.Shadows;
      update();
    });
    update();
  }

  private volumeRow(kind: "sound" | "music", y: number): void {
    const slider = new Slider(60);
    slider.position.set(SLIDER_X, y);
    this.container.addChild(slider);
    slider.set(kind === "sound" ? options.soundVol : options.musicVol);
    slider.onChange = (v) => {
      if (kind === "sound") options.soundVol = v;
      else {
        options.musicVol = v;
        sound.updateVolumes();
      }
    };
  }
}
