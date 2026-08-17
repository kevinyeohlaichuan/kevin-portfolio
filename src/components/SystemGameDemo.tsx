import { useEffect, useMemo, useState } from "react";

type SystemTab = "stats" | "equipment" | "inventory" | "skills";
type Behaviour = "greed" | "caution" | "battle" | "curiosity";
type Phase = "idle" | "running" | "review" | "dead";
type KeyKind = "bronze" | "jade";
type MonsterKind = "basic" | "elite" | "boss";
type HostAction = "search" | "hit" | "run" | "move";
type RunOutcome = "success" | "failure" | "timeout";

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

interface RoomFeature {
  type: "key" | "chest" | "sigil" | "exit";
  key?: KeyKind;
}

interface Monster {
  id: string;
  kind: MonsterKind;
  name: string;
  cell: number;
  hp: number;
  maxHp: number;
  atk: number;
  speed: number;
  nextTurn: number;
  alerted: boolean;
}

interface RunState {
  dungeon: number;
  size: number;
  hostCell: number;
  visited: number[];
  hp: number;
  maxHp: number;
  loot: number;
  turn: number;
  elapsed: number;
  timeLimit: number;
  timerWarned: boolean;
  hostNextTurn: number;
  lastAction: string;
  keys: Record<KeyKind, boolean>;
  openedChests: number[];
  sigilCollected: boolean;
  features: Record<number, RoomFeature>;
  monsters: Monster[];
  log: string[];
  outcome: RunOutcome | null;
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

interface HostDecision {
  action: HostAction;
  targetCell?: number;
  targetMonsterId?: string;
  independent: boolean;
}

const STORAGE_KEY = "kevin-portfolio-system-save-v1";
const SCORE_KEY = "kevin-portfolio-system-scores-v1";
const SIGIL_NAMES = ["Moon", "Sun", "Star", "Void", "Cloud", "Flame", "Tide", "Stone"];
const TIME_ALERT_THRESHOLD = 100;

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
  { id: "greed", label: "Greed", description: "Searches for extra keyed treasure" },
  { id: "caution", label: "Caution", description: "Runs earlier when chased" },
  { id: "battle", label: "Battle drive", description: "Chooses 打 Hit over 跑 Run" },
  { id: "curiosity", label: "Curiosity", description: "Explores optional key rooms" },
];

const floorSigil = (dungeon: number) => `${SIGIL_NAMES[(dungeon - 1) % SIGIL_NAMES.length]} Sigil · L${dungeon}`;
const rowOf = (cell: number, size: number) => Math.floor(cell / size);
const columnOf = (cell: number, size: number) => cell % size;
const cellDistance = (a: number, b: number, size: number) => Math.abs(rowOf(a, size) - rowOf(b, size)) + Math.abs(columnOf(a, size) - columnOf(b, size));

const neighbours = (cell: number, size: number) => {
  const row = rowOf(cell, size);
  const column = columnOf(cell, size);
  const cells: number[] = [];
  if (row > 0) cells.push(cell - size);
  if (column < size - 1) cells.push(cell + 1);
  if (row < size - 1) cells.push(cell + size);
  if (column > 0) cells.push(cell - 1);
  return cells;
};

const hasSight = (monsterCell: number, hostCell: number, size: number) => {
  const gap = cellDistance(monsterCell, hostCell, size);
  return gap <= 2 || (gap <= 4 && (rowOf(monsterCell, size) === rowOf(hostCell, size) || columnOf(monsterCell, size) === columnOf(hostCell, size)));
};

const featureCell = (run: RunState, predicate: (feature: RoomFeature) => boolean) => {
  const entry = Object.entries(run.features).find(([, feature]) => predicate(feature));
  return entry ? Number(entry[0]) : undefined;
};

