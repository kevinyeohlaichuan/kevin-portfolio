import { useEffect, useMemo, useState } from "react";

type SystemTab = "stats" | "equipment" | "inventory" | "skills";
type Behaviour = "greed" | "caution" | "battle" | "curiosity";
type Phase = "idle" | "running" | "review" | "dead";
type KeyKind = "bronze" | "jade";
type MonsterKind = "basic" | "elite" | "boss";
type HostAction = "search" | "hit" | "run" | "move";
type RunOutcome = "success" | "failure" | "timeout";

type EquipSlot = "weapon" | "armour" | "talisman";
type PillKind = "hp" | "exp" | "stat";

interface Equipment {
  id: string;
  slot: EquipSlot;
  name: string;
  tier: number;
  atk: number;
  def: number;
  speed: number;
  value: number;
}

interface Skill {
  id: string;
  uses: number;
}

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
  equipped: Record<EquipSlot, Equipment | null>;
  skills: Skill[];
  pills: Record<PillKind, number>;
  stones: number;
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
  seed: number;
  hostCell: number;
  visited: number[];
  hp: number;
  maxHp: number;
  loot: number;
  // The host's working sheet for this run. Merged back into the profile when the
  // run settles, so the autonomous decisions stay a pure function of run state.
  hostLevel: number;
  hostExp: number;
  statPointsGained: number;
  kills: number;
  equipped: Record<EquipSlot, Equipment | null>;
  skills: Skill[];
  pills: Record<PillKind, number>;
  pillsUsed: Record<PillKind, number>;
  learned: string[];
  scrapped: Equipment[];
  found: string[];
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
  ledger: Settlement["ledger"];
  closing: number;
  kills: number;
  learned: string[];
  pillsUsed: Record<PillKind, number>;
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

// ── Loot, skills and equipment ───────────────────────────────────────────────
// The host acts alone: it learns any book it finds, wears whatever scores higher,
// swallows a pill when the situation calls for it, and settles the accounts after
// the run. The player never picks an item — they only shape the behaviour.

const EQUIP_SLOTS: EquipSlot[] = ["weapon", "armour", "talisman"];
const EQUIP_NAMES: Record<EquipSlot, string[]> = {
  weapon: ["Ironwood Sword", "Cloudsplitter Blade", "Nine-Ring Sabre", "Frostvein Spear", "Thunderfall Dao"],
  armour: ["Plain Dao Robe", "Cloudveil Vest", "Stonehide Mail", "Moonsilk Robe", "Starforge Plate"],
  talisman: ["Jade Breath Ring", "Windstep Charm", "Ember Seal", "Tideheart Pendant", "Hollow Bell"],
};
const SLOT_LABELS: Record<EquipSlot, string> = { weapon: "Weapon", armour: "Armour", talisman: "Talisman" };

const SKILL_LIBRARY: Array<{ id: string; name: string; trigger: HostAction; detail: string }> = [
  { id: "rend", name: "破 Cloudsplitter Rend", trigger: "hit", detail: "Adds damage on every 打 Hit" },
  { id: "evade", name: "遁 Falling Petal Step", trigger: "run", detail: "Softens blows while 跑 Run is active" },
  { id: "perceive", name: "察 Spirit Perception", trigger: "search", detail: "Recovers more from every 搜 Search" },
];

const PILL_LABELS: Record<PillKind, { name: string; detail: string }> = {
  hp: { name: "Blood-return pill", detail: "Swallowed below 35% HP" },
  exp: { name: "Qi-gathering pill", detail: "Swallowed on the way out" },
  stat: { name: "Marrow-forging pill", detail: "Permanent stat point" },
};
const PILL_VALUE: Record<PillKind, number> = { hp: 12, exp: 20, stat: 34 };
const PILL_STOCK_TARGET = 3;

// Levels come from mobs, so the first few have to land inside a single floor.
const expForLevel = (level: number) => 60 + (level - 1) * 40;

