/**
 * A warning printed before the e2e suite runs when the machine is under load
 * (several worktrees' suites at once), so a red run under contention reads as
 * "contended", not "broken" (#164). Information only: it never fails the run.
 */

export interface LoadSample {
  /** The 1-minute load average. */
  load: number;
  cores: number;
  env: Record<string, string | undefined>;
  /** This checkout's absolute path, left out of the list of other checkouts. */
  checkout: string;
  /** The process list as `ps -eo args` prints it; only read when the machine is under load. */
  processList: () => string;
}

export function loadWarning({ load, cores, env, checkout, processList }: LoadSample): string | undefined {
  // CI runners aren't shared, so their load says nothing about other suites.
  if (env.CI || load <= cores) return undefined;
  const warning =
    `Machine under load: 1-minute load average ${load.toFixed(1)} on ${cores} cores. ` +
    `Tests may run past their timeouts; a red run may mean contention, not a break.`;
  let others: string[];
  try {
    others = suiteCheckouts(processList()).filter((path) => path !== checkout);
  } catch {
    return warning;
  }
  return others.length
    ? `${warning} Other checkouts running playwright or vite: ${others.join(", ")}.`
    : `${warning} No other checkout is running playwright or vite.`;
}

/**
 * A playwright or vite process, as node runs it: an absolute path to the
 * checkout's `node_modules` entry point, as its own argument. Shell wrappers
 * and `pgrep` loops that only mention the name don't match.
 */
const SUITE_PROCESS =
  /(?:^|\s)(\/\S*?)\/node_modules\/(?:\.bin\/(?:playwright|vite)|@playwright\/test\/cli\.js|playwright\/cli\.js|vite\/bin\/vite\.js)(?=\s|$)/;

/** The checkouts running playwright or vite, sorted and without repeats. */
function suiteCheckouts(processList: string): string[] {
  const paths = new Set<string>();
  for (const line of processList.split("\n")) {
    const match = SUITE_PROCESS.exec(line);
    if (match) paths.add(match[1]);
  }
  return [...paths].sort();
}