const buildRun = (dungeon: number, def: number): RunState => {
  const size = dungeon % 2 === 0 ? 9 : 7;
  const large = size === 9;
  const cells = large
    ? { bronzeKey: 10, bronzeChest: 25, jadeKey: 36, jadeChest: 62, sigil: 70, exit: 80, basic: 21, elite: 48, guardian: 78 }
    : { bronzeKey: 8, bronzeChest: 13, jadeKey: 28, jadeChest: 40, sigil: 34, exit: 48, basic: 17, elite: 25, guardian: 45 };
  const finalKind: MonsterKind = dungeon % 5 === 0 ? "boss" : "elite";
  const maxHp = 44 + def * 6;
  const monsters: Monster[] = [
    {
      id: "stalker",
      kind: "basic",
      name: "Cave stalker",
      cell: cells.basic,
      hp: 12 + dungeon * 2,
      maxHp: 12 + dungeon * 2,
      atk: 6 + dungeon,
      speed: 3 + Math.min(3, Math.floor(dungeon / 3)),
      nextTurn: 32,
      alerted: false,
    },
    {
      id: "cultivator",
      kind: "elite",
      name: "Lost cultivator",
      cell: cells.elite,
      hp: 19 + dungeon * 3,
      maxHp: 19 + dungeon * 3,
      atk: 9 + dungeon,
      speed: 4 + Math.min(3, Math.floor(dungeon / 4)),
      nextTurn: 42,
      alerted: false,
    },
    {
      id: "guardian",
      kind: finalKind,
      name: finalKind === "boss" ? "Floor sovereign" : "Sigil guardian",
      cell: cells.guardian,
      hp: (finalKind === "boss" ? 30 : 22) + dungeon * 4,
      maxHp: (finalKind === "boss" ? 30 : 22) + dungeon * 4,
      atk: (finalKind === "boss" ? 14 : 11) + dungeon,
      speed: 4 + Math.min(4, Math.floor(dungeon / 3)),
      nextTurn: 54,
      alerted: false,
    },
  ];

  return {
    dungeon,
    size,
    hostCell: 0,
    visited: [0],
    hp: maxHp,
    maxHp,
    loot: 0,
    turn: 1,
    elapsed: 0,
    timeLimit: large ? 420 : 320,
    timerWarned: false,
    hostNextTurn: 0,
    lastAction: "Awaiting deployment",
    keys: { bronze: false, jade: false },
    openedChests: [],
    sigilCollected: false,
    features: {
      [cells.bronzeKey]: { type: "key", key: "bronze" },
      [cells.bronzeChest]: { type: "chest", key: "bronze" },
      [cells.jadeKey]: { type: "key", key: "jade" },
      [cells.jadeChest]: { type: "chest", key: "jade" },
      [cells.sigil]: { type: "sigil" },
      [cells.exit]: { type: "exit" },
    },
    monsters,
    log: [
      `Dungeon ${dungeon} opened · escape requires ${floorSigil(dungeon)}.`,
      "Automatic actions · 搜 Search · 打 Hit · 跑 Run.",
    ],
    outcome: null,
  };
};

const nearestThreatGap = (cell: number, monsters: Monster[], size: number) => {
  const living = monsters.filter((monster) => monster.hp > 0);
  return living.length ? Math.min(...living.map((monster) => cellDistance(cell, monster.cell, size))) : size * 2;
};

const moveToward = (run: RunState, targetCell: number) => {
  const occupied = new Set(run.monsters.filter((monster) => monster.hp > 0).map((monster) => monster.cell));
  return neighbours(run.hostCell, run.size)
    .filter((cell) => !occupied.has(cell))
    .sort((a, b) => {
      const route = cellDistance(a, targetCell, run.size) - cellDistance(b, targetCell, run.size);
      return route || nearestThreatGap(b, run.monsters, run.size) - nearestThreatGap(a, run.monsters, run.size);
    })[0] ?? run.hostCell;
};

const runAway = (run: RunState, targetCell: number) => {
  const occupied = new Set(run.monsters.filter((monster) => monster.hp > 0).map((monster) => monster.cell));
  let cell = run.hostCell;
  for (let step = 0; step < 2; step += 1) {
    const option = neighbours(cell, run.size)
      .filter((candidate) => !occupied.has(candidate))
      .sort((a, b) => {
        const safety = nearestThreatGap(b, run.monsters, run.size) - nearestThreatGap(a, run.monsters, run.size);
        return safety || cellDistance(a, targetCell, run.size) - cellDistance(b, targetCell, run.size);
      })[0];
    if (option === undefined) break;
    cell = option;
  }
  return cell;
};

