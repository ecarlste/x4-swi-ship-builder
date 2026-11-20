import { useEffect, useId, useRef, useState } from "react";
import type { Ship } from "../gameData.ts";
import type { SavedLoadoutEntry, SavedLoadoutList } from "../codec/savedLoadouts.ts";

/**
 * The Saved Loadouts list: each one's name and Ship name, with Open and
 * Delete. An Unreadable entry offers Delete only.
 */
export function SavedLoadoutsList({
  list,
  ships,
  onOpen,
  onDelete,
}: {
  list: SavedLoadoutList;
  ships: Ship[];
  onOpen: (entry: Extract<SavedLoadoutEntry, { status: "ok" }>) => void;
  onDelete: (entry: SavedLoadoutEntry) => void;
}) {
  const headingId = useId();
  const shipName = (id: string) => ships.find((s) => s.id === id)?.name ?? id;

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
        {list.entries.map((entry) =>
          entry.status === "ok" ? (
            <li key={`ok-${entry.loadout.id}-${entry.index}`}>
              <span className="saved-loadout-name">{entry.loadout.name}</span>{" "}
              <span className="saved-loadout-ship">{shipName(entry.loadout.ship)}</span>
              <span className="saved-loadout-actions">
                <button type="button" onClick={() => onOpen(entry)}>
                  Open
                </button>
                <button type="button" onClick={() => onDelete(entry)}>
                  Delete
                </button>
              </span>
            </li>
          ) : (
            <li key={`unreadable-${entry.index}`} className="unreadable">
              <span className="saved-loadout-name">Unreadable</span>{" "}
              <span className="saved-loadout-error">{entry.error}</span>
              <span className="saved-loadout-actions">
                <button type="button" onClick={() => onDelete(entry)}>
                  Delete
                </button>
              </span>
            </li>
          ),
        )}
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
