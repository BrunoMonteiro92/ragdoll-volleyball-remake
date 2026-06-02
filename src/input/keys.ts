/**
 * Simple keyboard state (physical codes via KeyboardEvent.code).
 * In game, P1 = arrows + Space; P2 = WASD + KeyR (mapped in Phase 5).
 */
export class Keys {
  private down = new Set<string>();
  private pressed = new Set<string>();

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      // prevents page scroll from arrows/space
      if (e.code === "Space" || e.code.startsWith("Arrow")) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => this.down.delete(e.code));
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** true since the last clearPressed (does not clear — can be read multiple times). */
  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  /** clears the "just pressed" — call at the end of each consumed FIXED STEP. */
  clearPressed(): void {
    this.pressed.clear();
  }
}
