/**
 * Game tunables — equivalent to world/options.as (constructor values).
 * Mutable singleton: the campaign (Phase 8b) overrides per level; the rest
 * (colors, sex, volumes) comes in the Phase 9s. Read by AI and Executer.
 */
export const options = {
  gameSet: 10, // points to win
  soundVol: 1, // 0..1
  musicVol: 1, // 0..1
  OldsoundVol: 1, // for the mute toggle
  OldmusicVol: 1,
  AImaxSpeed: 7,
  myExLife: 25, // executer life (s) — P1 target
  compExLife: 25, // P2 target
  myExSpeed: 1.3, // executer speed — P1 target
  compExSpeed: 1.3, // P2 target
  currentLevel: 1, // 1 = no difficulty ramp (campaign uses 2-5)
  bFirstExecuter: false, // starts the level with an executer (level 5 / campaign)
  comp_sex: 1 as 1 | 2, // CPU skin (applied visually in Phase 10)
  // additive color offsets (0xRRGGBB) — default (43,43,43) = 0x2b2b2b
  player1_color: 0x2b2b2b,
  player2_color: 0x2b2b2b,
  computer_color: 0x2b2b2b,
  player1_sex: 1 as 1 | 2,
  player2_sex: 1 as 1 | 2,
  Shadows: true,
};
