// ─── 20 Ball game engine ────────────────────────────────────────────────────
// Pure rules logic + the shared types for the whole app. Deliberately
// dependency-free so it can be unit-tested directly with
// `node --experimental-strip-types scripts/engine.test.ts`.
//
// The game: two teams (2v2 "20 Ball" or 4v4 "40 Ball"). Each team keeps
// exactly `keepTarget` of the scores its players shoot across 18 holes —
// any mix per hole. Net scoring off the lowest handicap in the game. What
// the other team has kept stays hidden except via peeks / scheduled
// reveals / the final card.
//
// Teams may start on any hole (shotgun starts, split tees). All ordering
// rules — lock-ins, no-backfill, next-hole navigation — run on PLAY ORDER
// (position in the team's sequence from its starting hole), not on the
// printed hole number. Progress shown to the other team is "holes played",
// which is start-hole agnostic.

export type KeepPolicy = "locked" | "flexible";

export type Settings = {
  /** Scores each team must keep for the round (20 for 2v2, 40 for 4v4). */
  keepTarget: number;
  /** Whether handicap strokes can fall on par 3s (default false). */
  allowPar3Strokes: boolean;
  /** Peeks at the opponent's kept summary each team may burn (default 1). */
  peeksPerTeam: number;
  /** 0 = never; 3/6/9 = summaries unlock every N holes PLAYED. */
  revealEvery: number;
  /** "locked": decisions are final. "flexible": changes allowed but alerted. */
  keepPolicy: KeepPolicy;
  /** Handicap allowance, e.g. 100 or 90 (default 100). */
  handicapPercent: number;
  /** Starting hole per team: [team1, team2]. Default [1, 1]. */
  startHoles: [number, number];
};

export const DEFAULT_SETTINGS: Settings = {
  keepTarget: 20,
  allowPar3Strokes: false,
  peeksPerTeam: 0,
  revealEvery: 0,
  keepPolicy: "locked",
  handicapPercent: 100,
  startHoles: [1, 1],
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
  /** This team's starting hole. */
  startHole: number;
  /** Number of distinct holes this team has entered anything on. */
  progress: number;
  /** Highest play-order index (0-17) with a locked-in decision, -1 if none. */
  decidedThruOrder: number;
  /** Hole number (earliest in play order) still awaiting its decision. */
  pendingHole: number | null;
  /** Every hole in the play order is settled — time to finish. */
  roundComplete: boolean;
  /** Max scores this team can still end up keeping (kept + undecided). */
  potential: number;
  /** potential - keepTarget: how many more scores they may still decline. */
  skipsLeft: number;
  peeksLeft: number;
};

export type PeekRecord = {
  /** Holes the opponent had played at peek time. */
  thru: number;
  keptCount: number;
  toPar: number;
  at: string;
};

export type OppView = {
  team: number;
  players: { id: string; name: string; handicap: number; strokes: number[] }[];
  /** Holes played (count, start-hole agnostic). */
  progress: number;
  startHole: number;
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
  /** This viewer's team has locked in its card (recap shown, opp still hidden). */
  myTeamDone: boolean;
  /** The other team has finished too (both cards about to reveal). */
  oppTeamDone: boolean;
  /** Change alerts (both teams'), newest first. */
  alerts: AlertRecord[];
  /** Populated once status === "final": full cards for both teams. */
  final?: { teams: TeamView[]; winner: number }; // winner 1|2, 0 = tie
};

// ─── Play order ─────────────────────────────────────────────────────────────

/** Position of a hole in a team's play sequence: 0..17 from its start hole. */
export function orderIndex(hole: number, startHole: number): number {
  return (hole - startHole + 18) % 18;
}

/** The 18 holes in the order a team plays them. */
export function playOrder(startHole: number): number[] {
  return Array.from({ length: 18 }, (_, i) => ((startHole - 1 + i) % 18) + 1);
}

