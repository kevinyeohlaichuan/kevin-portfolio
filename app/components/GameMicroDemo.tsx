"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

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

const GameCanvas = dynamic(
  () => import("./GameCanvasRuntime").then((module) => module.GameCanvasRuntime),
  { ssr: false, loading: () => <GameCanvasFallback /> },
);

const gameCopy: Record<GameMode, { index: string; title: string; status: string; instruction: string; description: string; href?: string }> = {
  system: {
    index: "01",
    title: "I Got a System",
    status: "Current WIP · Godot",
    instruction: "Click to guide the host",
    description: "A cultivation game where you are the System: a floating companion that teaches an autonomous host.",
  },
  nasi: {
    index: "02",
    title: "Nasi Lemak Survivors",
    status: "Released · Google Play",
    instruction: "Move the pointer to survive",
    description: "A Malaysian survivor roguelite built end to end in Godot, including gameplay, pixel art, animation and release.",
    href: "https://play.google.com/store/apps/details?id=com.eternalamaris.nasilemak.survivors",
  },
  infinity: {
    index: "03",
    title: "To Infinity and Beyond",
    status: "Released · Itch.io",
    instruction: "Click or press Space to jump",
    description: "A solo-developed precision platformer designed, programmed, illustrated, animated and published in Godot.",
    href: "https://kevin-d-eternal.itch.io/to-infinity-and-beyond",
  },
};

export function GameMicroDemo() {
  const [mode, setMode] = useState<GameMode>("system");
  const active = gameCopy[mode];

  return (
    <div className="game-showcase">
      <div className="game-stage-shell">
        <div className="game-stage-topline">
          <span>EAU interactive vignette</span>
          <span>{active.instruction}</span>
        </div>
        <GameCanvas mode={mode} title={active.title} />
      </div>
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
