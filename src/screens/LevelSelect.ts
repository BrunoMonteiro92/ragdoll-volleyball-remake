import { Assets, Container, Graphics, Sprite, Text } from "pixi.js";
import { spriteFrame } from "../core/assets";
import { campaign, type LevelId } from "../core/campaign";

// layout (screen space). Panel 295×278 centered on the 601×401 stage.
const PANEL_X = 153;
const PANEL_Y = 61;
const ROW0_Y = PANEL_Y + 48; // 1st row (under the "levels/best score/points" headers)
const ROW_H = 24;
const COL_LEVEL = PANEL_X + 50;
const COL_SCORE = PANEL_X + 150;
const COL_POINTS = PANEL_X + 238;
const CENTER_X = PANEL_X + 148;
const PANEL_FILL = 0x303030; // panel interior composited over the stage

interface Row {
  hit: Graphics;
  level: Text;
  score: Text;
  points: Text;
}

export interface LevelSelectCallbacks {
  onPlayLevel: (n: LevelId) => void;
  onPlay2P: () => void;
}

/**
 * Level select (tournament) — faithful look, clean internals.
 * mc_changeLevel panel + 5 clickable rows (level / best score / points),
 * locked by Access; totalScore; "2 players mode" button. The
 * YOUR NAME/SEND box (dead leaderboard) is covered.
 */
export class LevelSelect {
  readonly container = new Container();
  private readonly rows: Row[] = [];
  private totalText!: Text;

  constructor(private readonly cb: LevelSelectCallbacks) {}

  async load(): Promise<void> {
    await document.fonts.load('15px "Alba Super"').catch(() => {});
    const panel = new Sprite(await Assets.load(spriteFrame("DefineSprite_26_mc_changeLevel", 1)));
    panel.position.set(PANEL_X, PANEL_Y);
    this.container.addChild(panel);

    // covers the YOUR NAME / SEND box (dead leaderboard)
    const cover = new Graphics().rect(PANEL_X + 38, PANEL_Y + 185, 220, 88).fill(PANEL_FILL);
    this.container.addChild(cover);

    // covers the baked-in headers (levels/best score/points) so they don't sit behind
    const headerCover = new Graphics().rect(PANEL_X + 16, PANEL_Y + 14, 264, 28).fill(PANEL_FILL);
    this.container.addChild(headerCover);

    // headers as real strings (the panel's are translucent)
    this.text("levels", COL_LEVEL, PANEL_Y + 28);
    this.text("best score", COL_SCORE, PANEL_Y + 28);
    this.text("points", COL_POINTS, PANEL_Y + 28);

    for (let i = 0; i < 5; i++) {
      const lvl = (i + 1) as LevelId;
      const y = ROW0_Y + i * ROW_H;
      const hit = this.makeHit(y, () => this.cb.onPlayLevel(lvl));
      this.rows.push({
        hit,
        level: this.text(`level ${lvl}`, COL_LEVEL, y),
        score: this.text("", COL_SCORE, y),
        points: this.text("", COL_POINTS, y),
      });
    }

    this.totalText = this.text("", CENTER_X, PANEL_Y + 175);
    this.totalText.style.fontSize = 16;

    this.makeHit(PANEL_Y + 292, () => this.cb.onPlay2P()); // below the panel
    this.text("2 players mode", CENTER_X, PANEL_Y + 292);
  }

  /** Transparent clickable area (highlight on hover). */
  private makeHit(y: number, onClick: () => void): Graphics {
    const hit = new Graphics()
      .roundRect(-128, -11, 256, 22, 4)
      .fill({ color: 0xffffff, alpha: 0.12 });
    hit.position.set(CENTER_X, y);
    hit.alpha = 0;
    hit.eventMode = "static";
    hit.cursor = "pointer";
    hit.on("pointerover", () => {
      if (hit.eventMode === "static") hit.alpha = 1;
    });
    hit.on("pointerout", () => (hit.alpha = 0));
    hit.on("pointertap", onClick);
    this.container.addChild(hit);
    return hit;
  }

  private text(s: string, x: number, y: number): Text {
    const t = new Text({
      text: s,
      style: { fontFamily: "Alba Super", fontSize: 15, fill: 0xffffff },
    });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.container.addChild(t);
    return t;
  }

  /** Updates scores/unlock/total — call when showing the screen. */
  refresh(): void {
    for (let i = 0; i < 5; i++) {
      const r = this.rows[i];
      const s1 = campaign.score1[i];
      const s2 = campaign.score2[i];
      r.score.text = `${s1} : ${s2}`;
      r.points.text = `${s1 * 100 * (i + 1) - s2 * 25 * (i + 1)}`;
      const locked = campaign.access < i + 1;
      r.hit.eventMode = locked ? "none" : "static";
      const a = locked ? 0.25 : 1;
      r.level.alpha = a;
      r.score.alpha = a;
      r.points.alpha = a;
    }
    this.totalText.text = `Total Score:  ${campaign.totalScore()}`;
  }
}