// Skills level from use, not from spending. Level 2 at 8 uses, 3 at 24, and so on.
const skillLevel = (uses: number) => 1 + Math.floor(Math.sqrt(uses / 8));
const usesForNextLevel = (uses: number) => 8 * (skillLevel(uses)) ** 2;
const skillMeta = (id: string) => SKILL_LIBRARY.find((entry) => entry.id === id) ?? SKILL_LIBRARY[0];
const equipmentScore = (item: Equipment | null) => (item ? item.atk * 2 + item.def * 1.6 + item.speed * 1.8 : 0);

// Mulberry32. Keeps drops random but replayable from the run's own seed, so
// advanceRun stays pure and a run can be reproduced exactly.
const roll = (seed: number) => {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const makeEquipment = (slot: EquipSlot, dungeon: number, draw: number, sequence: number): Equipment => {
  const tier = Math.min(EQUIP_NAMES[slot].length, 1 + Math.floor(dungeon / 3) + (draw > 0.82 ? 1 : 0));
  const power = tier + Math.floor(dungeon / 2);
  return {
    id: `${slot}-${dungeon}-${sequence}`,
    slot,
    name: EQUIP_NAMES[slot][tier - 1],
    tier,
    atk: slot === "weapon" ? 2 + power : 0,
    def: slot === "armour" ? 2 + power : 0,
    speed: slot === "talisman" ? 1 + Math.ceil(power / 2) : 0,
    value: 14 + tier * 9,
  };
};

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
  equipped: { weapon: null, armour: null, talisman: null },
  skills: [],
  pills: { hp: 2, exp: 0, stat: 0 },
  stones: 30,
});

const equippedBonus = (equipped: Record<EquipSlot, Equipment | null>) =>
  EQUIP_SLOTS.reduce(
    (total, slot) => {
      const item = equipped[slot];
      if (item) { total.atk += item.atk; total.def += item.def; total.speed += item.speed; }
      return total;
    },
    { atk: 0, def: 0, speed: 0 },
  );

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

