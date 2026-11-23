import { describe, expect, it } from "vitest";
import { loadWarning } from "./machine-load.ts";

const checkout = "/home/dev/x4-swi-ship-builder-164";
const noProcesses = () => "";

describe("loadWarning", () => {
  it("says nothing when load is at or below the core count", () => {
    expect(loadWarning({ load: 12, cores: 12, env: {}, checkout, processList: noProcesses })).toBeUndefined();
    expect(loadWarning({ load: 3.5, cores: 12, env: {}, checkout, processList: noProcesses })).toBeUndefined();
  });

  it("names the load average and core count when load is above the core count", () => {
    const warning = loadWarning({ load: 80.26, cores: 12, env: {}, checkout, processList: noProcesses });
    expect(warning).toContain("load average 80.3");
    expect(warning).toContain("12 cores");
    expect(warning).not.toContain("\n");
  });

  it("names the other checkouts running playwright or vite, by path", () => {
    const ps = [
      "ARGS",
      "/usr/bin/zsh -c eval 'until ! pgrep -f \"x4-swi-ship-builder-v2/node_modules/.bin/playwright\"; do sleep 5; done'",
      "npm exec vite prototype/builder-screen --port 5199 --strictPort",
      "sh -c 'vite' prototype/builder-screen --port 5199 --strictPort",
      "node /home/dev/x4-swi-ship-builder-prototype/node_modules/.bin/vite prototype/builder-screen --port 5199",
      "node /home/dev/x4-swi-ship-builder-152/node_modules/.bin/playwright test",
      "node /home/dev/x4-swi-ship-builder-152/node_modules/.bin/vite preview --outDir .cache/e2e-dist --port 21234",
      `node ${checkout}/node_modules/.bin/playwright test`,
      `node ${checkout}/node_modules/.bin/vite preview --outDir .cache/e2e-dist --port 25555`,
      "node /home/dev/other-app/node_modules/.bin/vitest run",
    ].join("\n");
    const warning = loadWarning({ load: 30, cores: 12, env: {}, checkout, processList: () => ps });
    expect(warning).toContain(
      "Other checkouts running playwright or vite: /home/dev/x4-swi-ship-builder-152, /home/dev/x4-swi-ship-builder-prototype.",
    );
    expect(warning).not.toContain("x4-swi-ship-builder-v2");
    expect(warning).not.toContain("other-app");
    expect(warning).not.toContain(`${checkout},`);
  });

  it("says when no other checkout is running playwright or vite", () => {
    const warning = loadWarning({ load: 30, cores: 12, env: {}, checkout, processList: noProcesses });
    expect(warning).toContain("No other checkout is running playwright or vite.");
  });

  it("still warns when the process list can't be read", () => {
    const processList = () => {
      throw new Error("spawn ps ENOENT");
    };
    const warning = loadWarning({ load: 30, cores: 12, env: {}, checkout, processList });
    expect(warning).toContain("load average 30.0 on 12 cores");
    expect(warning).not.toContain("other checkout");
  });

  it("doesn't read the process list on a quiet machine or in CI", () => {
    const processList = () => {
      throw new Error("process list read");
    };
    expect(() => loadWarning({ load: 2, cores: 12, env: {}, checkout, processList })).not.toThrow();
    expect(() => loadWarning({ load: 80, cores: 12, env: { CI: "1" }, checkout, processList })).not.toThrow();
  });

  it("says nothing in CI, where the runner isn't shared", () => {
    expect(
      loadWarning({ load: 80, cores: 4, env: { CI: "true" }, checkout, processList: noProcesses }),
    ).toBeUndefined();
  });
});
