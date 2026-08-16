import { Suspense, lazy, useState } from "react";
import type { SystemAction, SystemDirective } from "./GameCanvasRuntime";

type GameMode = "system" | "nasi" | "infinity";

function GameCanvasFallback() {
  return (
    <div className="game-fallback game-fallback-system" aria-hidden="true">
      <span className="game-fallback-grid" />
      <span className="game-fallback-host" />
      <span className="game-fallback-orb" />
      <span className="game-fallback-route" />
      <span className="game-fallback-target" />
    </div>
  );
}

// Phaser is ~350 KB gzip. It downloads on the first click, never on page load —
// the line-art poster below is the default state, not a placeholder.
const GameCanvas = lazy(() =>
  import("./GameCanvasRuntime").then((module) => ({ default: module.GameCanvasRuntime })),
);

const gameCopy: Record<GameMode, { index: string; title: string; status: string; instruction: string; description: string; href?: string }> = {
  system: {
    index: "01",
    title: "I Got a System",
    status: "Current WIP · Godot",
    instruction: "Set a priority; the host keeps acting",
    description: "A cultivation game where you are the System: set behavioural priorities, watch an autonomous host act, then review the result.",
  },
  nasi: {
    index: "02",
    title: "Nasi Lemak Survivors",
    status: "Released · Google Play",
    instruction: "Move pointer or touch · collision resets",
    description: "A Malaysian survivor roguelite built end to end in Godot, including gameplay, pixel art, animation and release.",
    href: "https://play.google.com/store/apps/details?id=com.eternalamaris.nasilemak.survivors",
  },
  infinity: {
    index: "03",
    title: "To Infinity and Beyond",
    status: "Released · Itch.io",
    instruction: "← → / A D to move · Space or tap to jump",
    description: "A solo-developed precision platformer designed, programmed, illustrated, animated and published in Godot.",
    href: "https://kevin-d-eternal.itch.io/to-infinity-and-beyond",
  },
};

export function GameMicroDemo() {
  const [mode, setMode] = useState<GameMode>("system");
  const [started, setStarted] = useState(false);
  const [directive, setDirective] = useState<SystemDirective>({ action: "搜", version: 0 });
  const [systemResult, setSystemResult] = useState("Autonomous loop starting · Waiting for the host’s first result.");
  const active = gameCopy[mode];

  const directHost = (action: SystemAction) => {
    setDirective((current) => ({ action, version: current.version + 1 }));
    setSystemResult(`${action} priority sent · The host will interpret it inside the autonomous loop.`);
  };

  return (
    <div className="game-showcase">
      <div className="game-stage-shell">
        <div className="game-stage-topline">
          <span>EAU interactive vignette</span>
          <span>{active.instruction}</span>
        </div>
        {started ? (
          <Suspense fallback={<GameCanvasFallback />}>
            <GameCanvas
              mode={mode}
              title={active.title}
              systemDirective={directive}
              onSystemResult={setSystemResult}
            />
          </Suspense>
        ) : (
          <div className="game-start-shell">
            <GameCanvasFallback />
            <button className="game-start-button" type="button" onClick={() => setStarted(true)}>
              <span>Start the demo</span>
              <small>Loads the game runtime only when asked</small>
            </button>
          </div>
        )}
      </div>
      {started && mode === "system" ? (
        <div className="system-console" aria-label="System behaviour controls">
          <div className="system-directives">
            {(["搜", "打", "割"] as SystemAction[]).map((action) => (
              <button
                type="button"
                aria-pressed={directive.action === action}
                onClick={() => directHost(action)}
                key={action}
              >
                <strong>{action}</strong>
                <span>{action === "搜" ? "Seek priority" : action === "打" ? "Engage priority" : "Harvest priority"}</span>
              </button>
            ))}
          </div>
          <output aria-live="polite">{systemResult}</output>
        </div>
      ) : null}
      <div className="game-selector" role="tablist" aria-label="Game projects">
        {(Object.keys(gameCopy) as GameMode[]).map((key) => {
          const item = gameCopy[key];
          return (
            <button
              type="button"
              role="tab"
              aria-selected={mode === key}
              className={mode === key ? "active" : ""}
              onClick={() => setMode(key)}
              key={key}
            >
              <span>{item.index}</span>
              <small>{item.status}</small>
              <strong>{item.title}</strong>
            </button>
          );
        })}
      </div>
      <div className="game-active-copy">
        <p>{active.description}</p>
        {active.href ? <a href={active.href} target="_blank" rel="noreferrer">Open full project ↗</a> : <span>Private development</span>}
      </div>
    </div>
  );
}