const buildRun = (profile: Profile): RunState => {
  const dungeon = profile.dungeon;
  const def = profile.def + equippedBonus(profile.equipped).def;
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
    seed: dungeon * 7919 + profile.hostLevel * 131 + profile.maxDungeon * 17,
    hostCell: 0,
    visited: [0],
    hp: maxHp,
    maxHp,
    loot: 0,
    hostLevel: profile.hostLevel,
    hostExp: profile.hostExp,
    statPointsGained: 0,
    kills: 0,
    equipped: { ...profile.equipped },
    skills: profile.skills.map((skill) => ({ ...skill })),
    pills: { ...profile.pills },
    pillsUsed: { hp: 0, exp: 0, stat: 0 },
    learned: [],
    scrapped: [],
    found: [],
    turn: 1,
    elapsed: 0,
    // At SPD 5 an action costs 20 time, so this is the action budget. The shortest
    // key-chest-sigil-exit route is ~16 actions: leave enough slack to fight, run
    // and detour, but not so much that the door timer stops mattering.
    timeLimit: large ? 660 : 500,
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

  // Standing on the way out beats every other instinct. Checked before the
  // threat response, or the host flees off the open door and dies on the timer.
  const standingOn = run.features[run.hostCell];
  if ((standingOn?.type === "exit" && run.sigilCollected) || (standingOn?.type === "sigil" && !run.sigilCollected)) {
    return { action: "search", independent };
  }

  if (urgent && nearestThreatGap(run.hostCell, living, run.size) <= 3) {
    return { action: "run", independent };
  }
  if (urgent) {
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

const draw = (run: RunState) => {
  run.seed += 1;
  return roll(run.seed);
};

// Every kill feeds the host directly, so levels come from beating mobs rather
// than from surviving to the exit.
const gainExperience = (run: RunState, amount: number, messages: string[]) => {
  run.hostExp += amount;
  while (run.hostExp >= expForLevel(run.hostLevel)) {
    run.hostExp -= expForLevel(run.hostLevel);
    run.hostLevel += 1;
    run.statPointsGained += 3;
    run.hp = Math.min(run.maxHp, run.hp + 12);
    messages.push(`LEVEL UP · host reaches Lv.${run.hostLevel} · +3 stat points.`);
  }
};

const useSkill = (run: RunState, trigger: HostAction) => {
  const entry = run.skills.find((skill) => skillMeta(skill.id).trigger === trigger);
  if (!entry) return 0;
  const before = skillLevel(entry.uses);
  entry.uses += 1;
  const after = skillLevel(entry.uses);
  return after > before ? after : 0;
};

const skillPower = (run: RunState, trigger: HostAction) => {
  const entry = run.skills.find((skill) => skillMeta(skill.id).trigger === trigger);
  return entry ? skillLevel(entry.uses) : 0;
};

// The host wears whatever scores higher and keeps the old piece to sell.
const considerEquipment = (run: RunState, item: Equipment, messages: string[]) => {
  const current = run.equipped[item.slot];
  if (equipmentScore(item) <= equipmentScore(current)) {
    run.scrapped.push(item);
    messages.push(`Kept for sale · ${item.name} is weaker than the equipped ${SLOT_LABELS[item.slot].toLowerCase()}.`);
    return;
  }
  if (current) run.scrapped.push(current);
  run.equipped[item.slot] = item;
  messages.push(`Auto-equipped · ${item.name}${current ? ` replaces ${current.name}` : ""}.`);
};

const rollDrop = (run: RunState, richness: number, messages: string[]) => {
  // A host with no manual at all gets one from its first drop, so the auto-learn
  // behaviour is visible rather than waiting on the dice.
  const pick = run.skills.length === 0 ? 0.7 : draw(run);
  if (pick < 0.34) {
    const slot = EQUIP_SLOTS[Math.floor(draw(run) * EQUIP_SLOTS.length) % EQUIP_SLOTS.length];
    const item = makeEquipment(slot, run.dungeon, draw(run), run.found.length);
    run.found.push(item.name);
    considerEquipment(run, item, messages);
    return;
  }
  if (pick < 0.62) {
    const kind: PillKind = draw(run) < 0.6 ? "hp" : draw(run) < 0.65 ? "stat" : "exp";
    run.pills[kind] += 1;
    run.found.push(PILL_LABELS[kind].name);
    messages.push(`Found · ${PILL_LABELS[kind].name} (${run.pills[kind]} carried).`);
    return;
  }
  if (pick < 0.78) {
    const unknown = SKILL_LIBRARY.filter((entry) => !run.skills.some((skill) => skill.id === entry.id));
    if (unknown.length) {
      const book = unknown[Math.floor(draw(run) * unknown.length) % unknown.length];
      run.skills.push({ id: book.id, uses: 0 });
      run.learned.push(book.id);
      run.found.push(`${book.name} manual`);
      messages.push(`Auto-learned · ${book.name} read on the spot.`);
      return;
    }
    const stones = 18 + run.dungeon * 3;
    run.found.push("Duplicate manual");
    run.loot += 1;
    messages.push(`Duplicate manual · kept to sell for roughly ${stones} stones.`);
    return;
  }
  run.loot += richness;
  run.found.push(`${richness} spirit stone cache`);
  messages.push(`Found · spirit stone cache ×${richness}.`);
};

// Pills are swallowed when the situation calls for it, never on a schedule.
const considerPills = (run: RunState, messages: string[]) => {
  if (run.hp / run.maxHp < 0.35 && run.pills.hp > 0) {
    const heal = Math.round(run.maxHp * 0.4);
    run.pills.hp -= 1;
    run.pillsUsed.hp += 1;
    run.hp = Math.min(run.maxHp, run.hp + heal);
    messages.push(`Pill · blood-return swallowed at ${Math.round((run.hp / run.maxHp) * 100)}% · +${heal} HP.`);
  }
  if (run.pills.stat > 0) {
    run.pills.stat -= 1;
    run.pillsUsed.stat += 1;
    run.statPointsGained += 1;
    messages.push("Pill · marrow-forging swallowed · +1 stat point.");
  }
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
    equipped: { ...current.equipped },
    skills: current.skills.map((skill) => ({ ...skill })),
    pills: { ...current.pills },
    pillsUsed: { ...current.pillsUsed },
    learned: [...current.learned],
    scrapped: [...current.scrapped],
    found: [...current.found],
  };
  const messages: string[] = [];
  const gear = equippedBonus(next.equipped);
  const power = { atk: profile.atk + gear.atk, def: profile.def + gear.def, speed: profile.speed + gear.speed };
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
        const guard = power.def * 0.55 + profile.behaviours.caution * 0.025 + skillPower(next, "run") * 0.9;
        const damage = Math.max(1, Math.round(actingMonster.atk - guard));
        next.hp = Math.max(0, next.hp - damage);
        messages.push(`${actingMonster.name} attacks on SPD ${actingMonster.speed} · ${damage} HP lost.`);
        considerPills(next, messages);
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
    const levelled = useSkill(next, "search");
    if (levelled) messages.push(`察 Spirit Perception reaches Lv.${levelled} through use.`);
    const feature = next.features[next.hostCell];
    if (feature?.type === "key" && feature.key) {
      next.keys[feature.key] = true;
      messages.push(`搜 Search · ${feature.key} key secured.`);
    } else if (feature?.type === "chest" && feature.key) {
      if (!next.keys[feature.key]) {
        messages.push(`搜 Search · locked ${feature.key} chest needs its matching key.`);
      } else {
        const bonus = 1 + (profile.behaviours.greed >= 20 ? 1 : 0) + skillPower(next, "search");
        next.openedChests.push(next.hostCell);
        messages.push(`搜 Search · ${feature.key} key opens the locked chest.`);
        rollDrop(next, bonus, messages);
        if (skillPower(next, "search") >= 2) rollDrop(next, 1, messages);
      }
    } else if (feature?.type === "sigil") {
      next.sigilCollected = true;
      messages.push(`搜 Search · ${floorSigil(next.dungeon)} secured.`);
      // The sigil room always yields something, so a stealthy run still shows
      // the host learning, equipping and stocking.
      rollDrop(next, 1 + skillPower(next, "search"), messages);
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
      const levelled = useSkill(next, "hit");
      if (levelled) messages.push(`破 Cloudsplitter Rend reaches Lv.${levelled} through use.`);
      const damage = power.atk + Math.floor(profile.behaviours.battle / 18) + skillPower(next, "hit") * 2;
      target.hp = Math.max(0, target.hp - damage);
      target.alerted = true;
      messages.push(`打 Hit · ${target.name} takes ${damage}.`);
      if (target.hp === 0) {
        const richness = target.kind === "basic" ? 1 : target.kind === "elite" ? 2 : 4;
        const experience = target.kind === "basic" ? 38 : target.kind === "elite" ? 66 : 105;
        next.kills += 1;
        messages.push(`${target.name} defeated · +${experience} EXP.`);
        gainExperience(next, experience, messages);
        rollDrop(next, richness, messages);
      }
    }
  }

  if (decision.action === "run") {
    next.lastAction = "跑 Run";
    actionCost = 70;
    const levelled = useSkill(next, "run");
    if (levelled) messages.push(`遁 Falling Petal Step reaches Lv.${levelled} through use.`);
    next.hostCell = runAway(next, objective);
    messages.push(`跑 Run · host breaks line to room ${rowOf(next.hostCell, next.size) + 1}-${columnOf(next.hostCell, next.size) + 1}.`);
  }

  if (decision.action === "move") {
    next.lastAction = decision.independent ? "Route override" : "Route advance";
    next.hostCell = moveToward(next, objective);
    messages.push(`${decision.independent ? "Low obedience · host overrides the learned route" : "Host advances"} to room ${rowOf(next.hostCell, next.size) + 1}-${columnOf(next.hostCell, next.size) + 1}.`);
  }

  if (!next.visited.includes(next.hostCell)) next.visited.push(next.hostCell);
  considerPills(next, messages);
  next.hostNextTurn += actionCost / Math.max(1, power.speed);
  next.monsters.forEach((monster) => {
    if (monster.hp > 0 && !monster.alerted && hasSight(monster.cell, next.hostCell, next.size)) {
      monster.alerted = true;
      messages.push(`${monster.name} sees the host · chase begins.`);
    }
  });
  appendLog(next, messages);
  return next;
};

