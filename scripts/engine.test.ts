// Unit checks for the 20 Ball engine.
// Run with: node --experimental-strip-types scripts/engine.test.ts

import assert from "node:assert";
import {
  DEFAULT_SETTINGS,
  OLD_BRIDGE_HOLES,
  STANDARD_HOLES,
  buildTeamView,
  fmtToParFraction,
  fmtUsed,
  keptSummaryPlayed,
  normalizeSettings,
  optimalSelection,
  orderIndex,
  playOrder,
  playerRoundTotals,
  revealCheckpoint,
  strokesForHandicap,
  validateHoles,
  type Entry,
  type PlayerInfo,
} from "../lib/engine.ts";

const S = { ...DEFAULT_SETTINGS };
const holes = STANDARD_HOLES;
const par3s = holes.filter((h) => h.par === 3).map((h) => h.hole);
const noStrokes = () => new Array<number>(19).fill(0);
const P = (id: string, extra?: Partial<PlayerInfo>): PlayerInfo => ({
  id,
  team: 1,
  pos: 1,
  name: id.toUpperCase(),
  handicap: 0,
  strokes: noStrokes(),
  ...extra,
});
const E = (
  playerId: string,
  hole: number,
  gross: number | null,
  opts?: Partial<Entry>
): Entry => ({
  playerId,
  hole,
  gross,
  pickup: false,
  kept: false,
  decided: false,
  ...opts,
});

// ── play order ──
{
  assert.strictEqual(orderIndex(1, 1), 0);
  assert.strictEqual(orderIndex(18, 1), 17);
  assert.strictEqual(orderIndex(10, 10), 0);
  assert.strictEqual(orderIndex(9, 10), 17, "hole 9 is last from a 10 start");
  assert.strictEqual(orderIndex(1, 10), 9);
  const order10 = playOrder(10);
  assert.strictEqual(order10[0], 10);
  assert.strictEqual(order10[8], 18);
  assert.strictEqual(order10[9], 1);
  assert.strictEqual(order10[17], 9);
}

// ── strokes: the user's exact example (10, 15, 20, 25 handicaps) ──
{
  const s10 = strokesForHandicap(10, 10, holes, S);
  assert.strictEqual(s10.reduce((a, b) => a + b, 0), 0, "low man gets 0");

  const s15 = strokesForHandicap(15, 10, holes, S);
  assert.strictEqual(s15.reduce((a, b) => a + b, 0), 5);
  const eligible = holes.filter((h) => h.par > 3).sort((a, b) => a.si - b.si);
  for (const h of eligible.slice(0, 5)) assert.strictEqual(s15[h.hole], 1);
  for (const h3 of par3s) assert.strictEqual(s15[h3], 0);

  const s25 = strokesForHandicap(25, 10, holes, S);
  assert.strictEqual(s25.reduce((a, b) => a + b, 0), 15);
  assert.strictEqual(s25[eligible[0].hole], 2, "hardest hole doubles up");
}

// ── Old Bridge: 42 vs 14 triple wrap ──
{
  assert.strictEqual(validateHoles(OLD_BRIDGE_HOLES), null);
  const s42 = strokesForHandicap(42, 14, OLD_BRIDGE_HOLES, S);
  assert.strictEqual(s42.reduce((a, b) => a + b, 0), 28);
  assert.strictEqual(s42[16], 3);
  assert.strictEqual(s42[8], 3);
  assert.strictEqual(s42.filter((n) => n === 2).length, 11);
}