const chooseObjective = (run: RunState, profile: Profile, independent: boolean) => {
  const hpRatio = run.hp / run.maxHp;
  const urgent = run.timeLimit - run.elapsed <= TIME_ALERT_THRESHOLD;
  const primary: KeyKind = run.dungeon % 2 === 0 ? "jade" : "bronze";
  const secondary: KeyKind = primary === "bronze" ? "jade" : "bronze";
  const wantsBoth = profile.behaviours.curiosity >= 18 || profile.behaviours.greed >= 24 || independent;
  const cautiousShortcut = profile.behaviours.caution >= 35 && hpRatio < 0.65;
  const living = run.monsters.filter((monster) => monster.hp > 0);
  const fightTarget = living
    .filter((monster) => monster.alerted || profile.behaviours.battle >= 60)
    .sort((a, b) => cellDistance(a.cell, run.hostCell, run.size) - cellDistance(b.cell, run.hostCell, run.size))[0];

  if (urgent) {
    if (!run.sigilCollected) {
      const sigil = featureCell(run, (feature) => feature.type === "sigil");
      if (sigil !== undefined) return sigil;
    }
    return featureCell(run, (feature) => feature.type === "exit") ?? run.hostCell;
  }

  if (profile.behaviours.battle >= 24 && hpRatio > 0.55 && fightTarget) return fightTarget.cell;

  const unresolvedRoute = (key: KeyKind) => {
    if (!run.keys[key]) return featureCell(run, (feature) => feature.type === "key" && feature.key === key);
    const chest = featureCell(run, (feature) => feature.type === "chest" && feature.key === key);
    return chest !== undefined && !run.openedChests.includes(chest) ? chest : undefined;
  };

  if (!cautiousShortcut) {
    const primaryTarget = unresolvedRoute(primary);
    if (primaryTarget !== undefined) return primaryTarget;
    if (wantsBoth) {
      const secondaryTarget = unresolvedRoute(secondary);
      if (secondaryTarget !== undefined) return secondaryTarget;
    }
  }

  if (!run.sigilCollected) {
    const sigil = featureCell(run, (feature) => feature.type === "sigil");
    if (sigil !== undefined) return sigil;
  }

  if (profile.behaviours.greed >= 12 && hpRatio > 0.45) {
    const secondaryTarget = unresolvedRoute(secondary);
    if (secondaryTarget !== undefined) return secondaryTarget;
  }

  return featureCell(run, (feature) => feature.type === "exit") ?? run.hostCell;
};

const chooseHostAction = (run: RunState, profile: Profile): HostDecision => {
  const living = run.monsters.filter((monster) => monster.hp > 0);
  const adjacent = living
    .filter((monster) => cellDistance(monster.cell, run.hostCell, run.size) === 1)
    .sort((a, b) => a.hp - b.hp)[0];
  const independent = ((run.dungeon * 19 + run.turn * 17) % 100) >= profile.obedience;
  const hpRatio = run.hp / run.maxHp;
  const urgent = run.timeLimit - run.elapsed <= TIME_ALERT_THRESHOLD;
  const retreatAt = Math.min(0.78, Math.max(0.2, 0.3 + profile.behaviours.caution * 0.004 - profile.behaviours.battle * 0.002));

  if (urgent && nearestThreatGap(run.hostCell, living, run.size) <= 3) {
    return { action: "run", independent };
  }
  if (urgent) {
    const urgentFeature = run.features[run.hostCell];
    if ((urgentFeature?.type === "sigil" && !run.sigilCollected) || (urgentFeature?.type === "exit" && run.sigilCollected)) {
      return { action: "search", independent };
    }
    return { action: "move", targetCell: chooseObjective(run, profile, independent), independent };
  }

  if (adjacent) {
    const shouldRun = independent
      ? profile.behaviours.caution >= profile.behaviours.battle
      : hpRatio <= retreatAt || (adjacent.hp > profile.atk * 3 && profile.behaviours.caution > profile.behaviours.battle + 15);
    return shouldRun
      ? { action: "run", independent }
      : { action: "hit", targetMonsterId: adjacent.id, independent };
  }

  if (nearestThreatGap(run.hostCell, living, run.size) <= 2 && hpRatio < retreatAt + 0.12) {
    return { action: "run", independent };
  }

  const feature = run.features[run.hostCell];
  if (feature?.type === "key" && feature.key && !run.keys[feature.key]) return { action: "search", independent };
  if (feature?.type === "sigil" && !run.sigilCollected) return { action: "search", independent };
  if (feature?.type === "exit" && run.sigilCollected) return { action: "search", independent };
  if (feature?.type === "chest" && feature.key && !run.openedChests.includes(run.hostCell) && run.keys[feature.key]) {
    const primary: KeyKind = run.dungeon % 2 === 0 ? "jade" : "bronze";
    if (feature.key === primary || profile.behaviours.greed + profile.behaviours.curiosity >= 18 || independent) {
      return { action: "search", independent };
    }
  }

  return { action: "move", targetCell: chooseObjective(run, profile, independent), independent };
};

