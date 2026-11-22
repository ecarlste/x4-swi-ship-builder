import { useEffect, useRef, useState } from "react";
import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { gameData } from "./gameData.ts";
import { Footer } from "./Footer.tsx";
import { ShipBlock } from "./builder/ShipBlock.tsx";
import { ShipPicker } from "./builder/ShipPicker.tsx";
import { LoadoutTable } from "./builder/LoadoutTable.tsx";
import { StatsPanel } from "./builder/StatsPanel.tsx";
import { SaveDialog, SavedLoadoutsList } from "./builder/SavedLoadouts.tsx";
import { RepairsNotice } from "./builder/RepairsNotice.tsx";
import { createSession } from "./builder/session.ts";
import { useSession } from "./builder/useSession.ts";
import { Button } from "@/components/ui/button";

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
      <div
        className="sticky top-0 z-5 flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2"
        role="toolbar"
        aria-label="Builder"
      >
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
          <Button variant="outline" aria-expanded={showSaved} onClick={session.toggleSaved}>
            Saved Loadouts
          </Button>
          <Button variant="outline" disabled={!loadout} onClick={() => session.save()}>
            Save
          </Button>
          <Button variant="outline" onClick={session.exportAll}>
            Export
          </Button>
          <Button variant="outline" onClick={() => importInput.current?.click()}>
            Import
          </Button>
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

          <Button variant="outline" disabled={!loadout} onClick={() => void session.copyLink(location.href)}>
            Copy link
          </Button>
        </div>
      </div>
      <div role="status" className="px-4 py-1 text-sm text-muted-foreground empty:hidden">
        {message?.kind === "status" && message.text}
      </div>
      {message?.kind === "error" && (
        <Alert variant="destructive" className="mx-4 my-2 w-auto">
          <CircleAlert />
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
      {notice && <RepairsNotice {...notice} onDismiss={session.dismissNotice} />}
      <SaveDialog naming={naming} onSave={(name) => session.save(name)} onCancel={session.cancelNaming} />
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
                was={was}
                onChange={session.edit}
              />
            </div>
            <aside className="self-start rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10" aria-label="Stats">
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
