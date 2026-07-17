// ─── 20 Ball game engine ────────────────────────────────────────────────────
// Pure rules logic + the shared types for the whole app. Deliberately
// dependency-free so it can be unit-tested directly with
// `node --experimental-strip-types scripts/engine.test.ts`.
//
// The game: 2v2. Each team keeps exactly `keepTarget` (default 20) of the 36
// scores its two players shoot across 18 holes — 0, 1, or 2 per hole. Net
// scoring off the lowest handicap in the foursome. What the other team has
// kept stays hidden except via peeks / scheduled reveals / the final card.
//
// Keep decisions are made explicitly, one hole at a time ("lock in the hole").
// With keepPolicy "locked" (the classic anti-cheat rule) a locked hole is
// immutable and you can't backfill scores on holes behind your locked
// position. With "flexible", changes are allowed but every change on a locked
// score raises an alert the other team can see.

export type KeepPolicy = "locked" | "flexible";

export type Settings = {
  /** Scores each team must keep for the round (default 20). */
  keepTarget: number;
  /** Whether handicap strokes can fall on par 3s (default false). */
  allowPar3Strokes: boolean;
  /** Peeks at the opponent's kept summary each team may burn (default 1). */
  peeksPerTeam: number;
  /** 0 = never; 3/6/9 = both teams' kept summaries unlock every N holes. */
  revealEvery: number;
  /** "locked": decisions are final. "flexible": changes allowed but alerted. */
  keepPolicy: KeepPolicy;
  /** Handicap allowance, e.g. 100 or 90 (default 100). */
  handicapPercent: number;
};

export const DEFAULT_SETTINGS: Settings = {
  keepTarget: 20,
  allowPar3Strokes: false,
  peeksPerTeam: 1,
  revealEvery: 0,
  keepPolicy: "locked",
  handicapPercent: 100,
};

export type HoleInfo = { hole: number; par: number; si: number };

/** One player-hole record. `gross` is null when the player picked up. */
export type Entry = {
  playerId: string;
  hole: number;
  gross: number | null;
  pickup: boolean;
  kept: boolean;
  /** True once the keep/skip decision for this score has been locked in. */
  decided: boolean;
};

export type PlayerInfo = {
  id: string;
  team: number;
  pos: number;
  name: string;
  handicap: number;
  /** strokes[hole] = handicap strokes received on that hole (index 1..18). */
  strokes: number[];
};

export type ScoreCell = {
  gross: number | null;
  pickup: boolean;
  kept: boolean;
  decided: boolean;
  /** Decided under the "locked" policy — immutable. */
  locked: boolean;
};

export type TeamView = {
  team: number;
  players: PlayerInfo[];
  /** cells[playerId][hole] — only holes with an entry are present. */
  cells: Record<string, Record<number, ScoreCell>>;
  keptCount: number;
  toPar: number;
  /** Highest hole this team has entered anything on. */
  progress: number;
  /** Highest hole with a locked-in decision. */
  decidedThru: number;
  /** Lowest hole with an entered score still awaiting its decision. */
  pendingHole: number | null;
  /** Max scores this team can still end up keeping (kept + undecided). */
  potential: number;
  /** potential - keepTarget: how many more scores they may still decline. */
  skipsLeft: number;
  peeksLeft: number;
};

export type PeekRecord = {
  thru: number;
  keptCount: number;
  toPar: number;
  at: string;
};

export type OppView = {
  team: number;
  players: { id: string; name: string; handicap: number; strokes: number[] }[];
  progress: number;
  /** Kept summary through the last unlocked reveal checkpoint, if any. */
  reveal: { thru: number; keptCount: number; toPar: number } | null;
  /** This viewer's team's past peeks at the opponent. */
  peeks: PeekRecord[];
};

export type AlertRecord = { team: number; message: string; at: string };

export type GameMeta = {
  id: string;
  code: string;
  name: string;
  status: "active" | "final";
  settings: Settings;
  holes: HoleInfo[];
  createdBy: string;
  createdAt: string;
};

export type GameState = {
  game: GameMeta;
  viewer: { userId: string; username: string; team: number; isCreator: boolean };
  mine: TeamView;
  opp: OppView;
  /** Change alerts (both teams'), newest first. */
  alerts: AlertRecord[];
  /** Populated once status === "final": full cards for both teams. */
  final?: { teams: TeamView[]; winner: number }; // winner 1|2, 0 = tie
};

