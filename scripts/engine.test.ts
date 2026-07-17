// Unit checks for the 20 Ball engine.
// Run with: node --experimental-strip-types scripts/engine.test.ts

import assert from "node:assert";
import {
  DEFAULT_SETTINGS,
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

// ── strokes: the user's exact example (10, 15, 20, 25 handicaps) ──
{
  const s10 = strokesForHandicap(10, 10, holes, S);
  assert.strictEqual(s10.reduce((a, b) => a + b, 0), 0, "low man gets 0");

  const s15 = strokesForHandicap(15, 10, holes, S);
  assert.strictEqual(s15.reduce((a, b) => a + b, 0), 5, "15 hcp gets 5 strokes");
  // strokes fall on the 5 hardest NON-par-3 holes
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
  const players: PlayerInfo[] = [
    { id: "a", team: 1, pos: 1, name: "A", handicap: 10, strokes: new Array(19).fill(0) },
    { id: "b", team: 1, pos: 2, name: "B", handicap: 10, strokes: new Array(19).fill(0) },
  ];
  const entries: Entry[] = [
    { playerId: "a", hole: 1, gross: 3, pickup: false, kept: true }, // birdie (par 4)
    { playerId: "b", hole: 1, gross: 4, pickup: false, kept: true }, // par
    { playerId: "a", hole: 2, gross: 4, pickup: false, kept: true }, // par
    { playerId: "b", hole: 2, gross: 6, pickup: false, kept: false }, // skipped
    { playerId: "a", hole: 3, gross: 5, pickup: false, kept: false }, // undecided (current)
  ];
  const view = buildTeamView(1, players, entries, holes, S, 1);
  assert.strictEqual(view.keptCount, 3);
  assert.strictEqual(view.toPar, -1);
  assert.strictEqual(view.progress, 3);
  // locked: entries on holes < 3 are locked (lockKeeps on)
  assert.strictEqual(view.cells["b"][2].locked, true);
  assert.strictEqual(view.cells["a"][3].locked, false);
  // potential: 3 kept + 1 decidable (a@3) + unscored (b@3 = 1, both 4..18 = 30) = 35
  assert.strictEqual(view.potential, 3 + 1 + 1 + 30);
  assert.strictEqual(view.skipsLeft, 35 - 20);
}

// ── forced-keep pressure: no skips left ──
{
  const strokes = new Array(19).fill(0);
  const players: PlayerInfo[] = [
    { id: "a", team: 1, pos: 1, name: "A", handicap: 0, strokes },
    { id: "b", team: 1, pos: 2, name: "B", handicap: 0, strokes },
  ];
  // Through 10 holes both players scored, only 4 kept, everything else skipped/locked.
  const entries: Entry[] = [];
  for (let h = 1; h <= 10; h++) {
    entries.push({ playerId: "a", hole: h, gross: 5, pickup: false, kept: h <= 2 });
    entries.push({ playerId: "b", hole: h, gross: 5, pickup: false, kept: h <= 2 });
  }
  const view = buildTeamView(1, players, entries, holes, S, 0);
  // kept 4; hole 10 (current hole) stays decidable = 2; 8 unscored holes x 2 = 16.
  // Locked skips on holes 1-9 are gone for good.
  assert.strictEqual(view.keptCount, 4);
  assert.strictEqual(view.potential, 4 + 2 + 16);
  assert.strictEqual(view.skipsLeft, 2, "only two declines left");
}

// ── pickups burn potential ──
{
  const strokes = new Array(19).fill(0);
  const players: PlayerInfo[] = [
    { id: "a", team: 1, pos: 1, name: "A", handicap: 0, strokes },
    { id: "b", team: 1, pos: 2, name: "B", handicap: 0, strokes },
  ];
  const entries: Entry[] = [
    { playerId: "a", hole: 1, gross: null, pickup: true, kept: false },
    { playerId: "b", hole: 1, gross: 4, pickup: false, kept: false },
  ];
  const view = buildTeamView(1, players, entries, holes, S, 0);
  // potential = 0 kept + 1 decidable (b@1) + 34 unscored = 35 (pickup contributes nothing)
  assert.strictEqual(view.potential, 35);
}

// ── kept summary thru + reveal checkpoints ──
{
  const strokes = new Array(19).fill(0);
  const players: PlayerInfo[] = [
    { id: "a", team: 2, pos: 1, name: "A", handicap: 0, strokes },
    { id: "b", team: 2, pos: 2, name: "B", handicap: 0, strokes },
  ];
  const entries: Entry[] = [
    { playerId: "a", hole: 1, gross: 4, pickup: false, kept: true }, // par 4 -> E
    { playerId: "a", hole: 5, gross: 4, pickup: false, kept: true }, // par 5 -> -1
    { playerId: "b", hole: 7, gross: 4, pickup: false, kept: true }, // beyond thru
  ];
  const sum = keptSummaryThru(players, entries, holes, 6);
  assert.strictEqual(sum.keptCount, 2);
  assert.strictEqual(sum.toPar, -1);

  assert.strictEqual(revealCheckpoint(3, 8, 7), 6);
  assert.strictEqual(revealCheckpoint(3, 2, 9), 0);
  assert.strictEqual(revealCheckpoint(0, 18, 18), 0);
  assert.strictEqual(revealCheckpoint(9, 18, 18), 18);
}

// ── validation ──
{
  assert.strictEqual(validateHoles(STANDARD_HOLES), null);
  const bad = STANDARD_HOLES.map((h) => ({ ...h, si: 1 }));
  assert.ok(validateHoles(bad));
  const s = normalizeSettings({ keepTarget: 99, revealEvery: 4 as never });
  assert.strictEqual(s.keepTarget, 36);
  assert.strictEqual(s.revealEvery, 0);
}

console.log("engine.test.ts: all assertions passed ✅");
