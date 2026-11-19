/**
 * The bundled snapshot's JSON files, aliased in vite.config.ts. Typed as
 * unknown on purpose: `gameData.ts` validates them before anything uses them.
 */
declare module "@snapshot/*.json" {
  const value: unknown;
  export default value;
}
