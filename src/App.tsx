import { useEffect, useState } from "react";
import { gameData } from "./gameData.ts";
import { Footer } from "./Footer.tsx";
import { ShipBlock } from "./builder/ShipBlock.tsx";
import { ShipPicker } from "./builder/ShipPicker.tsx";

const APP_TITLE = "X4: SWI Ship Builder";

/**
 * The Loadout being built. Picking a Ship opens it as an Empty Loadout, which
 * names only the Ship; the Loadout table adds Equipment to it.
 */
interface Loadout {
  ship: string;
}

export function App() {
  const [loadout, setLoadout] = useState<Loadout | null>(null);
  const ship = loadout ? (gameData.ships.find((s) => s.id === loadout.ship) ?? null) : null;

  useEffect(() => {
    document.title = ship ? `${ship.name} · ${APP_TITLE}` : APP_TITLE;
  }, [ship]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>{APP_TITLE}</h1>
      </header>
      <div className="toolbar">
        <ShipPicker
          ships={gameData.ships}
          factions={gameData.factions}
          value={ship}
          onPick={(picked) => setLoadout({ ship: picked.id })}
        />
      </div>
      <main className="app-main">
        {ship ? (
          <div className="builder">
            <div className="loadout">
              <h2>{ship.name}</h2>
            </div>
            <aside className="stats" aria-label="Stats">
              <ShipBlock ship={ship} factions={gameData.factions} licences={gameData.licences} />
            </aside>
          </div>
        ) : (
          <p className="builder-empty">Choose a size, then a Ship. It opens as an Empty Loadout.</p>
        )}
      </main>
      <Footer manifest={gameData.manifest} />
    </div>
  );
}
