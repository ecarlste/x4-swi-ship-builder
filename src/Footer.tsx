import type { Manifest } from "./gameData.ts";

/**
 * Game Data versions plus the notices the Egosoft Fan Content Policy and
 * Lucasfilm's fan-site guidance ask for. Keep it free of ads, sales and
 * donation links: the site must stay non-commercial.
 */
export function Footer({ manifest }: { manifest: Manifest }) {
  return (
    <footer className="app-footer">
      <p>
        Game Data: SWI {manifest.swi.label} · X4 {manifest.x4.version}
      </p>
      <p>
        X4: Foundations is a game by Egosoft, available on{" "}
        <a href="https://store.steampowered.com/app/392160/X4_Foundations/">Steam</a> and{" "}
        <a href="https://www.gog.com/en/game/x4_foundations">GOG</a>.
      </p>
      <p>
        Ships and equipment come from{" "}
        <a href="https://www.nexusmods.com/x4foundations/mods/349">Star Wars Interworlds</a>, the
        X4: Foundations mod by the SWI team.
      </p>
      <p>
        This is an unofficial fan project. It is not affiliated with, endorsed, or supported by
        Egosoft. Egosoft assumes no technical support or liability (e.g., for corrupted save games).
        Use at your own risk. All names, trademarks, and content related to X4: Foundations are the
        property of Egosoft or their respective owners.
      </p>
      <p>
        This is a fan site. It is not affiliated with Disney or Lucasfilm. Star Wars names belong to
        their respective owners.
      </p>
    </footer>
  );
}
