import { Text } from "pixi.js";

/** Real text button (string), clickable, with hover (tint + slight scale). */
export function textButton(
  label: string,
  x: number,
  y: number,
  onClick: () => void,
  opts: { size?: number; color?: number } = {},
): Text {
  const t = new Text({
    text: label,
    style: { fontFamily: "Alba Super", fontSize: opts.size ?? 18, fill: opts.color ?? 0xffffff },
  });
  t.anchor.set(0.5);
  t.position.set(x, y);
  t.eventMode = "static";
  t.cursor = "pointer";
  t.on("pointerover", () => {
    t.tint = 0xffe066;
    t.scale.set(1.08);
  });
  const reset = () => {
    t.tint = 0xffffff;
    t.scale.set(1);
  };
  t.on("pointerout", reset);
  t.on("pointertap", () => {
    reset(); // avoids getting "stuck" in hover after the screen switch
    onClick();
  });
  return t;
}