// ─── Handicap strokes ───────────────────────────────────────────────────────
// Everyone plays off the low man. A player's stroke count is spread across
// the eligible holes (par 4s/5s unless allowPar3Strokes) hardest-first by
// stroke index. Needing more strokes than there are eligible holes wraps
// around: a second stroke starting again from the hardest hole, and so on.

export function strokesForHandicap(
  handicap: number,
  minHandicap: number,
  holes: HoleInfo[],
  settings: Settings
): number[] {
  const out = new Array<number>(19).fill(0);
  const diff = Math.max(
    0,
    Math.round(((handicap - minHandicap) * settings.handicapPercent) / 100)
  );
  const eligible = holes
    .filter((h) => settings.allowPar3Strokes || h.par > 3)
    .slice()
    .sort((a, b) => a.si - b.si);
  if (diff === 0 || eligible.length === 0) return out;
  const base = Math.floor(diff / eligible.length);
  const extra = diff % eligible.length;
  eligible.forEach((h, i) => {
    out[h.hole] = base + (i < extra ? 1 : 0);
  });
  return out;
}

// ─── Team math ──────────────────────────────────────────────────────────────

export function buildTeamView(
  team: number,
  players: PlayerInfo[],
  entries: Entry[],
  holes: HoleInfo[],
  settings: Settings,
  peeksLeft: number
): TeamView {
  const parByHole = new Array<number>(19).fill(4);
  for (const h of holes) parByHole[h.hole] = h.par;
  const strokesById: Record<string, number[]> = {};
  for (const p of players) strokesById[p.id] = p.strokes;

  const locked = settings.keepPolicy === "locked";
  const progress = entries.reduce((m, e) => Math.max(m, e.hole), 0);
  const decidedThru = entries.reduce(
    (m, e) => (e.decided ? Math.max(m, e.hole) : m),
    0
  );
  let pendingHole: number | null = null;
  for (const e of entries) {
    if (!e.decided && (pendingHole === null || e.hole < pendingHole))
      pendingHole = e.hole;
  }

  const cells: TeamView["cells"] = {};
  for (const p of players) cells[p.id] = {};

  let keptCount = 0;
  let toPar = 0;
  let undecided = 0;
  let decidedSkips = 0;

  for (const e of entries) {
    cells[e.playerId][e.hole] = {
      gross: e.gross,
      pickup: e.pickup,
      kept: e.kept,
      decided: e.decided,
      locked: e.decided && locked,
    };
    if (e.kept && e.gross != null) {
      keptCount++;
      toPar += e.gross - strokesById[e.playerId][e.hole] - parByHole[e.hole];
    } else if (!e.decided && !e.pickup && e.gross != null) {
      undecided++;
    } else if (e.decided && !e.kept && !e.pickup && e.gross != null) {
      decidedSkips++;
    }
  }

  // Future slots: holes with no entry yet. Under the locked policy, holes at
  // or behind the team's locked position are dead — no backfilling.
  let futureSlots = 0;
  for (const p of players) {
    for (let h = 1; h <= 18; h++) {
      if (!cells[p.id][h] && (!locked || h > decidedThru)) futureSlots++;
    }
  }

  const potential =
    keptCount + undecided + futureSlots + (locked ? 0 : decidedSkips);

  return {
    team,
    players,
    cells,
    keptCount,
    toPar,
    progress,
    decidedThru,
    pendingHole,
    potential,
    skipsLeft: potential - settings.keepTarget,
    peeksLeft,
  };
}

/** Kept count + net-to-par over kept scores on holes 1..thru only. */
export function keptSummaryThru(
  players: PlayerInfo[],
  entries: Entry[],
  holes: HoleInfo[],
  thru: number
): { thru: number; keptCount: number; toPar: number } {
  const parByHole = new Array<number>(19).fill(4);
  for (const h of holes) parByHole[h.hole] = h.par;
  const strokesById: Record<string, number[]> = {};
  for (const p of players) strokesById[p.id] = p.strokes;
  let keptCount = 0;
  let toPar = 0;
  for (const e of entries) {
    if (e.hole <= thru && e.kept && e.gross != null) {
      keptCount++;
      toPar += e.gross - strokesById[e.playerId][e.hole] - parByHole[e.hole];
    }
  }
  return { thru, keptCount, toPar };
}

