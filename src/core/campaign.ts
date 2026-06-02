import { options } from "./options";

export type LevelId = 1 | 2 | 3 | 4 | 5;

export interface LevelConfig {
  AImaxSpeed: number;
  myExSpeed: number;
  compExSpeed: number;
  myExLife: number;
  compExLife: number;
  compSex: 1 | 2;
  bFirstExecuter: boolean;
  compColor: number; // 0xRRGGBB — visual tint in Phase 9
}

/** The 5 levels — 1:1 with playgameMenu.setOptions. */
export const LEVEL_CONFIGS: Record<LevelId, LevelConfig> = {
  1: {
    AImaxSpeed: 6,
    myExSpeed: 1.3,
    compExSpeed: 1.3,
    myExLife: 15,
    compExLife: 20,
    compSex: 1,
    bFirstExecuter: false,
    compColor: 0x1d99eb,
  },
  2: {
    AImaxSpeed: 7.8,
    myExSpeed: 1.5,
    compExSpeed: 1.3,
    myExLife: 30,
    compExLife: 25,
    compSex: 2,
    bFirstExecuter: false,
    compColor: 0x1e6d0a,
  },
  3: {
    AImaxSpeed: 9,
    myExSpeed: 1.7,
    compExSpeed: 1.3,
    myExLife: 40,
    compExLife: 25,
    compSex: 1,
    bFirstExecuter: false,
    compColor: 0xff0909,
  },
  4: {
    AImaxSpeed: 10,
    myExSpeed: 2,
    compExSpeed: 2,
    myExLife: 50,
    compExLife: 25,
    compSex: 2,
    bFirstExecuter: false,
    compColor: 0x1f20f1,
  },
  5: {
    AImaxSpeed: 11,
    myExSpeed: 3,
    compExSpeed: 3,
    myExLife: 60,
    compExLife: 25,
    compSex: 1,
    bFirstExecuter: true,
    compColor: 0xfafafa,
  },
};

const STORAGE_KEY = "ragremake.campaign";

interface CampaignSave {
  access: number;
  score1: number[];
  score2: number[];
}

/**
 * Campaign state — Access (unlock), high-scores per level, totalScore.
 * Persisted in localStorage (replaces the dead Mochi/bubblebox leaderboard).
 */
class Campaign {
  access = 1; // unlocked levels (1..5)
  score1 = [0, 0, 0, 0, 0]; // your points (best) per level
  score2 = [0, 0, 0, 0, 0]; // points conceded in the best result

  constructor() {
    this.load();
  }

  /** Applies the level tunables to `options` (read by AI and Executer). */
  applyLevel(n: LevelId): void {
    const c = LEVEL_CONFIGS[n];
    options.currentLevel = n;
    options.AImaxSpeed = c.AImaxSpeed;
    options.myExSpeed = c.myExSpeed;
    options.compExSpeed = c.compExSpeed;
    options.myExLife = c.myExLife;
    options.compExLife = c.compExLife;
    options.bFirstExecuter = c.bFirstExecuter;
    options.comp_sex = c.compSex;
    options.computer_color = c.compColor;
  }

  /** Records the game end: stores the best score and unlocks if won. */
  recordResult(level: LevelId, p1: number, p2: number, won: boolean): void {
    const i = level - 1;
    if (this.score1[i] < p1 || (this.score1[i] === p1 && p2 < this.score2[i])) {
      this.score1[i] = p1;
      this.score2[i] = p2;
    }
    if (won && this.access === level && level < 5) this.access++;
    this.save();
  }

  /** totalScore = Σ (score1·100·n − score2·25·n). */
  totalScore(): number {
    let t = 0;
    for (let i = 0; i < 5; i++) t += this.score1[i] * 100 * (i + 1) - this.score2[i] * 25 * (i + 1);
    return t;
  }

  private save(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ access: this.access, score1: this.score1, score2: this.score2 }),
      );
    } catch {
      /* localStorage unavailable — ignore */
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Partial<CampaignSave>;
      if (typeof s.access === "number") this.access = s.access;
      if (Array.isArray(s.score1) && s.score1.length === 5) this.score1 = s.score1;
      if (Array.isArray(s.score2) && s.score2.length === 5) this.score2 = s.score2;
    } catch {
      /* corrupt save — ignore */
    }
  }
}

export const campaign = new Campaign();
