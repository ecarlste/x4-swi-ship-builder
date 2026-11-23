import { useId } from "react";
import { TriangleAlert, X } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatX4Version } from "./format.ts";
import { describeRepair, type LoadoutRepair } from "../loadout/repairs.ts";
import type { GameDataVersions } from "../loadout/resolve.ts";

const versionText = (v: GameDataVersions) => `SWI ${v.swi} · X4 ${formatX4Version(v.x4)}`;

/**
 * The dismissable notice shown when a Loadout opened from a Saved Loadout, a
 * Share Link or a Loadout File was repaired against the Game Data: every
 * Repair, plus the version change.
 */
export function RepairsNotice({
  repairs,
  versions,
  onDismiss,
}: {
  repairs: LoadoutRepair[];
  versions: { from: GameDataVersions; to: GameDataVersions };
  onDismiss: () => void;
}) {
  const headingId = useId();
  const versionChanged = versions.from.swi !== versions.to.swi || versions.from.x4 !== versions.to.x4;

  return (
    <section className="mx-4 my-2" aria-labelledby={headingId}>
      <Alert variant="warning">
        <TriangleAlert aria-hidden />
        <AlertTitle>
          <h2 id={headingId}>This Loadout changed with the Game Data</h2>
        </AlertTitle>
        <AlertDescription>
          {versionChanged && (
            <p>
              It was made with Game Data {versionText(versions.from)}; the builder now has {versionText(versions.to)}.
            </p>
          )}
          <ul className="list-disc pl-5">
            {repairs.map((repair, i) => (
              <li key={i}>{describeRepair(repair)}</li>
            ))}
          </ul>
        </AlertDescription>
        <AlertAction>
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            <X aria-hidden data-icon="inline-start" />
            Dismiss
          </Button>
        </AlertAction>
      </Alert>
    </section>
  );
}
