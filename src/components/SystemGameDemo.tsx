import { useEffect, useMemo, useState } from "react";

type SystemTab = "stats" | "equipment" | "inventory" | "skills";
type Behaviour = "greed" | "caution" | "battle" | "curiosity";
type Encounter = "chest" | "basic" | "elite" | "boss";
type Phase = "idle" | "running" | "review" | "dead";

interface Profile {
  hostLevel: number;
  hostExp: number;
  statPoints: number;
  atk: number;
  def: number;
  speed: number;
  systemLevel: number;
  systemPoints: number;
  lifespan: number;
  obedience: number;
  dungeon: number;
  maxDungeon: number;
  behaviours: Record<Behaviour, number>;
}

interface RunState {
  size: number;
  path: number[];
  encounters: Record<number, Encounter>;
  step: number;
  hp: number;
  maxHp: number;
  loot: number;
  log: string[];
}

interface RunResult {
  success: boolean;
  nearDeath: boolean;
  summary: string;
}

interface Score {
  name: string;
  hostLevel: number;
  systemLevel: number;
  maxDungeon: number;
}

const STORAGE_KEY = "kevin-portfolio-system-save-v1";
const SCORE_KEY = "kevin-portfolio-system-scores-v1";

const freshProfile = (): Profile => ({
  hostLevel: 1,
  hostExp: 0,
  statPoints: 3,
  atk: 5,
  def: 5,
  speed: 5,
  systemLevel: 1,
  systemPoints: 0,
  lifespan: 12,
  obedience: 100,
  dungeon: 1,
  maxDungeon: 0,
  behaviours: { greed: 0, caution: 0, battle: 0, curiosity: 0 },
});

const TABS: Array<{ id: SystemTab; icon: string; label: string }> = [
  { id: "stats", icon: "十", label: "Stats" },
  { id: "equipment", icon: "甲", label: "Equipment" },
  { id: "inventory", icon: "囊", label: "Inventory" },
  { id: "skills", icon: "诀", label: "Skills" },
];

const BEHAVIOURS: Array<{ id: Behaviour; label: string; description: string }> = [
  { id: "greed", label: "Greed", description: "Risk taken for extra loot" },
  { id: "caution", label: "Caution", description: "Retreat and resource use" },
  { id: "battle", label: "Battle drive", description: "Willingness to seek fights" },
  { id: "curiosity", label: "Curiosity", description: "Interest in hidden paths" },
];

const buildRun = (dungeon: number, def: number, behaviours: Record<Behaviour, number> = freshProfile().behaviours): RunState => {
  const size = dungeon % 2 === 0 ? 9 : 7;
  const pathLength = size === 9 ? 20 : 15;
  const path = Array.from({ length: pathLength }, (_, index) => {
    const row = Math.floor(index / size);
    const column = row % 2 === 0 ? index % size : size - 1 - (index % size);
    return row * size + column;
  });
  const encounters: Record<number, Encounter> = {};
  encounters[path[3]] = "basic";
  encounters[path[5]] = "chest";
  if (behaviours.battle >= 18) encounters[path[6]] = "basic";
  encounters[path[8]] = dungeon % 3 === 0 ? "elite" : "basic";
  encounters[path[11]] = "chest";
  if (behaviours.curiosity >= 18 && path[13]) encounters[path[13]] = "chest";
  encounters[path[path.length - 1]] = dungeon % 5 === 0 ? "boss" : "elite";
  const maxHp = 44 + def * 6;
  return { size, path, encounters, step: 0, hp: maxHp, maxHp, loot: 0, log: [`Dungeon ${dungeon} opened · host is deciding a route.`] };
};

const raiseExperience = (profile: Profile, amount: number): Profile => {
  let hostExp = profile.hostExp + amount;
  let hostLevel = profile.hostLevel;
  let statPoints = profile.statPoints;
  while (hostExp >= 100) {
    hostExp -= 100;
    hostLevel += 1;
    statPoints += 3;
  }
  return { ...profile, hostExp, hostLevel, statPoints };
};

