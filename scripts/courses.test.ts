// Unit checks for the golfcourseapi.com response parsers.
// Run with: node --experimental-strip-types scripts/courses.test.ts

import assert from "node:assert";
import { STANDARD_HOLES } from "../lib/engine.ts";
import {
  parseCoursePayload,
  parseSearchPayload,
} from "../lib/golfcourseapi.ts";

// Real /v1/search shape since Aug 2026: string ids, tees are COUNTS. The old
// route spread `tees.male` as an array and threw
// "((intermediate value) ?? []) is not iterable" — a 500 on every search.
const searchPayload = {
  courses: [
    {
      id: "j7rt0gct",
      club_name: "Cimarron Golf Resort",
      course_name: "Pebble",
      location: { address: "67603 30th Ave", city: "Cathedral City", state: "CA" },
      tees: { female: 3, male: 3 },
    },
    { id: "zerotees", club_name: "Range Only", tees: { female: 0, male: 0 } },
    { club_name: "No Id Course", tees: { male: 2 } }, // unfetchable → dropped
    { id: 4321, club_name: "Pebble", course_name: "Pebble", tees: { male: 1 } },
    { id: "notees", club_name: "Counts Missing" }, // fail open → kept
    null,
    "garbage",
  ],
};

{
  const hits = parseSearchPayload(searchPayload);
  assert.deepStrictEqual(
    hits.map((h) => h.id),
    ["j7rt0gct", "4321", "notees"]
  );
  assert.strictEqual(hits[0].name, "Cimarron Golf Resort — Pebble");
  assert.strictEqual(hits[0].where, "Cathedral City, CA");
  assert.strictEqual(hits[1].name, "Pebble"); // deduped club/course name
}

// Pre-Aug-2026 shape (tees as arrays) still lists.
{
  const hits = parseSearchPayload({
    courses: [{ id: 7, club_name: "Old Shape GC", tees: { male: [{}], female: [] } }],
  });
  assert.deepStrictEqual(hits.map((h) => h.id), ["7"]);
}

// Junk payloads: never throw, just return nothing.
for (const junk of [null, 42, "no", {}, { courses: "nope" }, { courses: null }]) {
  assert.deepStrictEqual(parseSearchPayload(junk), []);
}

// Result cap.
{
  const many = {
    courses: Array.from({ length: 30 }, (_, i) => ({ id: `c${i}`, club_name: "X" })),
  };
  assert.strictEqual(parseSearchPayload(many).length, 10);
}

// ── course detail ──

const goodHoles = STANDARD_HOLES.map((h) => ({
  par: h.par,
  yardage: 400,
  handicap: h.si,
}));
const nineHoles = goodHoles.slice(0, 9);
const dupSiHoles = goodHoles.map((h) => ({ ...h, handicap: 1 }));

// Real /v1/courses/{id} shape: full tees per gender, rating + slope per tee.
const detailPayload = {
  course: {
    id: "j7rt0gct",
    club_name: "Cimarron Golf Resort",
    course_name: "Pebble",
    location: { city: "Cathedral City", state: "CA" },
    tees: {
      female: [
        { tee_name: "Red", course_rating: 68.4, slope_rating: 115, number_of_holes: 18, holes: goodHoles },
      ],
      male: [
        { tee_name: "Executive", number_of_holes: 9, holes: nineHoles },
        { tee_name: "Blue", course_rating: 70.1, slope_rating: 125, number_of_holes: 18, holes: goodHoles },
        { tee_name: "Broken", course_rating: 69.0, slope_rating: 120, number_of_holes: 18, holes: dupSiHoles },
      ],
    },
  },
};

{
  const d = parseCoursePayload(detailPayload);
  assert.ok(d);
  assert.strictEqual(d.name, "Cimarron Golf Resort — Pebble");
  // Only usable 18-hole tees survive, men's first (the old auto-pick order).
  assert.deepStrictEqual(d.tees.map((t) => t.teeName), ["Blue", "Red"]);
  assert.strictEqual(d.tees[0].courseRating, 70.1);
  assert.strictEqual(d.tees[0].slopeRating, 125);
  assert.strictEqual(d.tees[0].holes.length, 18);
  assert.deepStrictEqual(d.tees[0].holes[3], { hole: 4, par: 4, si: 1 });
}

// Unwrapped course object (no {course: ...} envelope) parses the same.
{
  const d = parseCoursePayload(detailPayload.course);
  assert.ok(d && d.tees.length === 2);
}

// A search-shaped course (tee counts, no hole data) → tees: [], not a throw.
{
  const d = parseCoursePayload(searchPayload.courses[0]);
  assert.ok(d);
  assert.deepStrictEqual(d.tees, []);
  assert.strictEqual(d.name, "Cimarron Golf Resort — Pebble");
}

// Junk detail payloads: null out instead of throwing.
for (const junk of [null, 9, "no"]) {
  assert.strictEqual(parseCoursePayload(junk), null);
}
{
  const d = parseCoursePayload({ course: { tees: { male: "3" } } });
  assert.ok(d && d.tees.length === 0);
}
{
  const d = parseCoursePayload({
    course: { tees: { male: [{ tee_name: "NoHoles" }, null, { holes: "x" }] } },
  });
  assert.ok(d && d.tees.length === 0);
}

console.log("courses.test.ts: all assertions passed");
