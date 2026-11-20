import { useEffect, useRef, useState } from "react";
import { gameData } from "./gameData.ts";
import { Footer } from "./Footer.tsx";
import { ShipBlock } from "./builder/ShipBlock.tsx";
import { ShipPicker } from "./builder/ShipPicker.tsx";
import { LoadoutTable } from "./builder/LoadoutTable.tsx";
import { StatsPanel } from "./builder/StatsPanel.tsx";
import { emptyLoadout, type Loadout } from "./builder/loadout.ts";
import { loadoutStats } from "./stats/stats.ts";
import { changedSince } from "./builder/changes.ts";
import { SaveDialog, SavedLoadoutsList } from "./builder/SavedLoadouts.tsx";
import type { SavedLoadout } from "./codec/loadout.ts";
import { readShareLink, shareLinkUrl } from "./codec/shareLink.ts";
import { resolveLoadout, type Resolution } from "./codec/resolve.ts";
import { ChangesNotice } from "./builder/ChangesNotice.tsx";
import {
  deleteSavedLoadout,
  readSavedLoadouts,
  saveLoadout,
  type SavedLoadoutEntry,
} from "./codec/savedLoadouts.ts";
import {
  MAX_LOADOUT_FILE_BYTES,
  OVERSIZE_FILE_ERROR,
  exportLoadoutFile,
  importLoadoutFile,
} from "./codec/loadoutFile.ts";

const APP_TITLE = "X4: SWI Ship Builder";

