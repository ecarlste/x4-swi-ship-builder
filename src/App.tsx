import { useEffect, useRef, useState } from "react";
import { gameData } from "./gameData.ts";
import { Footer } from "./Footer.tsx";
import { ShipBlock } from "./builder/ShipBlock.tsx";
import { ShipPicker } from "./builder/ShipPicker.tsx";
import { LoadoutTable } from "./builder/LoadoutTable.tsx";
import { StatsPanel } from "./builder/StatsPanel.tsx";
import { SaveDialog, SavedLoadoutsList } from "./builder/SavedLoadouts.tsx";
import { ChangesNotice } from "./builder/ChangesNotice.tsx";
import { createSession } from "./builder/session.ts";
import { useSession } from "./builder/useSession.ts";

const APP_TITLE = "X4: SWI Ship Builder";

/** Hands the browser a file to download. */
function download(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** The builder session on this browser's storage, clipboard and downloads. */
const browserSession = () =>
  createSession({
    gameData,
    storage: localStorage,
    clipboard: { writeText: (text) => navigator.clipboard.writeText(text) },
    download,
  });

export function App() {
  const [session] = useState(browserSession);
  const { loadout, ship, opened, notice, message, savedList, showSaved, naming, stats, was, wasStats } =
    useSession(session);
  const importInput = useRef<HTMLInputElement>(null);
  const missing = stats?.missing ?? [];

  /** Opens the Loadout a Share Link carries in the URL fragment, if there is one. */
  useEffect(() => {
    const openShareLink = async () => {
      // The link has done its job; edits shouldn't leave a stale Loadout in the address bar.
      if (await session.openShareLink(location.hash)) {
        window.history.replaceState(null, "", location.pathname + location.search);
      }
    };
    void openShareLink();
    window.addEventListener("hashchange", openShareLink);
    return () => window.removeEventListener("hashchange", openShareLink);
  }, [session]);

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
          onPick={session.pickShip}
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
            onClick={session.toggleSaved}
          >
            Saved Loadouts
          </button>
          <button
            type="button"
            disabled={!loadout}
            onClick={() => session.save()}
          >
            Save
          </button>
          <button type="button" onClick={session.exportAll}>
            Export
          </button>
          <button type="button" onClick={() => importInput.current?.click()}>
            Import
          </button>
          <input
            ref={importInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void session.import(file);
            }}
          />

          <button type="button" disabled={!loadout} onClick={() => void session.copyLink(location.href)}>
            Copy link
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
      {notice && <ChangesNotice {...notice} onDismiss={session.dismissNotice} />}
      {naming && (
        <SaveDialog
          suggestedName={naming.suggestedName}
          onSave={(name) => session.save(name)}
          onCancel={session.cancelNaming}
        />
      )}
      {showSaved && (
        <SavedLoadoutsList
          list={savedList}
          gameData={gameData}
          onOpen={(entry) => session.openSaved(entry.loadout)}
          onExport={(entry) => session.exportOne(entry.loadout)}
          onDelete={session.delete}
        />
      )}
      <main className="app-main">
        {ship && loadout && stats ? (
          <div className="builder">
            <div className="loadout">
              <h2>{ship.name}</h2>
              <LoadoutTable
                gameData={gameData}
                ship={ship}
                loadout={loadout}
                missing={new Set(missing.map((m) => m.row))}
                was={was}
                onChange={session.edit}
              />
            </div>
            <aside className="stats" aria-label="Stats">
              <ShipBlock gameData={gameData} ship={ship} />
              <StatsPanel stats={stats} was={wasStats} />
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
