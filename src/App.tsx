import { gameData } from "./gameData.ts";
import { Footer } from "./Footer.tsx";

export function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>X4: SWI Ship Builder</h1>
      </header>
      <main className="app-main" />
      <Footer manifest={gameData.manifest} />
    </div>
  );
}
