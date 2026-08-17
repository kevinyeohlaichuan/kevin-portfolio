import { Suspense, lazy, useEffect, useState } from "react";
import type { ArcadeScore } from "./GameCanvasRuntime";
import { SystemGameDemo } from "./SystemGameDemo";

type GameMode = "system" | "nasi" | "infinity";
interface SavedScore extends ArcadeScore { name: string; }

const GameCanvas = lazy(() => import("./GameCanvasRuntime").then((module) => ({ default: module.GameCanvasRuntime })));

const gameCopy: Record<GameMode, { index: string; title: string; status: string; instruction: string; description: string; href?: string }> = {
  system: {
    index: "01", title: "I Got a System", status: "Current WIP · Godot", instruction: "Teach the host · watch the next run",
    description: "An automatic turn-based cultivation game. You shape an autonomous host through post-run commands rather than controlling every move.",
  },
  nasi: {
    index: "02", title: "Nasi Lemak Survivors", status: "Released · Google Play", instruction: "Automatic stall defence · unlimited levels",
    description: "A nasi lemak aunty satisfies incoming customers by tossing three recipes: single-target biasa, area berapi and piercing rendang.",
    href: "https://play.google.com/store/apps/details?id=com.eternalamaris.nasilemak.survivors",
  },
  infinity: {
    index: "03", title: "To Infinity and Beyond", status: "Released · Itch.io", instruction: "60 seconds · climb as high as possible",
    description: "A timed tower climber with spikes, straight shots and slow homing projectiles. Hits knock the player away; they never end the run.",
    href: "https://kevin-d-eternal.itch.io/to-infinity-and-beyond",
  },
};

function RuntimeFallback({ mode }: { mode: "nasi" | "infinity" }) {
  return <div className={`game-fallback game-fallback-${mode}`} aria-hidden="true"><span className="game-fallback-grid" /><span className="game-fallback-host" /><span className="game-fallback-orb" /><span className="game-fallback-route" /><span className="game-fallback-target" /></div>;
}

export function GameMicroDemo() {
  const [mode, setMode] = useState<GameMode>("system");
  const [started, setStarted] = useState(false);
  const [runScore, setRunScore] = useState<ArcadeScore | null>(null);
  const [scoreName, setScoreName] = useState("");
  const [scores, setScores] = useState<SavedScore[]>([]);
  const active = gameCopy[mode];

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("kevin-portfolio-arcade-scores-v1");
      if (saved) setScores(JSON.parse(saved) as SavedScore[]);
    } catch { /* private browsing */ }
  }, []);

  const selectMode = (next: GameMode) => {
    setMode(next);
    setStarted(false);
    setRunScore(null);
  };

  const saveScore = () => {
    if (!runScore) return;
    const name = scoreName.trim() || "Anonymous cultivator";
    const next = [{ ...runScore, name }, ...scores]
      .sort((a, b) => b.primary - a.primary)
      .slice(0, 8);
    setScores(next);
    try { window.localStorage.setItem("kevin-portfolio-arcade-scores-v1", JSON.stringify(next)); } catch { /* private browsing */ }
  };

  return (
    <div className="game-showcase">
      <div className="game-stage-shell">
        <div className="game-stage-topline"><span>Playable portfolio demo</span><span>{active.instruction}</span></div>
        {mode === "system" ? <SystemGameDemo /> : started ? (
          <Suspense fallback={<RuntimeFallback mode={mode} />}>
            <GameCanvas mode={mode} title={active.title} onRunEnd={setRunScore} />
          </Suspense>
        ) : (
          <div className="game-start-shell">
            <RuntimeFallback mode={mode} />
            <button className="game-start-button" type="button" onClick={() => setStarted(true)}><span>Start this run</span><small>Loads the mini-game only when asked</small></button>
          </div>
        )}

        {started && mode === "nasi" ? (
          <aside className="arcade-legend nasi-legend" aria-label="Nasi lemak weapons">
            <article><span>01</span><div><strong>Nasi lemak biasa</strong><small>Single customer damage</small></div></article>
            <article><span>02</span><div><strong>Nasi lemak berapi</strong><small>Area satisfaction damage</small></div></article>
            <article><span>03</span><div><strong>Nasi lemak rendang</strong><small>Pierces several customers</small></div></article>
            <p>Actives and matching passives level without a cap. At higher levels, aligned pairs evolve.</p>
          </aside>
        ) : null}
        {started && mode === "infinity" ? (
          <aside className="arcade-legend infinity-legend" aria-label="Tower controls and hazards">
            <article><span>← →</span><div><strong>Move</strong><small>A / D or tap the left and right zones</small></div></article>
            <article><span>↑</span><div><strong>Jump</strong><small>Space or tap the centre zone</small></div></article>
            <p>Lavender shots home slowly. Jade shots travel straight. Peach spikes and every projectile only knock you back.</p>
          </aside>
        ) : null}
      </div>

      {runScore ? (
        <section className="arcade-score-entry">
          <div><span>RUN COMPLETE</span><strong>{runScore.mode === "nasi" ? `Wave ${runScore.primary} · ${runScore.secondary}s survived` : `${runScore.primary} m · ${runScore.secondary} hits`}</strong><small>{runScore.label}</small></div>
          <div><input value={scoreName} onChange={(event) => setScoreName(event.target.value)} maxLength={20} placeholder="Player name" aria-label="Player name for high score" /><button type="button" onClick={saveScore}>Save score</button><button type="button" onClick={() => { setRunScore(null); setStarted(false); }}>Run again</button></div>
          {scores.filter((score) => score.mode === runScore.mode).length ? <ol>{scores.filter((score) => score.mode === runScore.mode).slice(0, 3).map((score, index) => <li key={`${score.name}-${index}`}><span>#{index + 1}</span><strong>{score.name}</strong><small>{score.mode === "nasi" ? `Wave ${score.primary} · ${score.secondary}s` : `${score.primary} m · ${score.secondary} hits`}</small></li>)}</ol> : null}
        </section>
      ) : null}

      <div className="game-selector" role="tablist" aria-label="Game projects">
        {(Object.keys(gameCopy) as GameMode[]).map((key) => {
          const item = gameCopy[key];
          return <button type="button" role="tab" aria-selected={mode === key} className={mode === key ? "active" : ""} onClick={() => selectMode(key)} key={key}><span>{item.index}</span><small>{item.status}</small><strong>{item.title}</strong></button>;
        })}
      </div>
      <div className="game-active-copy"><p>{active.description}</p>{active.href ? <a href={active.href} target="_blank" rel="noreferrer">Open full project ↗</a> : <span>Private development</span>}</div>
    </div>
  );
}