// ─── Handicap strokes ───────────────────────────────────────────────────────
// Everyone plays off the low man. A player's stroke count is spread across
// the eligible holes (par 4s/5s unless allowPar3Strokes) hardest-first by
// stroke index, wrapping around for 2nd/3rd strokes as needed.

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
  peeksLeft: number,
  startHole = 1
): TeamView {
  const parByHole = new Array<number>(19).fill(4);
  for (const h of holes) parByHole[h.hole] = h.par;
  const strokesById: Record<string, number[]> = {};
  for (const p of players) strokesById[p.id] = p.strokes;

  const locked = settings.keepPolicy === "locked";
  const playedHoles = new Set<number>();
  for (const e of entries) playedHoles.add(e.hole);

  const decidedThruOrder = entries.reduce(
    (m, e) => (e.decided ? Math.max(m, orderIndex(e.hole, startHole)) : m),
    -1
  );
  let pendingHole: number | null = null;
  for (const e of entries) {
    if (
      !e.decided &&
      (pendingHole === null ||
        orderIndex(e.hole, startHole) < orderIndex(pendingHole, startHole))
    )
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
  // or behind the team's locked play-order position are dead — no backfilling.
  let futureSlots = 0;
  for (const p of players) {
    for (let h = 1; h <= 18; h++) {
      if (
        !cells[p.id][h] &&
        (!locked || orderIndex(h, startHole) > decidedThruOrder)
      )
        futureSlots++;
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
    startHole,
    progress: playedHoles.size,
    decidedThruOrder,
    pendingHole,
    roundComplete: decidedThruOrder === 17 && pendingHole === null,
    potential,
    skipsLeft: potential - settings.keepTarget,
    peeksLeft,
  };
}

/** Kept count + net-to-par over the first `count` holes of a team's play order. */
export function keptSummaryPlayed(
  players: PlayerInfo[],
  entries: Entry[],
  holes: HoleInfo[],
  count: number,
  startHole = 1
): { thru: number; keptCount: number; toPar: number } {
  const parByHole = new Array<number>(19).fill(4);
  for (const h of holes) parByHole[h.hole] = h.par;
  const strokesById: Record<string, number[]> = {};
  for (const p of players) strokesById[p.id] = p.strokes;
  let keptCount = 0;
  let toPar = 0;
  for (const e of entries) {
    if (
      orderIndex(e.hole, startHole) < count &&
      e.kept &&
      e.gross != null
    ) {
      keptCount++;
      toPar += e.gross - strokesById[e.playerId][e.hole] - parByHole[e.hole];
    }
  }
  return { thru: count, keptCount, toPar };
}

/** Largest reveal checkpoint both teams have passed (holes PLAYED), or 0. */
export function revealCheckpoint(
  revealEvery: number,
  playedA: number,
  playedB: number
): number {
  if (!revealEvery) return 0;
  const joint = Math.min(playedA, playedB);
  return Math.floor(joint / revealEvery) * revealEvery;
}

// ─── Per-player round totals (final card leaderboard) ───────────────────────

export type PlayerRoundRow = {
  player: PlayerInfo;
  team: number;
  gross: number;
  net: number;
  holesIn: number;
  parSum: number;
  /** Keep credit: 1 per kept score, split evenly when teammates tied its net. */
  used: number;
  /** To-par this player's kept scores added to the team (splits count as
   *  fractions). 6 kept pars = 0; 2 birdies + 4 pars = -2; half a birdie = -0.5. */
  keptToPar: number;
};

export function playerRoundTotals(
  view: TeamView,
  holes: HoleInfo[]
): PlayerRoundRow[] {
  const rows = new Map<string, PlayerRoundRow>();
  for (const p of view.players) {
    let gross = 0;
    let net = 0;
    let holesIn = 0;
    let parSum = 0;
    for (let h = 1; h <= 18; h++) {
      const c = view.cells[p.id]?.[h];
      if (!c || c.pickup || c.gross == null) continue;
      gross += c.gross;
      net += c.gross - (p.strokes[h] ?? 0);
      parSum += holes[h - 1].par;
      holesIn++;
    }
    rows.set(p.id, {
      player: p,
      team: view.team,
      gross,
      net,
      holesIn,
      parSum,
      used: 0,
      keptToPar: 0,
    });
  }

  // Distribute keep credit hole by hole. On each hole, group the team's
  // scores by net value; a group of N players with K of them kept is fully
  // interchangeable, so each of the N gets K/N credit. Two players tie and one
  // is kept -> ½ each; three tie and two are kept -> ⅔ each; and so on. Credit
  // always sums to the number of kept scores.
  for (let h = 1; h <= 18; h++) {
    const groups = new Map<number, { members: PlayerInfo[]; kept: number }>();
    for (const p of view.players) {
      const c = view.cells[p.id]?.[h];
      if (!c || c.pickup || c.gross == null) continue;
      const net = c.gross - (p.strokes[h] ?? 0);
      const g = groups.get(net) ?? { members: [], kept: 0 };
      g.members.push(p);
      if (c.kept) g.kept++;
      groups.set(net, g);
    }
    const par = holes[h - 1].par;
    for (const [net, g] of groups) {
      if (g.kept === 0) continue;
      const share = g.kept / g.members.length;
      for (const p of g.members) {
        const row = rows.get(p.id)!;
        row.used += share;
        row.keptToPar += share * (net - par);
      }
    }
  }

  return [...rows.values()];
}

const USED_FRACTIONS: [number, string][] = [
  [1 / 6, "⅙"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [5 / 6, "⅚"],
];

/** Render keep credit as a clean mixed number (2½, ⅔, 1⅙) where it lands on a
 *  common fraction; otherwise a one-decimal fallback. */
// ─── Optimal keep analysis (final-card "what could have been") ──────────────
// Because a team can keep any mix (0/1/2 per hole, all from one player), the
// best possible score is just the `keepTarget` lowest net-to-par scores it
// made. Compare to what it actually kept, and attribute the optimal set back
// to each player.

export type OptimalRow = {
  player: PlayerInfo;
  count: number; // how many of this player's scores are in the optimal set
  toPar: number; // summed net-to-par of those scores
};

export type OptimalResult = {
  optimalToPar: number;
  optimalCount: number; // min(keepTarget, scores available)
  actualToPar: number;
  actualCount: number;
  leftOnTable: number; // actualToPar - optimalToPar (>= 0)
  perPlayer: OptimalRow[];
};

export function optimalSelection(
  view: TeamView,
  holes: HoleInfo[],
  keepTarget: number
): OptimalResult {
  const scores: { playerId: string; netToPar: number }[] = [];
  let actualToPar = 0;
  let actualCount = 0;
  for (const p of view.players) {
    for (let h = 1; h <= 18; h++) {
      const c = view.cells[p.id]?.[h];
      if (!c || c.pickup || c.gross == null) continue;
      const netToPar = c.gross - (p.strokes[h] ?? 0) - holes[h - 1].par;
      scores.push({ playerId: p.id, netToPar });
      if (c.kept) {
        actualToPar += netToPar;
        actualCount++;
      }
    }
  }
  scores.sort((a, b) => a.netToPar - b.netToPar);
  const target = Math.min(keepTarget, scores.length);
  const perPlayer = new Map<string, OptimalRow>(
    view.players.map((p) => [p.id, { player: p, count: 0, toPar: 0 }])
  );
  let optimalToPar = 0;
  if (target > 0) {
    // Scores strictly better than the cutoff are definitely in. Scores tied AT
    // the cutoff value compete for the leftover slots, so their credit splits
    // evenly — same idea as the "Used" column (a boundary tie shows halves).
    const cutoff = scores[target - 1].netToPar;
    const below = scores.filter((s) => s.netToPar < cutoff);
    const atCut = scores.filter((s) => s.netToPar === cutoff);
    const slotsLeft = target - below.length;
    const share = slotsLeft / atCut.length;
    for (const s of below) {
      const row = perPlayer.get(s.playerId)!;
      row.count += 1;
      row.toPar += s.netToPar;
      optimalToPar += s.netToPar;
    }
    for (const s of atCut) {
      const row = perPlayer.get(s.playerId)!;
      row.count += share;
      row.toPar += share * s.netToPar;
    }
    optimalToPar += slotsLeft * cutoff; // every tied score has net === cutoff
  }
  return {
    optimalToPar,
    optimalCount: target,
    actualToPar,
    actualCount,
    leftOnTable: actualToPar - optimalToPar,
    perPlayer: [...perPlayer.values()],
  };
}

export function fmtUsed(n: number): string {
  if (n < 0.001) return "0";
  const whole = Math.floor(n + 1e-6);
  const frac = n - whole;
  if (frac < 0.02) return String(whole);
  for (const [val, glyph] of USED_FRACTIONS) {
    if (Math.abs(frac - val) < 0.02)
      return whole > 0 ? `${whole}${glyph}` : glyph;
  }
  return (Math.round(n * 10) / 10).toFixed(1);
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

export function fmtToPar(n: number): string {
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}

/** Signed to-par that may carry a fraction: E, -1, +2½, -⅔. */
export function fmtToParFraction(n: number): string {
  if (Math.abs(n) < 0.001) return "E";
  return (n < 0 ? "-" : "+") + fmtUsed(Math.abs(n));
}

/** Round each value to the nearest ½ while keeping the group's total exact
 *  (largest-remainder on a half-unit grid). Used to tidy the split breakdowns
 *  so columns still add up. Works with negative values (to-par). */
export function roundHalvesToSum(values: number[], targetSum: number): number[] {
  if (values.length === 0) return [];
  const doubledTarget = Math.round(targetSum * 2);
  const scaled = values.map((v) => v * 2);
  const floored = scaled.map((v) => Math.floor(v + 1e-9));
  let remainder = doubledTarget - floored.reduce((a, b) => a + b, 0);
  const order = scaled
    .map((v, i) => ({ i, frac: v - Math.floor(v + 1e-9) }))
    .sort((a, b) => b.frac - a.frac);
  const result = floored.slice();
  for (let k = 0; remainder > 0 && k < order.length; k++, remainder--)
    result[order[k].i] += 1;
  for (let k = order.length - 1; remainder < 0 && k >= 0; k--, remainder++)
    result[order[k].i] -= 1;
  return result.map((v) => v / 2);
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
  let policy: KeepPolicy = s.keepPolicy === "flexible" ? "flexible" : "locked";
  if (input && "lockKeeps" in input && input.keepPolicy === undefined)
    policy = input.lockKeeps === false ? "flexible" : "locked";
  const rawStarts = Array.isArray(s.startHoles) ? s.startHoles : [1, 1];
  return {
    keepTarget: int(s.keepTarget, 1, 72, 20),
    allowPar3Strokes: !!s.allowPar3Strokes,
    peeksPerTeam: int(s.peeksPerTeam, 0, 9, 0),
    revealEvery: [0, 3, 6, 9].includes(Number(s.revealEvery))
      ? Number(s.revealEvery)
      : 0,
    keepPolicy: policy,
    handicapPercent: int(s.handicapPercent, 50, 150, 100),
    startHoles: [int(rawStarts[0], 1, 18, 1), int(rawStarts[1], 1, 18, 1)],
  };
}
