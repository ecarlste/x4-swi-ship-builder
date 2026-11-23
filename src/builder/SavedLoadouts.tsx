import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GameData } from "../gameData.ts";
import { indexGameData } from "../gameDataIndex.ts";
import type { SavedLoadoutEntry, SavedLoadoutList } from "../codec/savedLoadouts.ts";
import { describeRepair } from "../loadout/repairs.ts";
import { resolveLoadout } from "../loadout/resolve.ts";
import { TooltipMark, WarningGlyph } from "./TooltipMark.tsx";

/**
 * The Saved Loadouts list: each one's name and Ship name, with Open, Export
 * and Delete. Each entry is checked against the Game Data: one that opens
 * with Repairs is marked with a warning, a count and a Tooltip naming the
 * Repairs; one whose Ship is gone is Unavailable, with Export and Delete only.
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
    <section className="mx-4 my-2 rounded-xl border bg-card px-3 py-2 text-card-foreground" aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-2 font-heading text-base font-medium">
        Saved Loadouts
      </h2>
      {!list.ok && (
        <Alert variant="destructive" className="mb-2">
          <CircleAlert />
          <AlertDescription>{list.error}</AlertDescription>
        </Alert>
      )}
      {list.ok && list.entries.length === 0 && <p className="text-sm text-muted-foreground">No Saved Loadouts yet.</p>}
      <ul className="text-sm">
        {list.entries.map((entry) => {
          if (entry.status === "unreadable") {
            return (
              <Entry key={`unreadable-${entry.index}`}>
                <span className="text-destructive">Unreadable</span>{" "}
                <span className="text-muted-foreground">{entry.error}</span>
                <Actions>
                  <EntryButton onClick={() => onDelete(entry)}>Delete</EntryButton>
                </Actions>
              </Entry>
            );
          }
          // Checked against the Game Data each time the list is shown.
          const resolved = resolveLoadout(gameData, entry.loadout);
          if (resolved.status === "unavailable") {
            return (
              <Entry key={`unavailable-${entry.loadout.id}-${entry.index}`}>
                <span className="text-muted-foreground/60">{entry.loadout.name}</span>{" "}
                <span className="text-muted-foreground/60">
                  Ship no longer in Game Data <span className="text-muted-foreground">{resolved.ship}</span>
                </span>
                <Actions>
                  <EntryButton onClick={() => onExport(entry)}>Export</EntryButton>
                  <EntryButton onClick={() => onDelete(entry)}>Delete</EntryButton>
                </Actions>
              </Entry>
            );
          }
          const repairs = resolved.repairs.length;
          return (
            <Entry key={`ok-${entry.loadout.id}-${entry.index}`}>
              <span className="font-medium">{entry.loadout.name}</span>{" "}
              <span className="text-muted-foreground">{shipName(entry.loadout.ship)}</span>
              {repairs > 0 && (
                <TooltipMark explanation={resolved.repairs.map(describeRepair).join("\n")} className="text-warning">
                  <WarningGlyph /> {repairs} {repairs === 1 ? "Repair" : "Repairs"}
                </TooltipMark>
              )}
              <Actions>
                <EntryButton onClick={() => onOpen(entry)}>Open</EntryButton>
                <EntryButton onClick={() => onExport(entry)}>Export</EntryButton>
                <EntryButton onClick={() => onDelete(entry)}>Delete</EntryButton>
              </Actions>
            </Entry>
          );
        })}
      </ul>
    </section>
  );
}

function Entry({ children }: { children: ReactNode }) {
  return <li className="flex items-center gap-3 border-t py-1.5">{children}</li>;
}

function Actions({ children }: { children: ReactNode }) {
  return <span className="ml-auto flex gap-1.5">{children}</span>;
}

function EntryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      {children}
    </Button>
  );
}

/**
 * Asks for a name the first time a Loadout is saved. Open while `naming` is set; it stays mounted
 * so focus returns to the control that opened it when it closes.
 */
export function SaveDialog({
  naming,
  onSave,
  onCancel,
}: {
  naming: { suggestedName: string } | null;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const open = naming !== null;
  // Nothing in the dialog is its trigger, so Base UI can't tell where focus came from: note the
  // control that had focus as it opens, before focus moves in, and return focus there on close.
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      // A native modal dialog ignores a click outside it; so does this one.
      disablePointerDismissal
    >
      <DialogContent showCloseButton={false} finalFocus={opener}>
        {/* Mounted afresh each time the dialog opens, so the name starts at the suggestion. */}
        <SaveForm suggestedName={naming?.suggestedName ?? ""} onSave={onSave} onCancel={onCancel} />
      </DialogContent>
    </Dialog>
  );
}

function SaveForm({
  suggestedName,
  onSave,
  onCancel,
}: {
  suggestedName: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const inputId = useId();
  const [name, setName] = useState(suggestedName);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave(name.trim());
      }}
    >
      <DialogHeader>
        <DialogTitle>Save Loadout</DialogTitle>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor={inputId}>Name</Label>
        <Input id={inputId} value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  );
}