/** Hands the browser a Loadout File to download. */
function download(loadouts: SavedLoadout[], fileName: string) {
  const url = URL.createObjectURL(new Blob([exportLoadoutFile(loadouts)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** A file name from a Saved Loadout's name, without characters file systems refuse. */
const fileNameFor = (name: string) => `${name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").trim() || "loadout"}.json`;

export function App() {
  /** The one in-app Loadout. Picking a Ship opens it as an Empty Loadout. */
  const [loadout, setLoadout] = useState<Loadout | null>(null);
  /**
   * The name the current Loadout was opened or last saved under. With an id
   * it's a Saved Loadout, which Save updates; without one it came from a Share
   * Link, and Save asks for a name, suggesting this one.
   */
  const [opened, setOpened] = useState<{ id?: string; name: string } | null>(null);
  /**
   * The Loadout as it was opened or last saved, for changes since loading.
   * A freshly picked Ship has none.
   */
  const [snapshot, setSnapshot] = useState<Loadout | null>(null);
  const [savedList, setSavedList] = useState(() => readSavedLoadouts(localStorage));
  const [showSaved, setShowSaved] = useState(false);
  const [naming, setNaming] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: "status" | "error"; text: string } | null>(null);
  /** What resolving the opened Loadout against the Game Data dropped or clamped, until dismissed. */
  const [notice, setNotice] = useState<Pick<Extract<Resolution, { status: "ok" }>, "changes" | "versions"> | null>(
    null,
  );
  const ship = loadout ? (gameData.ships.find((s) => s.id === loadout.ship) ?? null) : null;

  const stats = loadout && ship ? loadoutStats(gameData, loadout) : null;
  const missing = stats?.missing ?? [];
  const was = changedSince(snapshot, loadout);
  const wasStats = was ? loadoutStats(gameData, was) : null;

  const refreshSaved = () => setSavedList(readSavedLoadouts(localStorage));

  const save = (target: { id?: string; name: string }) => {
    if (!loadout) return;
    const result = saveLoadout(localStorage, loadout, target);
    setNaming(false);
    if (result.ok) {
      setOpened({ id: result.saved.id, name: result.saved.name });
      setSnapshot(loadout);
      setNotice(null);
      setMessage({ kind: "status", text: `Saved “${result.saved.name}”.` });
    } else {
      setMessage({ kind: "error", text: result.error });
    }
    refreshSaved();
  };

  /**
   * Opens a Loadout and keeps it as the snapshot for changes since loading.
   * The one entry point for opening a Saved Loadout, a Share Link or a
   * repaired Loadout (whose snapshot is the repaired version). `named` is the
   * name it was opened under, with the id of the Saved Loadout that Save
   * should update, if any.
   */
  const openLoadout = (opening: Loadout, named: { id?: string; name: string } | null) => {
    setLoadout(opening);
    setSnapshot(opening);
    setOpened(named);
    setShowSaved(false);
    setMessage(null);
    setNotice(null);
  };

  /**
   * Resolves a stored or shared Loadout against the Game Data and opens the
   * repaired version, with a notice when anything was dropped or clamped.
   * Returns the Ship's id when the Loadout is Unavailable.
   */
  const resolveAndOpen = (stored: Loadout, named: { id?: string; name: string } | null) => {
    const resolved = resolveLoadout(gameData, stored);
    if (resolved.status === "unavailable") return { unavailable: resolved.ship };
    openLoadout(resolved.loadout, named);
    if (resolved.changes.length > 0) setNotice({ changes: resolved.changes, versions: resolved.versions });
    return null;
  };

  const open = (saved: SavedLoadout) => {
    const { id, name, createdAt: _c, updatedAt: _u, ...opening } = saved;
    const failed = resolveAndOpen(opening, { id, name });
    if (failed) setMessage({ kind: "error", text: `This Saved Loadout's Ship (${failed.unavailable}) isn't in the Game Data.` });
  };

  const exportAll = () => {
    const list = readSavedLoadouts(localStorage);
    setSavedList(list);
    if (!list.ok) {
      setMessage({ kind: "error", text: list.error });
      return;
    }
    const loadouts = list.entries.flatMap((entry) => (entry.status === "ok" ? [entry.loadout] : []));
    if (loadouts.length === 0) {
      setMessage({ kind: "error", text: "There are no Saved Loadouts to export." });
      return;
    }
    download(loadouts, "saved-loadouts.json");
  };

  const importFile = async (file: File) => {
    const result =
      file.size > MAX_LOADOUT_FILE_BYTES
        ? ({ ok: false, error: OVERSIZE_FILE_ERROR } as const)
        : importLoadoutFile(localStorage, await file.text());
    if (result.ok) {
      const count = result.added.length;
      setMessage({ kind: "status", text: `Imported ${count} ${count === 1 ? "Loadout" : "Loadouts"}.` });
      setShowSaved(true);
    } else {
      setMessage({ kind: "error", text: result.error });
    }
    refreshSaved();
  };

  const copyLink = async () => {
    if (!loadout) return;
    try {
      const link = await shareLinkUrl(location.href, opened ? { ...loadout, name: opened.name } : loadout);
      await navigator.clipboard.writeText(link);
      setMessage({ kind: "status", text: "Link copied to the clipboard." });
    } catch {
      setMessage({ kind: "error", text: "The link couldn't be copied to the clipboard." });
    }
  };

  /** Opens the Loadout a Share Link carries in the URL fragment, if there is one. */
  useEffect(() => {
    let cancelled = false;
    const openShareLink = async () => {
      const result = await readShareLink(location.hash);
      if (cancelled || result === null) return;
      // The link has done its job; edits shouldn't leave a stale Loadout in the address bar.
      window.history.replaceState(null, "", location.pathname + location.search);
      if (!result.ok) {
        setMessage({ kind: "error", text: result.error });
        return;
      }
      const { name, ...shared } = result.loadout;
      const failed = resolveAndOpen(shared, name === undefined ? null : { name });
      if (failed) setMessage({ kind: "error", text: `This Share Link's Ship (${failed.unavailable}) isn't in the Game Data.` });
    };
    void openShareLink();
    window.addEventListener("hashchange", openShareLink);
    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", openShareLink);
    };
  }, []);

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
            setSnapshot(null);
            setOpened(null);
            setMessage(null);
            setNotice(null);
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
            onClick={() => (opened?.id ? save({ id: opened.id, name: opened.name }) : setNaming(true))}
          >
            Save
          </button>
          <button type="button" onClick={exportAll}>
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
              if (file) void importFile(file);
            }}
          />

          <button type="button" disabled={!loadout} onClick={() => void copyLink()}>
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
      {notice && <ChangesNotice {...notice} onDismiss={() => setNotice(null)} />}
      {naming && ship && (
        <SaveDialog suggestedName={opened?.name ?? ship.name} onSave={(name) => save({ name })} onCancel={() => setNaming(false)} />
      )}
      {showSaved && (
        <SavedLoadoutsList
          list={savedList}
          gameData={gameData}
          onOpen={(entry) => open(entry.loadout)}
          onExport={(entry) => download([entry.loadout], fileNameFor(entry.loadout.name))}
          onDelete={remove}
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
                onChange={setLoadout}
              />
            </div>
            <aside className="stats" aria-label="Stats">
              <ShipBlock ship={ship} factions={gameData.factions} licences={gameData.licences} />
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