interface Settlement {
  profile: Profile;
  ledger: Array<{ label: string; amount: number; note: string }>;
  closing: number;
}

// After the run the System does the host's accounting: sells what was outgrown,
// restocks what the next floor needs, and writes down what it did not spend on.
const settleRun = (profile: Profile, run: RunState, survived: boolean): Settlement => {
  const ledger: Settlement["ledger"] = [];
  let stones = profile.stones;

  const cacheValue = run.loot * 6;
  if (cacheValue > 0) {
    stones += cacheValue;
    ledger.push({ label: "Spirit stone caches", amount: cacheValue, note: `${run.loot} recovered underground` });
  }

  if (run.scrapped.length) {
    // A failed run comes back light: the host drops half of what it was carrying.
    const carried = survived ? run.scrapped : run.scrapped.slice(0, Math.floor(run.scrapped.length / 2));
    const sold = carried.reduce((total, item) => total + item.value, 0);
    if (sold > 0) {
      stones += sold;
      ledger.push({ label: "Sold outgrown equipment", amount: sold, note: carried.map((item) => item.name).join(", ") });
    }
    if (!survived && run.scrapped.length > carried.length) {
      ledger.push({ label: "Lost on the way out", amount: 0, note: `${run.scrapped.length - carried.length} pieces left behind` });
    }
  }

  const pills = { ...run.pills };
  const restock = Math.max(0, PILL_STOCK_TARGET - pills.hp);
  const restockCost = restock * PILL_VALUE.hp;
  if (restock > 0 && stones >= restockCost) {
    stones -= restockCost;
    pills.hp += restock;
    ledger.push({ label: "Bought blood-return pills", amount: -restockCost, note: `${restock} back to a stock of ${PILL_STOCK_TARGET}` });
  } else if (restock > 0) {
    ledger.push({ label: "Did not restock pills", amount: 0, note: `${restockCost} stones needed, ${stones} held` });
  } else {
    ledger.push({ label: "Did not restock pills", amount: 0, note: `${pills.hp} already carried` });
  }

  // Qi-gathering pills are swallowed on the way out rather than hoarded.
  let hostExp = run.hostExp;
  let hostLevel = run.hostLevel;
  let statPoints = profile.statPoints + run.statPointsGained;
  if (pills.exp > 0) {
    const converted = pills.exp * 45;
    hostExp += converted;
    ledger.push({ label: "Swallowed qi-gathering pills", amount: 0, note: `${pills.exp} used for ${converted} EXP` });
    pills.exp = 0;
    while (hostExp >= expForLevel(hostLevel)) { hostExp -= expForLevel(hostLevel); hostLevel += 1; statPoints += 3; }
  }

  // What it deliberately passed on matters as much as what it bought.
  const declined = run.scrapped.filter((item) => equipmentScore(item) <= equipmentScore(run.equipped[item.slot]));
  if (declined.length) {
    ledger.push({
      label: "Did not equip",
      amount: 0,
      note: `${declined.map((item) => item.name).join(", ")} — scored below what the host already wore`,
    });
  }

  const nextTier = 14 + (Math.floor(run.dungeon / 3) + 2) * 9;
  if (stones < nextTier) {
    ledger.push({ label: "Did not buy a better weapon", amount: 0, note: `${nextTier} stones asked, ${stones} held` });
  } else {
    ledger.push({ label: "Did not visit the smith", amount: 0, note: `${stones} stones held back for the next floor` });
  }

  return {
    profile: {
      ...profile,
      hostLevel,
      hostExp,
      statPoints,
      stones,
      pills,
      equipped: { ...run.equipped },
      skills: run.skills.map((skill) => ({ ...skill })),
    },
    ledger,
    closing: stones,
  };
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

export function SystemGameDemo() {
  const [profile, setProfile] = useState<Profile>(freshProfile);
  const [tab, setTab] = useState<SystemTab>("stats");
  const [phase, setPhase] = useState<Phase>("idle");
  const [run, setRun] = useState<RunState>(() => buildRun(freshProfile()));
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
          equipped: { ...base.equipped, ...(parsed.equipped ?? {}) },
          pills: { ...base.pills, ...(parsed.pills ?? {}) },
          skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        };
        setProfile(restored);
        setRun(buildRun(restored));
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
    const survived = run.outcome === "success";
    const settled = settleRun(profile, run, survived);
    const shared = {
      ledger: settled.ledger,
      closing: settled.closing,
      kills: run.kills,
      learned: run.learned,
      pillsUsed: run.pillsUsed,
    };

    if (survived) {
      const points = 2 + Math.floor(run.dungeon / 3);
      setProfile({
        ...settled.profile,
        systemPoints: settled.profile.systemPoints + points,
        dungeon: run.dungeon + 1,
        maxDungeon: Math.max(settled.profile.maxDungeon, run.dungeon),
      });
      setResult({
        ...shared,
        success: true,
        nearDeath: run.hp / run.maxHp < 0.25,
        summary: `Level escaped · ${run.kills} defeated · host is Lv.${settled.profile.hostLevel} · System gained ${points} points.`,
      });
      setPhase("review");
      return;
    }

    const lifespan = Math.max(0, profile.lifespan - 1);
    setProfile({
      ...settled.profile,
      lifespan,
      obedience: Math.max(0, profile.obedience - 4),
    });
    setResult({
      ...shared,
      success: false,
      nearDeath: true,
      summary: run.outcome === "timeout"
        ? "The door never opened in time. The floor sealed with the host inside and one lifespan was lost."
        : "The host fell in the dark. One lifespan was lost, but the System keeps the lesson.",
    });
    setPhase(lifespan === 0 ? "dead" : "review");
  }, [phase, profile, run]);

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
  // While a run is live the host's sheet is the run's working copy; between runs
  // it is the saved profile. Same shape either way, so the panels never branch.
  const live = phase === "running";
  const sheet = {
    hostLevel: live ? run.hostLevel : profile.hostLevel,
    hostExp: live ? run.hostExp : profile.hostExp,
    equipped: live ? run.equipped : profile.equipped,
    skills: live ? run.skills : profile.skills,
    pills: live ? run.pills : profile.pills,
    stones: profile.stones,
    statPoints: profile.statPoints + (live ? run.statPointsGained : 0),
  };
  const gear = equippedBonus(sheet.equipped);

  const startRun = () => {
    if (phase === "running" || phase === "dead") return;
    if (result?.nearDeath && !rewarded) {
      setProfile((current) => ({ ...current, obedience: Math.max(0, current.obedience - 3) }));
    }
    setRun(buildRun(profile));
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
    setRun(buildRun(fresh));
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
        <div><span>HOST</span><strong>Nameless Disciple · Lv.{sheet.hostLevel}</strong></div>
        <div className="host-exp"><span style={{ width: `${Math.min(100, (sheet.hostExp / expForLevel(sheet.hostLevel)) * 100)}%` }} /><small>{sheet.hostExp} / {expForLevel(sheet.hostLevel)} EXP</small></div>
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
                <div className="stat-points"><span>Unspent points</span><strong>{sheet.statPoints}</strong></div>
                {(["atk", "def", "speed"] as const).map((stat) => (
                  <div className="host-stat" key={stat}>
                    <span>{stat.toUpperCase()}</span>
                    <strong>{profile[stat] + gear[stat]}{gear[stat] ? <i className="stat-gear"> ({profile[stat]}+{gear[stat]})</i> : null}</strong>
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
                {EQUIP_SLOTS.map((slot) => {
                  const item = sheet.equipped[slot];
                  return (
                    <article key={slot}>
                      <span>{SLOT_LABELS[slot]}</span>
                      <strong>{item ? item.name : "Empty"}</strong>
                      <small>
                        {item
                          ? `Tier ${item.tier} · ${[item.atk && `+${item.atk} ATK`, item.def && `+${item.def} DEF`, item.speed && `+${item.speed} SPD`].filter(Boolean).join(" · ")}`
                          : "The host wears whatever it finds that scores higher"}
                      </small>
                    </article>
                  );
                })}
                <p className="panel-foot">Auto-equipped mid-run. Replaced pieces are sold when the run settles.</p>
              </div>
            ) : null}
            {tab === "inventory" ? (
              <div className="inventory-grid">
                <article><span>×{sheet.stones}</span><strong>Spirit stones</strong></article>
                {(Object.keys(PILL_LABELS) as PillKind[]).map((kind) => (
                  <article key={kind}><span>×{sheet.pills[kind]}</span><strong>{PILL_LABELS[kind].name}</strong></article>
                ))}
                <p className="panel-foot">
                  {PILL_LABELS.hp.detail}. {PILL_LABELS.stat.detail} on pickup. {PILL_LABELS.exp.detail}.
                </p>
              </div>
            ) : null}
            {tab === "skills" ? (
              <div className="skill-list">
                {sheet.skills.length ? sheet.skills.map((skill) => {
                  const meta = skillMeta(skill.id);
                  return (
                    <article key={skill.id}>
                      <span>Lv.{skillLevel(skill.uses)}</span>
                      <div>
                        <strong>{meta.name}</strong>
                        <small>{meta.detail}</small>
                        <small>{skill.uses} uses · {usesForNextLevel(skill.uses)} for the next level</small>
                      </div>
                    </article>
                  );
                }) : <p className="panel-foot">No manuals found yet. The host reads any it finds and levels them by using them.</p>}
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
          <div className="run-ledger">
            <p className="panel-kicker">What the host did with it</p>
            <ul>
              {result.ledger.map((line, index) => (
                <li key={`${line.label}-${index}`}>
                  <strong>{line.label}</strong>
                  <span className={line.amount > 0 ? "gain" : line.amount < 0 ? "spend" : "flat"}>
                    {line.amount === 0 ? "—" : `${line.amount > 0 ? "+" : ""}${line.amount}`}
                  </span>
                  <small>{line.note}</small>
                </li>
              ))}
            </ul>
            <p className="ledger-close">
              <span>Closing purse</span><strong>{result.closing} spirit stones</strong>
              <small>
                {result.kills} defeated
                {result.learned.length ? ` · learned ${result.learned.map((id) => skillMeta(id).name).join(", ")}` : " · no new manuals"}
                {result.pillsUsed.hp || result.pillsUsed.stat ? ` · pills used: ${[result.pillsUsed.hp && `${result.pillsUsed.hp} blood-return`, result.pillsUsed.stat && `${result.pillsUsed.stat} marrow-forging`].filter(Boolean).join(", ")}` : " · no pills needed"}
              </small>
            </p>
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
