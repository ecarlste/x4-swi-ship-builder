import { useEffect, useId, useRef, useState } from "react";
import type { GameData } from "../gameData.ts";
import { indexGameData } from "../gameDataIndex.ts";
import type { SavedLoadoutEntry, SavedLoadoutList } from "../codec/savedLoadouts.ts";
import { describeChange, resolveLoadout } from "../codec/resolve.ts";

/**
 * The Saved Loadouts list: each one's name and Ship name, with Open, Export
 * and Delete. Each entry is checked against the Game Data: one that will
 * change on opening is marked ⚠ with a count and a tooltip naming the
 * changes; one whose Ship is gone is Unavailable, with Export and Delete only.
 * An Unreadable entry offers Delete only. A version change alone isn't shown.
 */
export function SavedLoadoutsList({
  list,
  gameData,
  onOpen,
  onExport,
  onDelete,
}: {
  list: SavedLoadoutList;
  gameData: GameData;
  onOpen: (entry: Extract<SavedLoadoutEntry, { status: "ok" }>) => void;
  onExport: (entry: Extract<SavedLoadoutEntry, { status: "ok" }>) => void;
  onDelete: (entry: SavedLoadoutEntry) => void;
}) {
  const headingId = useId();
  const shipName = (id: string) => indexGameData(gameData).ships.get(id)?.name ?? id;

  return (
    <section className="saved-loadouts" aria-labelledby={headingId}>
      <h2 id={headingId}>Saved Loadouts</h2>
      {!list.ok && (
        <p role="alert" className="error">
          {list.error}
        </p>
      )}
      {list.ok && list.entries.length === 0 && <p className="saved-loadouts-empty">No Saved Loadouts yet.</p>}
      <ul>
        {list.entries.map((entry) => {
          if (entry.status === "unreadable") {
            return (
              <li key={`unreadable-${entry.index}`} className="unreadable">
                <span className="saved-loadout-name">Unreadable</span>{" "}
                <span className="saved-loadout-error">{entry.error}</span>
                <span className="saved-loadout-actions">
                  <button type="button" onClick={() => onDelete(entry)}>
                    Delete
                  </button>
                </span>
              </li>
            );
          }
          // Checked against the Game Data each time the list is shown.
          const resolved = resolveLoadout(gameData, entry.loadout);
          if (resolved.status === "unavailable") {
            return (
              <li key={`unavailable-${entry.loadout.id}-${entry.index}`} className="unavailable">
                <span className="saved-loadout-name">{entry.loadout.name}</span>{" "}
                <span className="saved-loadout-ship">
                  Ship no longer in Game Data <span className="dim">{resolved.ship}</span>
                </span>
                <span className="saved-loadout-actions">
                  <button type="button" onClick={() => onExport(entry)}>
                    Export
                  </button>
                  <button type="button" onClick={() => onDelete(entry)}>
                    Delete
                  </button>
                </span>
              </li>
            );
          }
          const changes = resolved.changes.length;
          return (
            <li key={`ok-${entry.loadout.id}-${entry.index}`}>
              <span className="saved-loadout-name">{entry.loadout.name}</span>{" "}
              <span className="saved-loadout-ship">{shipName(entry.loadout.ship)}</span>
              {changes > 0 && (
                <span className="saved-loadout-changes" title={resolved.changes.map(describeChange).join("\n")}>
                  ⚠ {changes} {changes === 1 ? "item no longer fits" : "items no longer fit"}
                </span>
              )}
              <span className="saved-loadout-actions">
                <button type="button" onClick={() => onOpen(entry)}>
                  Open
                </button>
                <button type="button" onClick={() => onExport(entry)}>
                  Export
                </button>
                <button type="button" onClick={() => onDelete(entry)}>
                  Delete
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Asks for a name the first time a Loadout is saved. */
export function SaveDialog({
  suggestedName,
  onSave,
  onCancel,
}: {
  suggestedName: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [name, setName] = useState(suggestedName);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="save-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim());
        }}
      >
        <h2 id={titleId}>Save Loadout</h2>
        <label>
          Name <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        </label>
        <div className="save-dialog-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit">Save</button>
        </div>
      </form>
    </dialog>
  );
}
