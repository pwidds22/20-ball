// Unit checks for the 20 Ball engine.
// Run with: node --experimental-strip-types scripts/engine.test.ts

import assert from "node:assert";
import {
  DEFAULT_SETTINGS,
  OLD_BRIDGE_HOLES,
  STANDARD_HOLES,
  buildTeamView,
  keptSummaryThru,
  normalizeSettings,
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

// ── strokes: the user's exact example (10, 15, 20, 25 handicaps) ──
{
  const s10 = strokesForHandicap(10, 10, holes, S);
  assert.strictEqual(s10.reduce((a, b) => a + b, 0), 0, "low man gets 0");

  const s15 = strokesForHandicap(15, 10, holes, S);
  assert.strictEqual(s15.reduce((a, b) => a + b, 0), 5, "15 hcp gets 5 strokes");
  const eligible = holes.filter((h) => h.par > 3).sort((a, b) => a.si - b.si);
  for (const h of eligible.slice(0, 5))
    assert.strictEqual(s15[h.hole], 1, `stroke on SI ${h.si}`);
  for (const h3 of par3s) assert.strictEqual(s15[h3], 0, "no strokes on par 3s");

  const s20 = strokesForHandicap(20, 10, holes, S);
  assert.strictEqual(s20.reduce((a, b) => a + b, 0), 10, "20 hcp gets 10");

  // 25 hcp = 15 strokes but only 14 eligible holes -> hardest hole gets 2
  const s25 = strokesForHandicap(25, 10, holes, S);
  assert.strictEqual(s25.reduce((a, b) => a + b, 0), 15, "25 hcp gets 15");
  assert.strictEqual(s25[eligible[0].hole], 2, "hardest hole doubles up");
  assert.strictEqual(s25[eligible[1].hole], 1);
  assert.strictEqual(Math.max(...s25), 2, "max 2 per hole at 15 strokes");
}

// ── par-3 strokes allowed ──
{
  const s = strokesForHandicap(15, 10, holes, { ...S, allowPar3Strokes: true });
  const bySi = holes.slice().sort((a, b) => a.si - b.si);
  for (const h of bySi.slice(0, 5)) assert.strictEqual(s[h.hole], 1);
  assert.strictEqual(s.reduce((a, b) => a + b, 0), 5);
}

// ── handicap allowance % + rounding ──
{
  const s = strokesForHandicap(25.4, 10.1, holes, { ...S, handicapPercent: 90 });
  // (25.4 - 10.1) * 0.9 = 13.77 -> 14
  assert.strictEqual(s.reduce((a, b) => a + b, 0), 14);
}

// ── team math: birdie + par + par kept = -1, kept 3 (user's example) ──
{
  const players = [P("a"), P("b", { pos: 2 })];
  const entries: Entry[] = [
    E("a", 1, 3, { kept: true, decided: true }), // birdie (par 4)
    E("b", 1, 4, { kept: true, decided: true }), // par
    E("a", 2, 4, { kept: true, decided: true }), // par
    E("b", 2, 6, { decided: true }), // locked-in skip
    E("a", 3, 5), // entered, not yet decided
    E("b", 3, 4), // entered, not yet decided
  ];
  const view = buildTeamView(1, players, entries, holes, S, 1);
  assert.strictEqual(view.keptCount, 3);
  assert.strictEqual(view.toPar, -1);
  assert.strictEqual(view.progress, 3);
  assert.strictEqual(view.decidedThru, 2);
  assert.strictEqual(view.pendingHole, 3);
  // locked policy: decided cells are immutable
  assert.strictEqual(view.cells["b"][2].locked, true);
  assert.strictEqual(view.cells["a"][3].locked, false);
  // potential: 3 kept + 2 undecided + 30 future (holes 4-18 x2). The locked
  // skip on b@2 is gone for good.
  assert.strictEqual(view.potential, 3 + 2 + 30);
  assert.strictEqual(view.skipsLeft, 35 - 20);

  // flexible policy: the decided skip could still be flipped (with an alert)
  const flex = buildTeamView(
    1,
    players,
    entries,
    holes,
    { ...S, keepPolicy: "flexible" },
    1
  );
  assert.strictEqual(flex.potential, 3 + 2 + 30 + 1);
  assert.strictEqual(flex.cells["b"][2].locked, false);
}

// ── locked policy kills backfill: empty holes behind decidedThru are dead ──
{
  const players = [P("a"), P("b", { pos: 2 })];
  const entries: Entry[] = [
    // hole 1 skipped entirely (never entered), holes 2-3 decided
    E("a", 2, 5, { kept: true, decided: true }),
    E("b", 2, 5, { kept: true, decided: true }),
    E("a", 3, 5, { decided: true }),
    E("b", 3, 5, { decided: true }),
  ];
  const view = buildTeamView(1, players, entries, holes, S, 0);
  // hole 1 (2 slots) is dead; future = holes 4-18 x2 = 30
  assert.strictEqual(view.potential, 2 + 0 + 30);
  const flex = buildTeamView(
    1,
    players,
    entries,
    holes,
    { ...S, keepPolicy: "flexible" },
    0
  );
  // flexible: hole 1 still enterable (2) + the two decided skips
  assert.strictEqual(flex.potential, 2 + 32 + 2);
}

// ── forced-keep pressure: no skips left ──
{
  const players = [P("a"), P("b", { pos: 2 })];
  const entries: Entry[] = [];
  for (let h = 1; h <= 10; h++) {
    entries.push(E("a", h, 5, { decided: true, kept: h <= 2 }));
    entries.push(E("b", h, 5, { decided: true, kept: h <= 2 }));
  }
  const view = buildTeamView(1, players, entries, holes, S, 0);
  // kept 4; every skip is locked; 8 open holes x 2 = 16 future slots
  assert.strictEqual(view.keptCount, 4);
  assert.strictEqual(view.potential, 4 + 16);
  assert.strictEqual(view.skipsLeft, 0, "must keep everything from here");
}

// ── pickups burn potential and are auto-decided ──
{
  const players = [P("a"), P("b", { pos: 2 })];
  const entries: Entry[] = [
    E("a", 1, null, { pickup: true, decided: true }),
    E("b", 1, 4),
  ];
  const view = buildTeamView(1, players, entries, holes, S, 0);
  // 0 kept + 1 undecided (b@1) + 34 future; the X contributes nothing ever
  assert.strictEqual(view.potential, 35);
  assert.strictEqual(view.pendingHole, 1);
}

// ── kept summary thru + reveal checkpoints ──
{
  const players = [P("a", { team: 2 }), P("b", { team: 2, pos: 2 })];
  const entries: Entry[] = [
    E("a", 1, 4, { kept: true, decided: true }), // par 4 -> E
    E("a", 5, 4, { kept: true, decided: true }), // par 5 -> -1
    E("b", 7, 4, { kept: true, decided: true }), // beyond thru
  ];
  const sum = keptSummaryThru(players, entries, holes, 6);
  assert.strictEqual(sum.keptCount, 2);
  assert.strictEqual(sum.toPar, -1);

  assert.strictEqual(revealCheckpoint(3, 8, 7), 6);
  assert.strictEqual(revealCheckpoint(3, 2, 9), 0);
  assert.strictEqual(revealCheckpoint(0, 18, 18), 0);
  assert.strictEqual(revealCheckpoint(9, 18, 18), 18);
}

// ── Old Bridge preset: valid card, par 71, five par 3s, 13 eligible holes ──
{
  assert.strictEqual(validateHoles(OLD_BRIDGE_HOLES), null);
  assert.strictEqual(
    OLD_BRIDGE_HOLES.reduce((a, h) => a + h.par, 0),
    71
  );
  assert.strictEqual(OLD_BRIDGE_HOLES.filter((h) => h.par === 3).length, 5);
  // 25 vs 10 low man = 15 strokes across 13 eligible holes -> two doubles
  const s = strokesForHandicap(25, 10, OLD_BRIDGE_HOLES, S);
  assert.strictEqual(s.reduce((a, b) => a + b, 0), 15);
  assert.strictEqual(s[16], 2, "SI 1 (hole 16) doubles");
  assert.strictEqual(s[8], 2, "SI 2 (hole 8) doubles");
  assert.strictEqual(s[3], 0, "par 3s get nothing by default");
  assert.strictEqual(s[7], 0, "hole 7 is a par 3 despite SI 6");

  // 42 vs 14 low man = 28 strokes over 13 eligible holes -> triple wrap:
  // 2 everywhere eligible, 3 on the two hardest (SI 1 and 2)
  const s42 = strokesForHandicap(42, 14, OLD_BRIDGE_HOLES, S);
  assert.strictEqual(s42.reduce((a, b) => a + b, 0), 28);
  assert.strictEqual(s42[16], 3, "SI 1 (hole 16) gets 3");
  assert.strictEqual(s42[8], 3, "SI 2 (hole 8) gets 3");
  assert.strictEqual(Math.max(...s42), 3);
  assert.strictEqual(s42.filter((n) => n === 3).length, 2);
  assert.strictEqual(s42.filter((n) => n === 2).length, 11);
  for (const h of [3, 7, 9, 11, 15]) assert.strictEqual(s42[h], 0, "no par-3 strokes");
}

// ── validation + legacy settings mapping ──
{
  assert.strictEqual(validateHoles(STANDARD_HOLES), null);
  const bad = STANDARD_HOLES.map((h) => ({ ...h, si: 1 }));
  assert.ok(validateHoles(bad));
  const s = normalizeSettings({ keepTarget: 99, revealEvery: 4 as never });
  assert.strictEqual(s.keepTarget, 36);
  assert.strictEqual(s.revealEvery, 0);
  assert.strictEqual(s.keepPolicy, "locked");
  assert.strictEqual(normalizeSettings({ lockKeeps: false }).keepPolicy, "flexible");
  assert.strictEqual(normalizeSettings({ keepPolicy: "flexible" }).keepPolicy, "flexible");
}

console.log("engine.test.ts: all assertions passed ✅");
