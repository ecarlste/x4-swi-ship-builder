/**
 * The builder session: the one in-app Loadout and everything that changes
 * with it, with each transition written once. It holds no React; the app
 * reads it through `useSession`.
 */
import type { GameData, Ship } from "../gameData.ts";
import { indexGameData } from "../gameDataIndex.ts";
import { loadoutStats, type LoadoutStats } from "../stats/stats.ts";
import { openingOfSaved, openingOfShared, type SavedLoadout } from "../codec/loadout.ts";
import { carriesShareLink, readShareLink, shareLinkUrl } from "../codec/shareLink.ts";
import { exportLoadoutFile, importLoadoutFile } from "../codec/loadoutFile.ts";
import { resolveLoadout, type Resolution } from "../loadout/resolve.ts";
import {
  deleteSavedLoadout,
  readSavedLoadouts,
  saveLoadout,
  type LoadoutName,
  type LoadoutStorage,
  type SavedLoadoutEntry,
  type SavedLoadoutList,
} from "../codec/savedLoadouts.ts";
import { changedSince } from "./changes.ts";
import type { Loadout } from "../loadout/loadout.ts";
import { emptyLoadout } from "../loadout/rules.ts";

/** A status message, or an error, shown as a toast. */
export type Message = { kind: "status" | "error"; text: string };

const status = (text: string): Message => ({ kind: "status", text });
const error = (text: string): Message => ({ kind: "error", text });

/** What resolving the opened Loadout against the Game Data dropped or clamped, until dismissed. */
export type ResolutionNotice = Pick<Extract<Resolution, { status: "ok" }>, "repairs" | "versions">;

export interface SessionState {
  /** The one in-app Loadout. Picking a Ship opens it as an Empty Loadout. */
  loadout: Loadout | null;
  /** The current Loadout's Ship. */
  ship: Ship | null;
  /**
   * The name the current Loadout was opened or last saved under. With an id
   * it's a Saved Loadout, which Save updates; without one, Save asks for a
   * name, suggesting this one.
   */
  opened: LoadoutName | null;
  /** The Loaded Loadout: the Loadout as it was last opened or saved. A freshly picked Ship has none. */
  loaded: Loadout | null;
  /** Shown through edits, until the next open, pick or save. */
  message: Message | null;
  /** What opening the Loadout repaired, until dismissed or saved. */
  notice: ResolutionNotice | null;
  /** The Saved Loadouts as last read from storage. */
  savedList: SavedLoadoutList;
  /** Whether the Saved Loadouts list is shown. */
  showSaved: boolean;
  /**
   * The Save dialog, while it's asking for a name. It suggests the name the
   * Loadout is open under, or its Ship's, and follows what's open.
   */
  naming: { suggestedName: string } | null;
  /** The current Loadout's stats. */
  stats: LoadoutStats | null;
  /** The Loaded Loadout, while the current Loadout differs from it. */
  was: Loadout | null;
  /** The stats of `was`, to compare the current stats against. */
  wasStats: LoadoutStats | null;
}

/** Where a Loadout being opened came from, as its errors name it. */
type OpenedFrom = "Saved Loadout" | "Share Link";

export interface SessionPorts {
  gameData: GameData;
  storage: LoadoutStorage;
  clipboard: { writeText(text: string): Promise<void> };
  /** Hands the user a file with this text to save. */
  download(text: string, fileName: string): void;
}

export type Session = ReturnType<typeof createSession>;

/** A file name from a Saved Loadout's name, without characters file systems refuse. */
const fileNameFor = (name: string) => `${name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").trim() || "loadout"}.json`;