export function SystemGameDemo() {
  const [profile, setProfile] = useState<Profile>(freshProfile);
  const [tab, setTab] = useState<SystemTab>("stats");
  const [phase, setPhase] = useState<Phase>("idle");
  const [run, setRun] = useState<RunState>(() => buildRun(1, 5));
  const [result, setResult] = useState<RunResult | null>(null);
  const [rewarded, setRewarded] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [scoreName, setScoreName] = useState("");
  const [scores, setScores] = useState<Score[]>([]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const savedScores = window.localStorage.getItem(SCORE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Profile;
        setProfile(parsed);
        setRun(buildRun(parsed.dungeon, parsed.def, parsed.behaviours));
        setResumed(true);
      }
      if (savedScores) setScores(JSON.parse(savedScores) as Score[]);
    } catch { /* A blocked cache should never block the demo. */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch { /* private browsing */ }
  }, [profile, hydrated]);

  useEffect(() => {
    if (phase !== "running") return;
    const timer = window.setInterval(() => {
      setRun((current) => {
        const nextStep = current.step + 1;
        if (nextStep >= current.path.length) return current;
        const cell = current.path[nextStep];
        const encounter = current.encounters[cell];
        let hp = current.hp;
        let loot = current.loot;
        let message = "Host advances across the formation.";
        const independent = ((profile.dungeon * 19 + nextStep * 17) % 100) >= profile.obedience;

        if (encounter === "chest") {
          const bonus = profile.behaviours.greed >= 20 ? 2 : 1;
          loot += bonus;
          message = independent ? "Host ignores the marked route and opens a sealed chest." : `Chest opened · ${bonus} item${bonus > 1 ? "s" : ""} secured.`;
        }
        if (encounter && encounter !== "chest") {
          const baseDamage = encounter === "basic" ? 9 : encounter === "elite" ? 18 : 30;
          const guard = profile.def * 0.7 + profile.behaviours.caution * 0.06;
          const dodge = ((nextStep * 23 + profile.speed * 7) % 100) < Math.min(32, profile.speed * 2);
          const quickFinish = profile.atk * 0.22 + profile.behaviours.battle * 0.035;
          const damage = dodge ? 0 : Math.max(2, Math.round(baseDamage + profile.dungeon * 1.4 - guard - quickFinish));
          hp = Math.max(0, hp - damage);
          const label = encounter === "basic" ? "Basic beast" : encounter === "elite" ? "Elite cultivator" : "Floor boss";
          const elements = ["wood", "fire", "water", "metal", "earth"];
          const styles = ["a direct strike", "a guarding counter", "a ranged technique"];
          const element = elements[(profile.dungeon + nextStep) % elements.length];
          const style = styles[(profile.dungeon * 3 + nextStep) % styles.length];
          const dropChance = encounter === "basic" ? 48 : encounter === "elite" ? 72 : 100;
          const dropped = ((profile.dungeon * 29 + nextStep * 13) % 100) < dropChance;
          message = dodge ? `${element} ${label.toLowerCase()} uses ${style} · host evades.` : `${element} ${label.toLowerCase()} defeated · ${damage} HP lost${dropped ? " · drop secured" : ""}.`;
          if (dropped) loot += encounter === "basic" ? 1 : encounter === "elite" ? 2 : 4;
        }

        const next = { ...current, step: nextStep, hp, loot, log: [...current.log.slice(-3), message] };
        if (hp <= 0) {
          setProfile((saved) => ({ ...saved, lifespan: Math.max(0, saved.lifespan - 1), obedience: Math.max(0, saved.obedience - 4) }));
          setResult({ success: false, nearDeath: true, summary: "The host fell. One lifespan was lost, but the System keeps the lesson." });
          setPhase(profile.lifespan <= 1 ? "dead" : "review");
        } else if (nextStep === current.path.length - 1) {
          const points = 2 + Math.floor(profile.dungeon / 3);
          setProfile((saved) => {
            const progressed = raiseExperience(saved, 28 + current.loot * 5);
            return { ...progressed, systemPoints: progressed.systemPoints + points, dungeon: progressed.dungeon + 1, maxDungeon: Math.max(progressed.maxDungeon, progressed.dungeon) };
          });
          setResult({ success: true, nearDeath: hp / current.maxHp < 0.25, summary: `Level cleared · ${loot} drops recovered · System gained ${points} points.` });
          setPhase("review");
        }
        return next;
      });
    }, 560);
    return () => window.clearInterval(timer);
  }, [phase, profile]);

  const currentCell = run.path[Math.min(run.step, run.path.length - 1)];
  const unlocked = useMemo(() => ["Equipment refine", "Skill insight", profile.systemLevel >= 2 ? "Elite scan" : "Lv.2: Elite scan", profile.systemLevel >= 3 ? "Boss forecast" : "Lv.3: Boss forecast"], [profile.systemLevel]);

  const startRun = () => {
    if (phase === "running" || phase === "dead") return;
    if (result?.nearDeath && !rewarded) setProfile((current) => ({ ...current, obedience: Math.max(0, current.obedience - 3) }));
    setRun(buildRun(profile.dungeon, profile.def, profile.behaviours));
    setResult(null);
    setRewarded(false);
    setReviewed(false);
    setPhase("running");
  };

  const trainHost = (choice: "less-greed" | "less-caution" | "more-battle" | "good") => {
    setProfile((current) => {
      const next = { ...current.behaviours };
      if (choice === "less-greed") { next.greed = Math.max(0, next.greed - 8); next.caution = Math.min(100, next.caution + 10); }
      if (choice === "less-caution") { next.caution = Math.max(0, next.caution - 8); next.curiosity = Math.min(100, next.curiosity + 10); }
      if (choice === "more-battle") next.battle = Math.min(100, next.battle + 12);
      if (choice === "good") Object.keys(next).forEach((key) => { next[key as Behaviour] = Math.min(100, next[key as Behaviour] + 3); });
      return { ...current, behaviours: next };
    });
    setReviewed(true);
  };

  const addStat = (stat: "atk" | "def" | "speed") => {
    if (profile.statPoints <= 0 || phase === "running") return;
    setProfile((current) => ({ ...current, [stat]: current[stat] + 1, statPoints: current.statPoints - 1 }));
  };

  const rewardHost = () => {
    if (profile.systemPoints < 2 || rewarded) return;
    setProfile((current) => ({ ...current, systemPoints: current.systemPoints - 2, obedience: Math.min(100, current.obedience + 8) }));
    setRewarded(true);
  };

  const upgradeSystem = () => {
    const cost = profile.systemLevel + 2;
    if (profile.systemPoints < cost) return;
    setProfile((current) => ({ ...current, systemPoints: current.systemPoints - cost, systemLevel: current.systemLevel + 1 }));
  };

  const recordScore = () => {
    const name = scoreName.trim() || "Wandering System";
    const next = [{ name, hostLevel: profile.hostLevel, systemLevel: profile.systemLevel, maxDungeon: profile.maxDungeon }, ...scores].slice(0, 5);
    setScores(next);
    try { window.localStorage.setItem(SCORE_KEY, JSON.stringify(next)); } catch { /* private browsing */ }
  };

  const newHost = () => {
    const fresh = freshProfile();
    setProfile(fresh);
    setRun(buildRun(fresh.dungeon, fresh.def, fresh.behaviours));
    setResult(null);
    setScoreName("");
    setPhase("idle");
    setResumed(false);
  };

  return (
    <div className="system-game" data-phase={phase}>
      <div className="system-game-topbar">
        <div><span>HOST</span><strong>Nameless Disciple · Lv.{profile.hostLevel}</strong></div>
        <div className="host-exp"><span style={{ width: `${profile.hostExp}%` }} /><small>{profile.hostExp} / 100 EXP</small></div>
        <div><span>SYSTEM</span><strong>Lv.{profile.systemLevel} · {profile.systemPoints} pts</strong></div>
        {resumed ? <small className="resume-note">Local run resumed</small> : null}
      </div>

      <div className="system-game-layout">
        <aside className="system-left-panel">
          <nav className="system-icon-tabs" aria-label="Host information">
            {TABS.map((item) => <button type="button" aria-label={item.label} aria-pressed={tab === item.id} onClick={() => setTab(item.id)} key={item.id}><strong>{item.icon}</strong><span>{item.label}</span></button>)}
          </nav>
          <div className="system-tab-content">
            {tab === "stats" ? (
              <><div className="stat-points"><span>Unspent points</span><strong>{profile.statPoints}</strong></div>{(["atk", "def", "speed"] as const).map((stat) => <div className="host-stat" key={stat}><span>{stat.toUpperCase()}</span><strong>{profile[stat]}</strong><button type="button" aria-label={`Add one ${stat} point`} disabled={profile.statPoints <= 0 || phase === "running"} onClick={() => addStat(stat)}>+</button></div>)}<div className="host-vitals"><p><span>Lifespan</span><strong>{profile.lifespan}</strong></p><p><span>Obedience</span><strong>{profile.obedience}%</strong></p></div></>
            ) : null}
            {tab === "equipment" ? (
              <div className="equipment-list">{[
                ["Head", "Cloudveil Crown", "+2 DEF", "Rare · spirit shield"], ["Body", "Plain Dao Robe", "+4 DEF", "Common"], ["Shoes", "Windstep Boots", "+2 SPD", "Uncommon · dash"], ["Accessory", "Jade Breath Ring", "+8 HP", "Rare · recovery"], ["Weapon", "Ironwood Sword", "+5 ATK", "Uncommon"],
              ].map(([slot, name, main, effect]) => <article key={slot}><span>{slot}</span><strong>{name}</strong><small>{main} · {effect}</small></article>)}</div>
            ) : null}
            {tab === "inventory" ? (
              <div className="inventory-grid">{[["Spirit stone", "×18"], ["Iron ore", "×7"], ["Spare robe", "×1"], ["Sword manual", "×1"], ["Healing pill", "×4"], ["Qi pill", "×2"]].map(([name, amount]) => <article key={name}><span>{amount}</span><strong>{name}</strong></article>)}</div>
            ) : null}
            {tab === "skills" ? (
              <div className="skill-list"><article><span>Lv.3</span><div><strong>Cloudsplitter Slash</strong><small>Single target · metal</small></div></article><article><span>Lv.2</span><div><strong>Falling Petal Step</strong><small>Dodge · movement</small></div></article><article><span>Lv.1</span><div><strong>Ember Palm</strong><small>Area attack · fire</small></div></article></div>
            ) : null}
          </div>
        </aside>

        <section className="cultivation-board-shell" aria-label={`Procedural dungeon ${profile.dungeon}`}>
          <div className="board-heading"><span>Dungeon {String(profile.dungeon).padStart(2, "0")}</span><strong>{run.size === 9 ? "Large formation" : "Small formation"}</strong></div>
          <div className="cultivation-board" style={{ gridTemplateColumns: `repeat(${run.size}, 1fr)` }}>
            {Array.from({ length: run.size * run.size }, (_, cell) => {
              const encounter = run.encounters[cell];
              const visited = run.path.slice(0, run.step + 1).includes(cell);
              return <span className={`${visited ? "visited" : ""} ${encounter ? `encounter-${encounter}` : ""}`} key={cell}>{cell === currentCell ? <b className="host-piece" aria-label="Host">人<i /></b> : encounter ? <em aria-label={encounter}>{encounter === "chest" ? "匣" : encounter === "basic" ? "兽" : encounter === "elite" ? "将" : "王"}</em> : null}</span>;
            })}
          </div>
          <div className="run-readout"><div><span>HP</span><strong>{run.hp} / {run.maxHp}</strong><i><b style={{ width: `${(run.hp / run.maxHp) * 100}%` }} /></i></div><div><span>Drop bag</span><strong>{run.loot}</strong></div></div>
          <div className="run-log" aria-live="polite">{run.log.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div>
          {phase === "idle" ? <button className="start-level" type="button" onClick={startRun}>Start level {profile.dungeon}</button> : null}
          {phase === "running" ? <div className="run-active"><span /> Host turn in progress</div> : null}
        </section>

        <aside className="host-behaviour-panel">
          <div className="behaviour-head"><span>LEARNED HOST BEHAVIOUR</span><strong>{profile.obedience === 100 ? "Blank paper becoming a pattern" : `${profile.obedience}% obedience`}</strong></div>
          <div className="behaviour-bars">{BEHAVIOURS.map((item) => <div key={item.id}><p><span>{item.label}</span><strong>{profile.behaviours[item.id]}</strong></p><i><b style={{ width: `${profile.behaviours[item.id]}%` }} /></i><small>{item.description}</small></div>)}</div>
          <div className="system-upgrade"><p><span>System unlocks</span><strong>Lv.{profile.systemLevel}</strong></p>{unlocked.map((item) => <small key={item}>{item}</small>)}<button type="button" disabled={profile.systemPoints < profile.systemLevel + 2} onClick={upgradeSystem}>Upgrade system · {profile.systemLevel + 2} pts</button></div>
        </aside>
      </div>

      {phase === "review" && result ? (
        <section className="run-review">
          <div><span>POST-RUN REVIEW</span><strong>{result.summary}</strong><small>Your command becomes part of the host’s future behaviour.</small></div>
          <div className="review-actions">
            <button type="button" disabled={reviewed} onClick={() => trainHost("less-greed")}>Too greedy</button>
            <button type="button" disabled={reviewed} onClick={() => trainHost("less-caution")}>Too cautious</button>
            <button type="button" disabled={reviewed} onClick={() => trainHost("more-battle")}>Fight more</button>
            <button type="button" disabled={reviewed} onClick={() => trainHost("good")}>Good judgment</button>
          </div>
          <div className="reward-row"><button type="button" disabled={rewarded || profile.systemPoints < 2} onClick={rewardHost}>{rewarded ? "Host rewarded" : "Reward host · 2 pts"}</button><button type="button" disabled={!reviewed} onClick={startRun}>Start next level →</button></div>
        </section>
      ) : null}

      {phase === "dead" ? (
        <section className="system-game-over">
          <span>HOST LIFESPAN ENDED</span><h3>The journey becomes a record.</h3>
          <div><input value={scoreName} onChange={(event) => setScoreName(event.target.value)} maxLength={20} placeholder="Your name" aria-label="High-score name" /><button type="button" onClick={recordScore}>Record score</button><button type="button" onClick={newHost}>Begin with a new host</button></div>
          {scores.length ? <ol>{scores.map((score, index) => <li key={`${score.name}-${index}`}><strong>{score.name}</strong><span>Host {score.hostLevel} · System {score.systemLevel} · Dungeon {score.maxDungeon}</span></li>)}</ol> : null}
        </section>
      ) : null}
    </div>
  );
}