const appendLog = (run: RunState, messages: string[]) => {
  run.log = [...run.log, ...messages].slice(-4);
};

const advanceRun = (current: RunState, profile: Profile): RunState => {
  if (current.outcome) return current;
  const next: RunState = {
    ...current,
    visited: [...current.visited],
    keys: { ...current.keys },
    openedChests: [...current.openedChests],
    monsters: current.monsters.map((monster) => ({ ...monster })),
    log: [...current.log],
  };
  const messages: string[] = [];
  const actingMonster = next.monsters
    .filter((monster) => monster.hp > 0)
    .sort((a, b) => a.nextTurn - b.nextTurn)[0];
  const nextEventTime = Math.min(actingMonster?.nextTurn ?? Number.POSITIVE_INFINITY, next.hostNextTurn);

  if (nextEventTime >= next.timeLimit) {
    next.elapsed = next.timeLimit;
    next.lastAction = "Floor time expired";
    next.outcome = "timeout";
    appendLog(next, ["TIME EXPIRED · the floor seals and the host dies."]);
    return next;
  }

  if (!next.timerWarned && next.timeLimit - nextEventTime <= TIME_ALERT_THRESHOLD) {
    next.timerWarned = true;
    messages.push(`TIME ALERT · ${Math.ceil(next.timeLimit - nextEventTime)} left · host prioritises 跑 Run and the exit.`);
  }

  if (actingMonster && actingMonster.nextTurn < next.hostNextTurn) {
    next.elapsed = actingMonster.nextTurn;
    next.turn += 1;
    next.lastAction = `Enemy turn · ${actingMonster.name}`;
    actingMonster.nextTurn += 100 / actingMonster.speed;
    actingMonster.alerted = actingMonster.alerted || hasSight(actingMonster.cell, next.hostCell, next.size);

    if (actingMonster.alerted) {
      if (cellDistance(actingMonster.cell, next.hostCell, next.size) === 1) {
        const guard = profile.def * 0.55 + profile.behaviours.caution * 0.025;
        const damage = Math.max(1, Math.round(actingMonster.atk - guard));
        next.hp = Math.max(0, next.hp - damage);
        messages.push(`${actingMonster.name} attacks on SPD ${actingMonster.speed} · ${damage} HP lost.`);
      } else {
        const occupied = new Set(next.monsters.filter((monster) => monster.hp > 0 && monster.id !== actingMonster.id).map((monster) => monster.cell));
        const step = neighbours(actingMonster.cell, next.size)
          .filter((cell) => cell !== next.hostCell && !occupied.has(cell))
          .sort((a, b) => cellDistance(a, next.hostCell, next.size) - cellDistance(b, next.hostCell, next.size))[0];
        if (step !== undefined) actingMonster.cell = step;
        messages.push(`${actingMonster.name} has line of sight · chasing.`);
      }
    }

    if (next.hp <= 0) {
      next.outcome = "failure";
      messages.push("The host fell before finding the sealed exit.");
    }
    appendLog(next, messages);
    return next;
  }

  next.elapsed = next.hostNextTurn;
  next.turn += 1;
  const decision = chooseHostAction(next, profile);
  const objective = decision.targetCell ?? chooseObjective(next, profile, decision.independent);
  let actionCost = 100;

  if (decision.action === "search") {
    next.lastAction = "搜 Search";
    const feature = next.features[next.hostCell];
    if (feature?.type === "key" && feature.key) {
      next.keys[feature.key] = true;
      messages.push(`搜 Search · ${feature.key} key secured.`);
    } else if (feature?.type === "chest" && feature.key) {
      if (!next.keys[feature.key]) {
        messages.push(`搜 Search · locked ${feature.key} chest needs its matching key.`);
      } else {
        const bonus = 1 + (profile.behaviours.greed >= 20 ? 1 : 0);
        next.openedChests.push(next.hostCell);
        next.loot += bonus;
        messages.push(`搜 Search · ${feature.key} key opens the locked chest · ${bonus} drop${bonus > 1 ? "s" : ""}.`);
      }
    } else if (feature?.type === "sigil") {
      next.sigilCollected = true;
      messages.push(`搜 Search · ${floorSigil(next.dungeon)} secured.`);
    } else if (feature?.type === "exit") {
      if (next.sigilCollected) {
        next.outcome = "success";
        messages.push(`搜 Search · ${floorSigil(next.dungeon)} opens the level exit.`);
      } else {
        messages.push(`搜 Search · exit sealed; ${floorSigil(next.dungeon)} required.`);
      }
    } else {
      messages.push("搜 Search · room clear.");
    }
  }

  if (decision.action === "hit") {
    next.lastAction = "打 Hit";
    actionCost = 90;
    const target = next.monsters.find((monster) => monster.id === decision.targetMonsterId && monster.hp > 0);
    if (!target) {
      messages.push("打 Hit · no monster in reach.");
    } else {
      const damage = profile.atk + Math.floor(profile.behaviours.battle / 18);
      target.hp = Math.max(0, target.hp - damage);
      target.alerted = true;
      messages.push(`打 Hit · ${target.name} takes ${damage}.`);
      if (target.hp === 0) {
        const drop = target.kind === "basic" ? 1 : target.kind === "elite" ? 2 : 4;
        next.loot += drop;
        messages.push(`${target.name} defeated · ${drop} drop${drop > 1 ? "s" : ""} secured.`);
      }
    }
  }

  if (decision.action === "run") {
    next.lastAction = "跑 Run";
    actionCost = 70;
    next.hostCell = runAway(next, objective);
    messages.push(`跑 Run · host breaks line to room ${rowOf(next.hostCell, next.size) + 1}-${columnOf(next.hostCell, next.size) + 1}.`);
  }

  if (decision.action === "move") {
    next.lastAction = decision.independent ? "Route override" : "Route advance";
    next.hostCell = moveToward(next, objective);
    messages.push(`${decision.independent ? "Low obedience · host overrides the learned route" : "Host advances"} to room ${rowOf(next.hostCell, next.size) + 1}-${columnOf(next.hostCell, next.size) + 1}.`);
  }

  if (!next.visited.includes(next.hostCell)) next.visited.push(next.hostCell);
  next.hostNextTurn += actionCost / Math.max(1, profile.speed);
  next.monsters.forEach((monster) => {
    if (monster.hp > 0 && !monster.alerted && hasSight(monster.cell, next.hostCell, next.size)) {
      monster.alerted = true;
      messages.push(`${monster.name} sees the host · chase begins.`);
    }
  });
  appendLog(next, messages);
  return next;
};

