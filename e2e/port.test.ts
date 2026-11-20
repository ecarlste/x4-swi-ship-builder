import { describe, expect, it } from "vitest";
import { playwrightPort } from "./port.ts";

const main = "/home/dev/x4-swi-ship-builder";
const worktrees = [
  main,
  "/home/dev/x4-swi-ship-builder/.claude/worktrees/agent-1",
  "/home/dev/x4-swi-ship-builder/.claude/worktrees/agent-2",
  "/home/dev/x4-swi-ship-builder/.claude/worktrees/agent-3",
  "/tmp/x4-swi-ship-builder",
];

describe("playwrightPort", () => {
  it("gives a checkout the same port every time", () => {
    expect(playwrightPort(main, {})).toBe(playwrightPort(main, {}));
  });

  it("gives different checkouts different ports", () => {
    const ports = worktrees.map((path) => playwrightPort(path, {}));
    expect(new Set(ports).size).toBe(worktrees.length);
  });

  it("keeps every default port in 20000–29999, clear of Vite's 5173", () => {
    for (const path of worktrees) {
      const port = playwrightPort(path, {});
      expect(port).toBeGreaterThanOrEqual(20000);
      expect(port).toBeLessThanOrEqual(29999);
    }
  });

  it("uses PW_PORT when it is set", () => {
    expect(playwrightPort(main, { PW_PORT: "5301" })).toBe(5301);
  });

  it("rejects a PW_PORT that isn't a port number", () => {
    expect(() => playwrightPort(main, { PW_PORT: "abc" })).toThrow(/PW_PORT/);
    expect(() => playwrightPort(main, { PW_PORT: "70000" })).toThrow(/PW_PORT/);
  });
});