export function createSession({ gameData, storage, clipboard, download }: SessionPorts) {
  const listeners = new Set<() => void>();
  /**
   * Counts what opened a Loadout (a pick, a Saved Loadout) or began reading a
   * Share Link, so a Share Link read that finishes after a later one is
   * ignored: latest wins.
   */
  let openings = 0;

  const shipOf = (loadout: Loadout | null) => (loadout ? (indexGameData(gameData).ships.get(loadout.ship) ?? null) : null);

  let state: SessionState = {
    loadout: null,
    ship: null,
    opened: null,
    loaded: null,
    message: null,
    notice: null,
    savedList: readSavedLoadouts(storage),
    showSaved: false,
    naming: null,
    stats: null,
    was: null,
    wasStats: null,
  };

  /** Applies a change, working out what follows from the Loadout and the Loaded Loadout only when either changed. */
  const set = (patch: Partial<SessionState>) => {
    const next = { ...state, ...patch };
    if (next.loadout !== state.loadout || next.loaded !== state.loaded) {
      next.ship = shipOf(next.loadout);
      next.stats = next.loadout && next.ship ? loadoutStats(gameData, next.loadout) : null;
      next.was = changedSince(gameData, next.loaded, next.loadout);
      next.wasStats = next.was ? loadoutStats(gameData, next.was) : null;
    }
    const suggestedName = next.opened?.name ?? next.ship?.name;
    if (next.naming && suggestedName !== undefined && suggestedName !== next.naming.suggestedName) {
      next.naming = { suggestedName };
    }
    state = next;
    for (const listener of listeners) listener();
  };

  /**
   * Resolves a stored or shared Loadout against the Game Data and opens the
   * repaired version as the Loaded Loadout, with a notice when anything was
   * dropped or clamped. When its Ship is gone nothing opens, and the error
   * says which Ship, from what.
   */
  const resolveAndOpen = (stored: Loadout, named: LoadoutName | null, from: OpenedFrom) => {
    const resolved = resolveLoadout(gameData, stored);
    if (resolved.status === "unavailable") {
      set({ message: error(`This ${from}'s Ship (${resolved.ship}) isn't in the Game Data.`) });
      return;
    }
    openings++;
    set({
      loadout: resolved.loadout,
      loaded: resolved.loadout,
      opened: named,
      showSaved: false,
      message: null,
      notice: resolved.repairs.length > 0 ? { repairs: resolved.repairs, versions: resolved.versions } : null,
    });
  };

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },

    /** Opens a Ship as an Empty Loadout, with no Loaded Loadout. */
    pickShip(ship: Ship) {
      openings++;
      set({ loadout: emptyLoadout(gameData, ship), loaded: null, opened: null, message: null, notice: null });
    },

    /** Replaces the Loadout with an edited one. */
    edit(loadout: Loadout) {
      set({ loadout });
    },

    /**
     * Saves the Loadout. Under a name, it's added as a new Saved Loadout.
     * Without one, the opened Saved Loadout is updated; a Loadout that isn't
     * one asks for a name, suggesting the one it was opened under or its Ship's.
     */
    save(name?: string) {
      const { loadout, opened, ship } = state;
      if (!loadout || !ship) return;
      const target = name !== undefined ? { name } : opened?.id !== undefined ? opened : null;
      if (!target) {
        set({ naming: { suggestedName: opened?.name ?? ship.name } });
        return;
      }
      const result = saveLoadout(storage, loadout, target);
      const savedList = readSavedLoadouts(storage);
      set(
        result.ok
          ? {
              naming: null,
              savedList,
              opened: { id: result.saved.id, name: result.saved.name },
              loaded: loadout,
              notice: null,
              message: status(`Saved “${result.saved.name}”.`),
            }
          : { naming: null, savedList, message: error(result.error) },
      );
    },

    /** Closes the Save dialog without saving. */
    cancelNaming() {
      set({ naming: null });
    },

    /** Opens a Saved Loadout, repaired against the Game Data, under its name and id. */
    openSaved(saved: SavedLoadout) {
      const { loadout, named } = openingOfSaved(saved);
      resolveAndOpen(loadout, named, "Saved Loadout");
    },

    /**
     * Opens the Loadout a Share Link carries in a URL fragment, repaired
     * against the Game Data, under the name it was shared with but no id.
     * Resolves to whether the fragment carried a Share Link at all. If
     * anything else opens a Loadout, or another link is read, while this one
     * is read, it's ignored.
     */
    async openShareLink(hash: string): Promise<boolean> {
      if (!carriesShareLink(hash)) return false;
      const opening = ++openings;
      const result = await readShareLink(hash);
      if (result === null || opening !== openings) return true;
      if (!result.ok) {
        set({ message: error(result.error) });
        return true;
      }
      const { loadout, named } = openingOfShared(result.loadout);
      resolveAndOpen(loadout, named, "Share Link");
      return true;
    },

    /** Copies a Share Link to the Loadout, on the app at `href`, carrying the name it's open under. */
    async copyLink(href: string) {
      const { loadout, opened } = state;
      if (!loadout) return;
      try {
        await clipboard.writeText(await shareLinkUrl(href, opened ? { ...loadout, name: opened.name } : loadout));
        set({ message: status("Link copied to the clipboard.") });
      } catch {
        set({ message: error("The link couldn't be copied to the clipboard.") });
      }
    },

    /**
     * Deletes a Saved Loadout. When it's the open one, the open Loadout keeps
     * its name and its Loaded Loadout but loses the id, so Save asks for a name.
     */
    delete(entry: SavedLoadoutEntry) {
      deleteSavedLoadout(storage, entry);
      const { opened } = state;
      const wasOpen = entry.status === "ok" && opened?.id !== undefined && entry.loadout.id === opened.id;
      set({ savedList: readSavedLoadouts(storage), ...(wasOpen && { opened: { name: opened.name } }) });
    },

    /** Shows or hides the Saved Loadouts list, reading storage again as it's shown. */
    toggleSaved() {
      set(state.showSaved ? { showSaved: false } : { showSaved: true, savedList: readSavedLoadouts(storage) });
    },

    /**
     * Imports a picked Loadout File, adding its Loadouts and showing the list.
     * It doesn't touch the open Loadout, so one that finishes late still applies.
     */
    async import(file: Blob) {
      const result = await importLoadoutFile(storage, file);
      const savedList = readSavedLoadouts(storage);
      if (result.ok) {
        const count = result.added.length;
        set({
          savedList,
          showSaved: true,
          message: status(`Imported ${count} ${count === 1 ? "Loadout" : "Loadouts"}.`),
        });
      } else {
        set({ savedList, message: error(result.error) });
      }
    },

    /** Downloads every readable Saved Loadout as one Loadout File. */
    exportAll() {
      const savedList = readSavedLoadouts(storage);
      if (!savedList.ok) {
        set({ savedList, message: error(savedList.error) });
        return;
      }
      const loadouts = savedList.entries.flatMap((entry) => (entry.status === "ok" ? [entry.loadout] : []));
      if (loadouts.length === 0) {
        set({ savedList, message: error("There are no Saved Loadouts to export.") });
        return;
      }
      set({ savedList });
      download(exportLoadoutFile(loadouts), "saved-loadouts.json");
    },

    /** Downloads one Saved Loadout as a Loadout File named after it. */
    exportOne(saved: SavedLoadout) {
      download(exportLoadoutFile([saved]), fileNameFor(saved.name));
    },

    /** Hides the notice of what opening the Loadout repaired. */
    dismissNotice() {
      set({ notice: null });
    },
  };
}
