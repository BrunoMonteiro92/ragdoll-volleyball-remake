import { Howl } from "howler";
import { assetUrl } from "../core/assets";
import { options } from "../core/options";

/** SFX (one-shot). The original's `x` (position) was vestigial — no pan. */
const SFX_FILES: Record<string, string> = {
  VH1: "sounds/259_VH1.mp3",
  VH2: "sounds/260_VH2.mp3",
  VH3: "sounds/261_VH3.mp3",
  W1: "sounds/262_W1.mp3",
  SCORE3: "sounds/263_SCORE3.mp3",
  SCORE2: "sounds/264_SCORE2.mp3",
  EXPLOSION1: "sounds/265_EXPLOSION1.mp3",
  EX1: "sounds/1_EX1.mp3",
  B1: "sounds/266_B1.mp3",
};

const MUSIC_FILES: Record<string, string> = {
  MENUMUSIC: "sounds/267_MENUMUSIC1.mp3",
  GAMEMUSIC: "sounds/269_GAMEMUSIC.mp3",
};

/**
 * Game audio — equivalent to world/sounds.as + musics.as (via Howler).
 * Singleton: any module calls sound.sfx(...). Volume comes from options.
 * Howler unlocks the context on the user's 1st gesture (browser autoplay).
 */
class Sound {
  private sfxBank: Record<string, Howl> = {};
  private musicBank: Record<string, Howl> = {};
  private current?: Howl;
  private currentName = "";

  init(): void {
    for (const [k, f] of Object.entries(SFX_FILES)) {
      this.sfxBank[k] = new Howl({ src: [assetUrl(f)], preload: true });
    }
    for (const [k, f] of Object.entries(MUSIC_FILES)) {
      this.musicBank[k] = new Howl({ src: [assetUrl(f)], loop: true, preload: true });
    }
  }

  sfx(name: string): void {
    if (options.soundVol <= 0) return;
    const h = this.sfxBank[name];
    if (!h) return;
    h.volume(options.soundVol);
    h.play(); // Howler allows overlapping playback
  }

  /** Ball touch — random VH1/VH2/VH3 (game.as). */
  vh(): void {
    this.sfx(`VH${1 + Math.floor(Math.random() * 3)}`);
  }

  /** Plays the music (loop). Idempotent; ensures it is playing if unmuted. */
  music(name: string): void {
    const h = this.musicBank[name];
    if (!h) return;
    if (h !== this.current) {
      this.current?.stop();
      this.current = h;
      this.currentName = name;
    }
    h.volume(options.musicVol);
    if (options.musicVol > 0 && !h.playing()) h.play();
  }

  /** Global mute/unmute (music + sfx) — original's click_musicB. */
  toggleMute(): void {
    if (options.musicVol > 0 || options.soundVol > 0) {
      options.OldmusicVol = options.musicVol || 1;
      options.OldsoundVol = options.soundVol || 1;
      options.musicVol = 0;
      options.soundVol = 0;
      this.current?.pause();
    } else {
      options.musicVol = options.OldmusicVol;
      options.soundVol = options.OldsoundVol;
      if (this.current) {
        this.current.volume(options.musicVol);
        this.current.play();
      }
    }
  }

  get muted(): boolean {
    return options.musicVol <= 0 && options.soundVol <= 0;
  }

  /** Reactivates the current music (use on the 1st gesture, to unlock autoplay). */
  ensureMusic(): void {
    if (this.currentName) this.music(this.currentName);
  }

  /** Applies options.musicVol to the current music (live volume slider). */
  updateVolumes(): void {
    if (this.current) this.current.volume(options.musicVol);
  }
}

export const sound = new Sound();