// ── team math (start hole 1): birdie + par + par kept = -1 ──
{
  const players = [P("a"), P("b", { pos: 2 })];
  const entries: Entry[] = [
    E("a", 1, 3, { kept: true, decided: true }),
    E("b", 1, 4, { kept: true, decided: true }),
    E("a", 2, 4, { kept: true, decided: true }),
    E("b", 2, 6, { decided: true }),
    E("a", 3, 5),
    E("b", 3, 4),
  ];
  const view = buildTeamView(1, players, entries, holes, S, 1);
  assert.strictEqual(view.keptCount, 3);
  assert.strictEqual(view.toPar, -1);
  assert.strictEqual(view.progress, 3, "3 holes played");
  assert.strictEqual(view.decidedThruOrder, 1);
  assert.strictEqual(view.pendingHole, 3);
  assert.strictEqual(view.roundComplete, false);
  assert.strictEqual(view.cells["b"][2].locked, true);
  assert.strictEqual(view.potential, 3 + 2 + 30);
  assert.strictEqual(view.skipsLeft, 15);
}

// ── shotgun start on 10: order rules follow play sequence ──
{
  const players = [P("a"), P("b", { pos: 2 })];
  const entries: Entry[] = [
    E("a", 10, 4, { kept: true, decided: true }),
    E("b", 10, 5, { decided: true }),
    E("a", 11, 3, { kept: true, decided: true }),
    E("b", 11, 3, { decided: true }),
    E("a", 12, 4),
    E("b", 12, 4),
  ];
  const view = buildTeamView(1, players, entries, holes, S, 1, 10);
  assert.strictEqual(view.startHole, 10);
  assert.strictEqual(view.progress, 3);
  assert.strictEqual(view.decidedThruOrder, 1, "10 and 11 = order 0 and 1");
  assert.strictEqual(view.pendingHole, 12);
  // holes 1-9 are AHEAD in play order (idx 9-17), so still open: potential
  // = 2 kept + 2 undecided + (15 holes x 2 = 30 future)
  assert.strictEqual(view.potential, 2 + 2 + 30);

  // ...whereas a skipped-over hole BEHIND the locked position is dead:
  const skipped: Entry[] = [
    E("a", 10, 4, { kept: true, decided: true }),
    E("b", 10, 4, { kept: true, decided: true }),
    // hole 11 never entered, then 12 locked:
    E("a", 12, 4, { decided: true }),
    E("b", 12, 4, { decided: true }),
  ];
  const v2 = buildTeamView(1, players, skipped, holes, S, 1, 10);
  assert.strictEqual(v2.decidedThruOrder, 2);
  // hole 11 (order 1) dead = 2 slots gone; future = 15 holes x 2 = 30
  assert.strictEqual(v2.potential, 2 + 0 + 30);
}

// ── roundComplete with a non-1 start ──
{
  const players = [P("a")];
  const entries: Entry[] = [];
  for (const h of playOrder(5)) entries.push(E("a", h, 4, { decided: true, kept: h % 2 === 0 }));
  const view = buildTeamView(1, players, entries, holes, { ...S, keepTarget: 9 }, 0, 5);
  assert.strictEqual(view.decidedThruOrder, 17);
  assert.strictEqual(view.roundComplete, true);
}

// ── kept summary by holes PLAYED + reveal checkpoints ──
{
  const players = [P("a", { team: 2 })];
  // started on 16: play order is 16,17,18,1,2,...
  const entries: Entry[] = [
    E("a", 16, 3, { kept: true, decided: true }), // played 1st (par 3 -> E)
    E("a", 17, 3, { kept: true, decided: true }), // played 2nd (par 4 -> -1)
    E("a", 1, 4, { kept: true, decided: true }), // played 4th — beyond count 3
  ];
  const sum = keptSummaryPlayed(players, entries, holes, 3, 16);
  assert.strictEqual(sum.keptCount, 2);
  assert.strictEqual(sum.toPar, -1);

  assert.strictEqual(revealCheckpoint(3, 8, 7), 6);
  assert.strictEqual(revealCheckpoint(3, 2, 9), 0);
  assert.strictEqual(revealCheckpoint(0, 18, 18), 0);
}

