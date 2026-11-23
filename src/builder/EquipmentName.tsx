import type { Equipment } from "../gameData.ts";

/** An `AARRGGBB` Game Data colour as a CSS colour (`#RRGGBBAA`). */
const cssColour = (argb: string) => `#${argb.slice(2)}${argb.slice(0, 2)}`;

/**
 * An Equipment's name, as the game writes it. A weapon or turret colour variant's R, G, O or B
 * letter, its name's last word, is drawn in its Game Data bolt colour (#140); the UI never derives
 * the colour. Equipment without one shows its name as plain text.
 */
export function EquipmentName({ equipment }: { equipment: Equipment }) {
  const colour = "boltColour" in equipment ? equipment.boltColour : null;
  const match = colour === null ? null : /^(.* )(\S)$/s.exec(equipment.name);
  if (colour === null || match === null) return equipment.name;
  const [, base, letter] = match;
  return (
    <span>
      {base}
      <span style={{ color: cssColour(colour) }}>{letter}</span>
    </span>
  );
}