const featureResolved = (run: RunState, cell: number, feature: RoomFeature) => {
  if (feature.type === "key" && feature.key) return run.keys[feature.key];
  if (feature.type === "chest") return run.openedChests.includes(cell);
  if (feature.type === "sigil") return run.sigilCollected;
  return false;
};

const featureIcon = (feature: RoomFeature) => {
  if (feature.type === "chest") return "匣";
  if (feature.type === "sigil") return "印";
  if (feature.type === "exit") return "門";
  return feature.key === "bronze" ? "铜" : "翠";
};

const featureLabel = (feature: RoomFeature, dungeon: number) => {
  if (feature.type === "sigil") return floorSigil(dungeon);
  if (feature.type === "exit") return `Level ${dungeon} sealed exit`;
  return `${feature.key} ${feature.type}`;
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
        const base = freshProfile();
        const parsed = JSON.parse(saved) as Partial<Profile>;
        const restored: Profile = {
          ...base,
          ...parsed,
          behaviours: { ...base.behaviours, ...(parsed.behaviours ?? {}) },
        };
        setProfile(restored);
        setRun(buildRun(restored.dungeon, restored.def));
        setResumed(true);
      }
      if (savedScores) {
        const parsedScores = JSON.parse(savedScores) as Score[];
        if (Array.isArray(parsedScores)) setScores(parsedScores);
      }
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
      setRun((current) => advanceRun(current, profile));
    }, 480);
    return () => window.clearInterval(timer);
  }, [phase, profile]);

  useEffect(() => {
    if (phase !== "running" || !run.outcome) return;
    if (run.outcome === "success") {
      const points = 2 + Math.floor(run.dungeon / 3);
      setProfile((current) => {
        const progressed = raiseExperience(current, 28 + run.loot * 5);
        return {
          ...progressed,
          systemPoints: progressed.systemPoints + points,
          dungeon: run.dungeon + 1,
          maxDungeon: Math.max(progressed.maxDungeon, run.dungeon),
        };
      });
      setResult({
        success: true,
        nearDeath: run.hp / run.maxHp < 0.25,
        summary: `Level escaped · ${run.loot} drops recovered · System gained ${points} points.`,
      });
      setPhase("review");
      return;
    }

    const lifespan = Math.max(0, profile.lifespan - 1);
    setProfile((current) => ({
      ...current,
      lifespan,
      obedience: Math.max(0, current.obedience - 4),
    }));
    setResult({
      success: false,
      nearDeath: true,
      summary: run.outcome === "timeout"
        ? "Floor time expired. The host tried to escape, but one lifespan was lost."
        : "The host fell. One lifespan was lost, but the System keeps the lesson.",
    });
    setPhase(lifespan === 0 ? "dead" : "review");
  }, [phase, profile.lifespan, run.dungeon, run.hp, run.loot, run.maxHp, run.outcome]);

  const unlocked = useMemo(
    () => [
      "Equipment refine",
      "Skill insight",
      profile.systemLevel >= 2 ? "Elite scan" : "Lv.2: Elite scan",
      profile.systemLevel >= 3 ? "Boss forecast" : "Lv.3: Boss forecast",
    ],
    [profile.systemLevel],
  );
  const timeLeft = Math.max(0, Math.ceil(run.timeLimit - run.elapsed));

  const startRun = () => {
    if (phase === "running" || phase === "dead") return;
    if (result?.nearDeath && !rewarded) {
      setProfile((current) => ({ ...current, obedience: Math.max(0, current.obedience - 3) }));
    }
    setRun(buildRun(profile.dungeon, profile.def));
    setResult(null);
    setRewarded(false);
    setReviewed(false);
    setPhase("running");
  };

  const trainHost = (choice: "less-greed" | "less-caution" | "more-battle" | "good") => {
    setProfile((current) => {
      const next = { ...current.behaviours };
      if (choice === "less-greed") {
        next.greed = Math.max(0, next.greed - 8);
        next.caution = Math.min(100, next.caution + 10);
      }
      if (choice === "less-caution") {
        next.caution = Math.max(0, next.caution - 8);
        next.curiosity = Math.min(100, next.curiosity + 10);
      }
      if (choice === "more-battle") next.battle = Math.min(100, next.battle + 12);
      if (choice === "good") {
        (Object.keys(next) as Behaviour[]).forEach((key) => {
          next[key] = Math.min(100, next[key] + 3);
        });
      }
      return { ...current, behaviours: next };
    });
    setReviewed(true);
  };

  const addStat = (stat: "atk" | "def" | "speed") => {
    if (profile.statPoints <= 0 || phase === "running") return;
    setProfile((current) => ({
      ...current,
      [stat]: current[stat] + 1,
      statPoints: current.statPoints - 1,
    }));
  };

  const rewardHost = () => {
    if (profile.systemPoints < 2 || rewarded) return;
    setProfile((current) => ({
      ...current,
      systemPoints: current.systemPoints - 2,
      obedience: Math.min(100, current.obedience + 8),
    }));
    setRewarded(true);
  };

  const upgradeSystem = () => {
    const cost = profile.systemLevel + 2;
    if (profile.systemPoints < cost) return;
    setProfile((current) => ({
      ...current,
      systemPoints: current.systemPoints - cost,
      systemLevel: current.systemLevel + 1,
    }));
  };

  const recordScore = () => {
    const name = scoreName.trim() || "Wandering System";
    const next = [
      { name, hostLevel: profile.hostLevel, systemLevel: profile.systemLevel, maxDungeon: profile.maxDungeon },
      ...scores,
    ]
      .sort((a, b) => b.maxDungeon - a.maxDungeon || b.systemLevel - a.systemLevel || b.hostLevel - a.hostLevel)
      .slice(0, 5);
    setScores(next);
    try { window.localStorage.setItem(SCORE_KEY, JSON.stringify(next)); } catch { /* private browsing */ }
  };

  const newHost = () => {
    const fresh = freshProfile();
    setProfile(fresh);
    setRun(buildRun(fresh.dungeon, fresh.def));
    setResult(null);
    setRewarded(false);
    setReviewed(false);
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
            {TABS.map((item) => (
              <button type="button" aria-label={item.label} aria-pressed={tab === item.id} onClick={() => setTab(item.id)} key={item.id}>
                <strong>{item.icon}</strong><span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="system-tab-content">
            {tab === "stats" ? (
              <>
                <div className="stat-points"><span>Unspent points</span><strong>{profile.statPoints}</strong></div>
                {(["atk", "def", "speed"] as const).map((stat) => (
                  <div className="host-stat" key={stat}>
                    <span>{stat.toUpperCase()}</span><strong>{profile[stat]}</strong>
                    <button type="button" aria-label={`Add one ${stat} point`} disabled={profile.statPoints <= 0 || phase === "running"} onClick={() => addStat(stat)}>+</button>
                  </div>
                ))}
                <div className="host-vitals">
                  <p><span>Lifespan</span><strong>{profile.lifespan}</strong></p>
                  <p><span>Obedience</span><strong>{profile.obedience}%</strong></p>
                </div>
              </>
            ) : null}
            {tab === "equipment" ? (
              <div className="equipment-list">
                {[
                  ["Head", "Cloudveil Crown", "+2 DEF", "Rare · spirit shield"],
                  ["Body", "Plain Dao Robe", "+4 DEF", "Common"],
                  ["Shoes", "Windstep Boots", "+2 SPD", "Uncommon · dash"],
                  ["Accessory", "Jade Breath Ring", "+8 HP", "Rare · recovery"],
                  ["Weapon", "Ironwood Sword", "+5 ATK", "Uncommon"],
                ].map(([slot, name, main, effect]) => (
                  <article key={slot}><span>{slot}</span><strong>{name}</strong><small>{main} · {effect}</small></article>
                ))}
              </div>
            ) : null}
            {tab === "inventory" ? (
              <div className="inventory-grid">
                {[
                  ["Spirit stone", "×18"],
                  ["Iron ore", "×7"],
                  ["Spare robe", "×1"],
                  ["Sword manual", "×1"],
                  ["Healing pill", "×4"],
                  ["Qi pill", "×2"],
                ].map(([name, amount]) => <article key={name}><span>{amount}</span><strong>{name}</strong></article>)}
              </div>
            ) : null}
            {tab === "skills" ? (
              <div className="skill-list">
                <article><span>Lv.3</span><div><strong>Cloudsplitter Slash</strong><small>Single target · metal</small></div></article>
                <article><span>Lv.2</span><div><strong>Falling Petal Step</strong><small>Dodge · movement</small></div></article>
                <article><span>Lv.1</span><div><strong>Ember Palm</strong><small>Area attack · fire</small></div></article>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="cultivation-board-shell" aria-label={`Autonomous extraction dungeon ${run.dungeon}`}>
          <div className="board-heading">
            <span>Dungeon {String(run.dungeon).padStart(2, "0")}</span>
            <strong>{run.size === 9 ? "Large" : "Small"} formation · {timeLeft} time · 搜 Search · 打 Hit · 跑 Run</strong>
          </div>
          <div className="cultivation-board" style={{ gridTemplateColumns: `repeat(${run.size}, 1fr)` }}>
            {Array.from({ length: run.size * run.size }, (_, cell) => {
              const feature = run.features[cell];
              const resolved = feature ? featureResolved(run, cell, feature) : false;
              const monster = run.monsters.find((candidate) => candidate.hp > 0 && candidate.cell === cell);
              const visited = run.visited.includes(cell);
              const encounterClass = monster
                ? `encounter-${monster.kind}`
                : feature && !resolved
                  ? feature.type === "key" || feature.type === "chest" ? "encounter-chest" : "encounter-elite"
                  : "";
              return (
                <span className={`${visited ? "visited" : ""} ${encounterClass}`} key={cell}>
                  {cell === run.hostCell ? <b className="host-piece" aria-label="Host">人<i /></b> : null}
                  {cell !== run.hostCell && monster ? (
                    <em aria-label={`${monster.name}, ${monster.hp} health`}>{monster.kind === "basic" ? "兽" : monster.kind === "elite" ? "将" : "王"}</em>
                  ) : null}
                  {cell !== run.hostCell && !monster && feature && !resolved ? (
                    <em aria-label={featureLabel(feature, run.dungeon)}>{featureIcon(feature)}</em>
                  ) : null}
                </span>
              );
            })}
          </div>
          <div className="run-readout">
            <div><span>HP</span><strong>{run.hp} / {run.maxHp}</strong><i><b style={{ width: `${(run.hp / run.maxHp) * 100}%` }} /></i></div>
            <div><span>Drops / turn</span><strong>{run.loot} · T{run.turn}</strong></div>
            <div className={timeLeft <= TIME_ALERT_THRESHOLD ? "time-alert" : ""}><span>Floor time</span><strong>{timeLeft}</strong></div>
          </div>
          <div className="run-log" aria-live="polite">
            {run.log.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
          </div>
          {phase === "idle" ? <button className="start-level" type="button" onClick={startRun}>Start level {profile.dungeon} · {run.timeLimit} time</button> : null}
          {phase === "running" ? (
            <div className="run-active">
              <span /> Automatic · {run.lastAction} · {timeLeft} time left · 搜 Search · 打 Hit · 跑 Run
            </div>
          ) : null}
        </section>

        <aside className="host-behaviour-panel">
          <div className="behaviour-head">
            <span>LEARNED HOST BEHAVIOUR</span>
            <strong>{profile.obedience === 100 ? "Blank paper becoming a pattern" : `${profile.obedience}% obedience`}</strong>
          </div>
          <div className="behaviour-bars">
            {BEHAVIOURS.map((item) => (
              <div key={item.id}>
                <p><span>{item.label}</span><strong>{profile.behaviours[item.id]}</strong></p>
                <i><b style={{ width: `${profile.behaviours[item.id]}%` }} /></i>
                <small>{item.description}</small>
              </div>
            ))}
          </div>
          <div className="system-upgrade">
            <p><span>System unlocks</span><strong>Lv.{profile.systemLevel}</strong></p>
            {unlocked.map((item) => <small key={item}>{item}</small>)}
            <button type="button" disabled={profile.systemPoints < profile.systemLevel + 2} onClick={upgradeSystem}>
              Upgrade system · {profile.systemLevel + 2} pts
            </button>
          </div>
        </aside>
      </div>

      {phase === "review" && result ? (
        <section className="run-review">
          <div>
            <span>POST-RUN REVIEW</span><strong>{result.summary}</strong>
            <small>Your command changes future autonomous Search / Hit / Run decisions.</small>
          </div>
          <div className="review-actions">
            <button type="button" disabled={reviewed} onClick={() => trainHost("less-greed")}>Too greedy</button>
            <button type="button" disabled={reviewed} onClick={() => trainHost("less-caution")}>Too cautious</button>
            <button type="button" disabled={reviewed} onClick={() => trainHost("more-battle")}>Fight more</button>
            <button type="button" disabled={reviewed} onClick={() => trainHost("good")}>Good judgment</button>
          </div>
          <div className="reward-row">
            <button type="button" disabled={rewarded || profile.systemPoints < 2} onClick={rewardHost}>
              {rewarded ? "Host rewarded" : "Reward host · 2 pts"}
            </button>
            <button type="button" disabled={!reviewed} onClick={startRun}>
              {result.success ? "Start next level →" : "Retry level →"}
            </button>
          </div>
        </section>
      ) : null}

      {phase === "dead" ? (
        <section className="system-game-over">
          <span>HOST LIFESPAN ENDED</span><h3>The journey becomes a record.</h3>
          <div>
            <input value={scoreName} onChange={(event) => setScoreName(event.target.value)} maxLength={20} placeholder="Your name" aria-label="High-score name" />
            <button type="button" onClick={recordScore}>Record score</button>
            <button type="button" onClick={newHost}>Begin with a new host</button>
          </div>
          {scores.length ? (
            <ol>
              {scores.map((score, index) => (
                <li key={`${score.name}-${index}`}>
                  <strong>{score.name}</strong>
                  <span>Host {score.hostLevel} · System {score.systemLevel} · Dungeon {score.maxDungeon}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