// ── player round totals: the 0.5 split for interchangeable keeps ──
{
  const players = [P("a"), P("b", { pos: 2 })];
  const entries: Entry[] = [
    // hole 1 (par 4): both net bogey 5, only a's kept -> ½ each
    E("a", 1, 5, { kept: true, decided: true }),
    E("b", 1, 5, { decided: true }),
    // hole 2 (par 4): both kept -> 1 each
    E("a", 2, 4, { kept: true, decided: true }),
    E("b", 2, 4, { kept: true, decided: true }),
    // hole 3 (par 3): a kept 4, b skipped a 5 (different) -> full credit to a
    E("a", 3, 4, { kept: true, decided: true }),
    E("b", 3, 5, { decided: true }),
  ];
  const view = buildTeamView(1, players, entries, holes, S, 0);
  const rows = playerRoundTotals(view, holes);
  const a = rows.find((r) => r.player.id === "a")!;
  const b = rows.find((r) => r.player.id === "b")!;
  assert.strictEqual(a.used, 0.5 + 1 + 1);
  assert.strictEqual(b.used, 0.5 + 1);
  assert.strictEqual(a.used + b.used, 4, "credit sums to total keeps");
  assert.strictEqual(a.gross, 5 + 4 + 4);
  assert.strictEqual(fmtUsed(a.used), "2½");
  assert.strictEqual(fmtUsed(3), "3");

  // net ties count too: b gets a stroke, gross differ but nets tie -> split
  const strokes = noStrokes();
  strokes[4] = 1;
  const p2 = [P("a"), P("b", { pos: 2, strokes })];
  const e2: Entry[] = [
    E("a", 4, 5, { kept: true, decided: true }), // net 5
    E("b", 4, 6, { decided: true }), // net 5 with the stroke
  ];
  const v2 = buildTeamView(1, p2, e2, holes, S, 0);
  const r2 = playerRoundTotals(v2, holes);
  assert.strictEqual(r2.find((r) => r.player.id === "a")!.used, 0.5);
  assert.strictEqual(r2.find((r) => r.player.id === "b")!.used, 0.5);
}

// ── 40 Ball credit: 3 golfers tie a hole, 2 kept -> ⅔ each ──
{
  const players = [P("a"), P("b", { pos: 2 }), P("c", { pos: 3 }), P("d", { pos: 4 })];
  const entries: Entry[] = [
    // hole 1 (par 4): a, b, c all net bogey (5); a & b kept, c not. d made par, kept.
    E("a", 1, 5, { kept: true, decided: true }),
    E("b", 1, 5, { kept: true, decided: true }),
    E("c", 1, 5, { decided: true }),
    E("d", 1, 4, { kept: true, decided: true }),
  ];
  const view = buildTeamView(1, players, entries, holes, { ...S, keepTarget: 40 }, 0);
  const rows = playerRoundTotals(view, holes);
  const used = (id: string) => rows.find((r) => r.player.id === id)!.used;
  assert.ok(Math.abs(used("a") - 2 / 3) < 1e-9, "a gets ⅔");
  assert.ok(Math.abs(used("b") - 2 / 3) < 1e-9, "b gets ⅔");
  assert.ok(Math.abs(used("c") - 2 / 3) < 1e-9, "c (unkept but tied) gets ⅔");
  assert.strictEqual(used("d"), 1, "d's par kept outright = 1");
  const total = rows.reduce((s, r) => s + r.used, 0);
  assert.ok(Math.abs(total - 3) < 1e-9, "credit sums to 3 kept scores");
  assert.strictEqual(fmtUsed(2 / 3), "⅔");
  assert.strictEqual(fmtUsed(1 / 3), "⅓");
  assert.strictEqual(fmtUsed(2.5), "2½");
  assert.strictEqual(fmtUsed(1 + 1 / 6), "1⅙");
  assert.strictEqual(fmtUsed(3), "3");

  // to-par contribution: a/b/c each ⅔ of a bogey (+⅔); d's kept par = 0
  const kp = (id: string) => rows.find((r) => r.player.id === id)!.keptToPar;
  assert.ok(Math.abs(kp("a") - 2 / 3) < 1e-9, "a contributes +⅔ to par");
  assert.strictEqual(kp("d"), 0, "d's kept par contributes 0");
  const teamToPar = rows.reduce((s, r) => s + r.keptToPar, 0);
  assert.ok(Math.abs(teamToPar - view.toPar) < 1e-9, "contribs sum to team to-par");
}