/** Largest reveal checkpoint both teams have completed, or 0. */
export function revealCheckpoint(
  revealEvery: number,
  progressA: number,
  progressB: number
): number {
  if (!revealEvery) return 0;
  const joint = Math.min(progressA, progressB);
  return Math.floor(joint / revealEvery) * revealEvery;
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

export function fmtToPar(n: number): string {
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}

export function netLabel(netToPar: number): string {
  if (netToPar <= -3) return "Albatross";
  if (netToPar === -2) return "Eagle";
  if (netToPar === -1) return "Birdie";
  if (netToPar === 0) return "Par";
  if (netToPar === 1) return "Bogey";
  if (netToPar === 2) return "Double";
  return `+${netToPar}`;
}

// ─── Setup validation ───────────────────────────────────────────────────────

export const STANDARD_HOLES: HoleInfo[] = [
  { hole: 1, par: 4, si: 5 },
  { hole: 2, par: 4, si: 11 },
  { hole: 3, par: 3, si: 17 },
  { hole: 4, par: 4, si: 1 },
  { hole: 5, par: 5, si: 9 },
  { hole: 6, par: 4, si: 13 },
  { hole: 7, par: 3, si: 15 },
  { hole: 8, par: 4, si: 3 },
  { hole: 9, par: 5, si: 7 },
  { hole: 10, par: 4, si: 6 },
  { hole: 11, par: 3, si: 16 },
  { hole: 12, par: 4, si: 2 },
  { hole: 13, par: 5, si: 10 },
  { hole: 14, par: 4, si: 8 },
  { hole: 15, par: 4, si: 4 },
  { hole: 16, par: 3, si: 18 },
  { hole: 17, par: 4, si: 12 },
  { hole: 18, par: 5, si: 14 },
];

// Old Bridge Golf Club, Matawan NJ (obnjgolf.com) — par 71, five par 3s.
export const OLD_BRIDGE_HOLES: HoleInfo[] = [
  { hole: 1, par: 4, si: 8 },
  { hole: 2, par: 4, si: 14 },
  { hole: 3, par: 3, si: 18 },
  { hole: 4, par: 5, si: 16 },
  { hole: 5, par: 4, si: 4 },
  { hole: 6, par: 5, si: 12 },
  { hole: 7, par: 3, si: 6 },
  { hole: 8, par: 4, si: 2 },
  { hole: 9, par: 3, si: 10 },
  { hole: 10, par: 5, si: 17 },
  { hole: 11, par: 3, si: 9 },
  { hole: 12, par: 4, si: 3 },
  { hole: 13, par: 4, si: 15 },
  { hole: 14, par: 5, si: 11 },
  { hole: 15, par: 3, si: 13 },
  { hole: 16, par: 4, si: 1 },
  { hole: 17, par: 4, si: 7 },
  { hole: 18, par: 4, si: 5 },
];

export const COURSE_PRESETS: { name: string; holes: HoleInfo[] }[] = [
  { name: "Old Bridge GC (par 71)", holes: OLD_BRIDGE_HOLES },
  { name: "Standard par 72", holes: STANDARD_HOLES },
];

export function validateHoles(holes: unknown): string | null {
  if (!Array.isArray(holes) || holes.length !== 18)
    return "Course must have exactly 18 holes.";
  const sis = new Set<number>();
  for (let i = 0; i < 18; i++) {
    const h = holes[i] as HoleInfo;
    if (!h || h.hole !== i + 1) return "Holes must be numbered 1-18 in order.";
    if (!Number.isInteger(h.par) || h.par < 3 || h.par > 6)
      return `Hole ${h.hole}: par must be 3-6.`;
    if (!Number.isInteger(h.si) || h.si < 1 || h.si > 18)
      return `Hole ${h.hole}: stroke index must be 1-18.`;
    sis.add(h.si);
  }
  if (sis.size !== 18)
    return "Stroke indexes must use each of 1-18 exactly once.";
  return null;
}

export function normalizeSettings(
  input: (Partial<Settings> & { lockKeeps?: boolean }) | undefined
): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(input ?? {}) };
  const int = (v: unknown, lo: number, hi: number, dflt: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
  };
  // Accept the legacy lockKeeps boolean from older payloads.
  let policy: KeepPolicy = s.keepPolicy === "flexible" ? "flexible" : "locked";
  if (input && "lockKeeps" in input && input.keepPolicy === undefined)
    policy = input.lockKeeps === false ? "flexible" : "locked";
  return {
    keepTarget: int(s.keepTarget, 1, 36, 20),
    allowPar3Strokes: !!s.allowPar3Strokes,
    peeksPerTeam: int(s.peeksPerTeam, 0, 9, 1),
    revealEvery: [0, 3, 6, 9].includes(Number(s.revealEvery))
      ? Number(s.revealEvery)
      : 0,
    keepPolicy: policy,
    handicapPercent: int(s.handicapPercent, 50, 150, 100),
  };
}
