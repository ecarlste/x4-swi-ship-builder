import { useId } from "react";
import { describeChange, type GameDataVersions, type LoadoutChange } from "../codec/resolve.ts";

const versionText = (v: GameDataVersions) => `SWI ${v.swi} · X4 ${v.x4}`;

/**
 * The dismissable notice shown when a Loadout opened from a Saved Loadout, a
 * Share Link or a Loadout File was repaired against the Game Data: every drop
 * and clamp, plus the version change.
 */
export function ChangesNotice({
  changes,
  versions,
  onDismiss,
}: {
  changes: LoadoutChange[];
  versions: { from: GameDataVersions; to: GameDataVersions };
  onDismiss: () => void;
}) {
  const headingId = useId();
  const versionChanged = versions.from.swi !== versions.to.swi || versions.from.x4 !== versions.to.x4;

  return (
    <section className="changes-notice" aria-labelledby={headingId}>
      <h2 id={headingId}>This Loadout changed with the Game Data</h2>
      {versionChanged && (
        <p>
          It was made with Game Data {versionText(versions.from)}; the builder now has {versionText(versions.to)}.
        </p>
      )}
      <ul>
        {changes.map((change, i) => (
          <li key={i}>{describeChange(change)}</li>
        ))}
      </ul>
      <button type="button" onClick={onDismiss}>
        Dismiss
      </button>
    </section>
  );
}