// ── optimal keep analysis: best-N vs actual, attributed per player ──
{
  const players = [P("a"), P("b", { pos: 2 })];
  const entries: Entry[] = [
    // hole 1: a birdie(-1) kept, b par(0) skipped
    E("a", 1, 3, { kept: true, decided: true }),
    E("b", 1, 4, { decided: true }),
    // hole 2: a par(0) KEPT (suboptimal), b birdie(-1) skipped
    E("a", 2, 4, { kept: true, decided: true }),
    E("b", 2, 3, { decided: true }),
    // hole 3 (par 3): a par(0) skipped, b bogey(+1) skipped
    E("a", 3, 3, { decided: true }),
    E("b", 3, 4, { decided: true }),
  ];
  // keepTarget 2: they actually kept a@1 (-1) + a@2 (0) = -1.
  const view = buildTeamView(1, players, entries, holes, { ...S, keepTarget: 2 }, 0);
  const opt = optimalSelection(view, holes, 2);
  assert.strictEqual(opt.actualToPar, -1, "kept a birdie + a par");
  assert.strictEqual(opt.actualCount, 2);
  // best 2 of {a:-1, b:0, a:0, b:-1, a:0, b:+1} = the two -1s = -2
  assert.strictEqual(opt.optimalToPar, -2, "best two are both birdies");
  assert.strictEqual(opt.optimalCount, 2);
  assert.strictEqual(opt.leftOnTable, 1, "left one shot on the table");
  // optimal uses a@1(-1) and b@2(-1): one each
  const byId = Object.fromEntries(opt.perPlayer.map((r) => [r.player.id, r]));
  assert.strictEqual(byId["a"].count, 1);
  assert.strictEqual(byId["a"].toPar, -1);
  assert.strictEqual(byId["b"].count, 1);
  assert.strictEqual(byId["b"].toPar, -1);

  // pickups excluded from the pool
  const withX: Entry[] = [
    E("a", 4, null, { pickup: true, decided: true }),
    E("a", 5, 4, { kept: true, decided: true }),
  ];
  const v2 = buildTeamView(1, players, withX, holes, { ...S, keepTarget: 5 }, 0);
  const opt2 = optimalSelection(v2, holes, 5);
  assert.strictEqual(opt2.optimalCount, 1, "only one real score available");
}

// ── contribution formatting: 6 kept pars = E, birdies negative, halves ──
{
  assert.strictEqual(fmtToParFraction(0), "E");
  assert.strictEqual(fmtToParFraction(-2), "-2");
  assert.strictEqual(fmtToParFraction(-0.5), "-½");
  assert.strictEqual(fmtToParFraction(2 / 3), "+⅔");
  assert.strictEqual(fmtToParFraction(1.5), "+1½");
}

// ── validation + settings ──
{
  assert.strictEqual(validateHoles(STANDARD_HOLES), null);
  const s = normalizeSettings({ keepTarget: 99, revealEvery: 4 as never });
  assert.strictEqual(s.keepTarget, 72, "clamped to 4v4 capacity");
  assert.strictEqual(s.revealEvery, 0);
  assert.deepStrictEqual(s.startHoles, [1, 1]);
  const s2 = normalizeSettings({ startHoles: [10, 27 as never] });
  assert.deepStrictEqual(s2.startHoles, [10, 18]);
  assert.strictEqual(normalizeSettings({ lockKeeps: false }).keepPolicy, "flexible");
}

console.log("engine.test.ts: all assertions passed ✅");
