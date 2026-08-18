import { Suspense, lazy, useEffect, useRef, useState } from "react";
import type { ArcadeControls, ArcadeScore, UpgradeOption } from "./GameCanvasRuntime";
import { SystemGameDemo } from "./SystemGameDemo";

type GameMode = "system" | "nasi" | "infinity";
interface SavedScore extends ArcadeScore { name: string; }
interface PendingLevel { level: number; options: UpgradeOption[]; }

const GameCanvas = lazy(() => import("./GameCanvasRuntime").then((module) => ({ default: module.GameCanvasRuntime })));

const gameCopy: Record<GameMode, { index: string; title: string; status: string; instruction: string; description: string; href?: string }> = {
  system: {
    index: "01", title: "I Got a System", status: "Current WIP · Godot", instruction: "搜 Search · 打 Hit · 跑 Run",
    description: "An automatic turn-based extraction run where speed controls action order. The host searches for keys and loot, fights or flees from monsters that chase on sight, then unlocks the floor exit.",
  },
  nasi: {
    index: "02", title: "Nasi Lemak Survivors", status: "Released · Google Play", instruction: "Auto-attack · you pick every upgrade",
    description: "A nasi lemak aunty defends her stall on her own, but every level up stops the run and hands you the choice — unlock a recipe, deepen one you have, or patch the stall.",
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
  const stageRef = useRef<HTMLDivElement>(null);
  const arcadeControls = useRef<ArcadeControls>({ applyUpgrade: () => {} });
  const [mode, setMode] = useState<GameMode>("system");
  const [started, setStarted] = useState(false);
  const [runScore, setRunScore] = useState<ArcadeScore | null>(null);
  const [pendingLevel, setPendingLevel] = useState<PendingLevel | null>(null);
  const [scoreName, setScoreName] = useState("");
  const [scores, setScores] = useState<SavedScore[]>([]);
  const active = gameCopy[mode];

  const chooseUpgrade = (id: string) => {
    arcadeControls.current.applyUpgrade(id);
    setPendingLevel(null);
  };

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("kevin-portfolio-arcade-scores-v1");
      if (saved) setScores(JSON.parse(saved) as SavedScore[]);
    } catch { /* private browsing */ }
  }, []);

  const revealStage = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        stageRef.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "start",
        });
      });
    });
  };

  const selectMode = (next: GameMode) => {
    setMode(next);
    setStarted(false);
    setRunScore(null);
    setPendingLevel(null);
    revealStage();
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
      <div className="game-stage-shell" ref={stageRef}>
        <div className="game-stage-topline"><span>{active.title}</span><span>{active.instruction}</span></div>
        {mode === "system" ? <SystemGameDemo /> : started ? (
          <Suspense fallback={<RuntimeFallback mode={mode} />}>
            <GameCanvas
              mode={mode}
              title={active.title}
              onRunEnd={setRunScore}
              onLevelUp={(level, options) => setPendingLevel({ level, options })}
              controlsRef={arcadeControls}
            />
          </Suspense>
        ) : (
          <div className="game-start-shell">
            <RuntimeFallback mode={mode} />
            <button className="game-start-button" type="button" onClick={() => { setStarted(true); revealStage(); }}><span>Start this run</span><small>Loads the mini-game only when asked</small></button>
          </div>
        )}

        {pendingLevel ? (
          <div className="upgrade-choice" role="dialog" aria-modal="true" aria-label={`Level ${pendingLevel.level} upgrade`}>
            <div className="upgrade-choice-inner">
              <p className="panel-kicker">Level {pendingLevel.level} · choose one</p>
              <div className="upgrade-options">
                {pendingLevel.options.map((option) => (
                  <button type="button" onClick={() => chooseUpgrade(option.id)} key={option.id}>
                    <strong>{option.title}</strong>
                    <small>{option.detail}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {started && mode === "nasi" ? (
        <aside className="arcade-legend nasi-legend" aria-label="Nasi lemak weapons">
          <article><span>01</span><div><strong>Nasi lemak biasa</strong><small>Starts unlocked · single customer</small></div></article>
          <article><span>02</span><div><strong>Nasi lemak berapi</strong><small>Offered on level up · area damage</small></div></article>
          <article><span>03</span><div><strong>Nasi lemak rendang</strong><small>Offered on level up · piercing</small></div></article>
          <p>The aunty serves on her own, but every level up pauses the run and you choose the upgrade — tap or click a card. Weapons and passives have no cap.</p>
        </aside>
      ) : null}
      {started && mode === "infinity" ? (
        <aside className="arcade-legend infinity-legend" aria-label="Tower controls and hazards">
          <article><span>← →</span><div><strong>Move</strong><small>A / D, or hold the left and right zones</small></div></article>
          <article><span>↑</span><div><strong>Jump</strong><small>Space, or tap the centre zone</small></div></article>
          <p>Sixty seconds to climb as high as you can. On touch the three zones are outlined along the bottom and hold works — keep a finger down to keep moving. Lavender shots home slowly, jade shots travel straight, and every hit only knocks you back.</p>
        </aside>
      ) : null}

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
      <div className="game-active-copy"><p>{active.description}</p>{active.href ? <a href={active.href} target="_blank" rel="noreferrer">Open full project ↗</a> : <span>Under construction</span>}</div>
    </div>
  );
}
