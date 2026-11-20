import { useEffect, useState } from "react";
import { gameData } from "./gameData.ts";
import { Footer } from "./Footer.tsx";
import { ShipBlock } from "./builder/ShipBlock.tsx";
import { ShipPicker } from "./builder/ShipPicker.tsx";
import { LoadoutTable } from "./builder/LoadoutTable.tsx";
import { emptyLoadout, type Loadout } from "./builder/loadout.ts";
import { missingMandatory } from "./builder/mandatory.ts";
import { SaveDialog, SavedLoadoutsList } from "./builder/SavedLoadouts.tsx";
import type { SavedLoadout } from "./codec/loadout.ts";
import {
  deleteSavedLoadout,
  readSavedLoadouts,
  saveLoadout,
  type SavedLoadoutEntry,
} from "./codec/savedLoadouts.ts";

const APP_TITLE = "X4: SWI Ship Builder";

export function App() {
  /** The one in-app Loadout. Picking a Ship opens it as an Empty Loadout. */
  const [loadout, setLoadout] = useState<Loadout | null>(null);
  /** The Saved Loadout the current Loadout was opened from or last saved as; Save updates it. */
  const [opened, setOpened] = useState<{ id: string; name: string } | null>(null);
  const [savedList, setSavedList] = useState(() => readSavedLoadouts(localStorage));
  const [showSaved, setShowSaved] = useState(false);
  const [naming, setNaming] = useState(false);
  const [message, setMessage] = useState<{ kind: "status" | "error"; text: string } | null>(null);
  const ship = loadout ? (gameData.ships.find((s) => s.id === loadout.ship) ?? null) : null;

  const missing = ship && loadout ? missingMandatory(gameData, ship, loadout) : [];

  const refreshSaved = () => setSavedList(readSavedLoadouts(localStorage));

  const save = (target: { id?: string; name: string }) => {
    if (!loadout) return;
    const result = saveLoadout(localStorage, loadout, target);
    setNaming(false);
    if (result.ok) {
      setOpened({ id: result.saved.id, name: result.saved.name });
      setMessage({ kind: "status", text: `Saved “${result.saved.name}”.` });
    } else {
      setMessage({ kind: "error", text: result.error });
    }
    refreshSaved();
  };

  const open = (saved: SavedLoadout) => {
    const { id, name, createdAt: _c, updatedAt: _u, ...opening } = saved;
    setLoadout(opening);
    setOpened({ id, name });
    setShowSaved(false);
    setMessage(null);
  };

  const remove = (entry: SavedLoadoutEntry) => {
    deleteSavedLoadout(localStorage, entry);
    if (entry.status === "ok" && entry.loadout.id === opened?.id) setOpened(null);
    refreshSaved();
  };

  useEffect(() => {
    document.title = ship ? `${ship.name} · ${APP_TITLE}` : APP_TITLE;
  }, [ship]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>{APP_TITLE}</h1>
      </header>
      <div className="toolbar" role="toolbar" aria-label="Builder">
        <ShipPicker
          ships={gameData.ships}
          factions={gameData.factions}
          value={ship}
          onPick={(picked) => {
            setLoadout(emptyLoadout(gameData, picked));
            setOpened(null);
            setMessage(null);
          }}
        />
        {missing.length > 0 && (
          <span className="mandatory-missing" title={missing.map((m) => m.label).join("\n")}>
            ⚠ {missing.length} mandatory missing
          </span>
        )}
        <div className="toolbar-actions">
          {opened && <span className="opened-name">{opened.name}</span>}
          <button
            type="button"
            aria-expanded={showSaved}
            onClick={() => {
              if (!showSaved) refreshSaved();
              setShowSaved(!showSaved);
            }}
          >
            Saved Loadouts
          </button>
          <button
            type="button"
            disabled={!loadout}
            onClick={() => (opened ? save(opened) : setNaming(true))}
          >
            Save
          </button>
        </div>
      </div>
      <div role="status" className="toolbar-message">
        {message?.kind === "status" && message.text}
      </div>
      {message?.kind === "error" && (
        <p role="alert" className="toolbar-message error">
          {message.text}
        </p>
      )}
      {naming && ship && (
        <SaveDialog suggestedName={ship.name} onSave={(name) => save({ name })} onCancel={() => setNaming(false)} />
      )}
      {showSaved && (
        <SavedLoadoutsList
          list={savedList}
          ships={gameData.ships}
          onOpen={(entry) => open(entry.loadout)}
          onDelete={remove}
        />
      )}
      <main className="app-main">
        {ship && loadout ? (
          <div className="builder">
            <div className="loadout">
              <h2>{ship.name}</h2>
              <LoadoutTable
                gameData={gameData}
                ship={ship}
                loadout={loadout}
                missing={new Set(missing.map((m) => m.row))}
                onChange={setLoadout}
              />
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
