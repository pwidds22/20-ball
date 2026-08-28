// Parsing for api.golfcourseapi.com responses, kept pure (no fetch) so the
// shapes are unit-tested (scripts/courses.test.ts).
//
// History: the API originally returned full tee + hole data from /v1/search,
// and the search route built 18-hole cards straight from it. In Aug 2026 the
// API changed: /v1/search now carries per-gender tee COUNTS (`tees.male: 3`),
// ids became strings, and hole data moved to /v1/courses/{id}. Spreading a
// count as if it were an array 500'd every search — so these parsers assume
// nothing about the payload shape.

// Extension is explicit so `node --experimental-strip-types` can run the
// tests against this module (Next's bundler resolution accepts it too).
import { validateHoles, type HoleInfo } from "./engine.ts";

/** A search hit: enough to list and to fetch the card via /v1/courses/{id}. */
export type CourseSummary = { id: string; name: string; where: string };

/** One tee's 18-hole card. Rating/slope feed the roadmap's handicap work. */
export type CourseTee = {
  teeName: string;
  courseRating: number | null;
  slopeRating: number | null;
  holes: HoleInfo[];
};

export type CourseDetail = { name: string; where: string; tees: CourseTee[] };

type Rec = Record<string, unknown>;

const rec = (v: unknown): Rec | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null;

const finite = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** "Cimarron Golf Resort — Pebble", deduped when club and course names match. */
function courseName(c: Rec): string {
  return (
    [c.club_name, c.course_name]
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter((x) => x)
      .filter((x, i, a) => a.indexOf(x) === i)
      .join(" — ") || "Unnamed course"
  );
}

function courseWhere(c: Rec): string {
  const loc = rec(c.location);
  if (!loc) return "";
  return [loc.city, loc.state]
    .filter((x) => typeof x === "string" && x)
    .join(", ");
}

/** Tee count for one gender: the new API sends a number, the old an array. */
function teeCount(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (Array.isArray(v)) return v.length;
  return null;
}

/**
 * /v1/search response → list of courses to offer. Courses whose tee counts
 * are known to be zero can't produce a card and are dropped; anything with an
 * unreadable shape is skipped (or kept, when only the counts are missing)
 * rather than thrown on.
 */
export function parseSearchPayload(payload: unknown, limit = 10): CourseSummary[] {
  const courses = rec(payload)?.courses;
  if (!Array.isArray(courses)) return [];

  const out: CourseSummary[] = [];
  for (const raw of courses) {
    if (out.length >= limit) break;
    const c = rec(raw);
    if (!c) continue;
    const id =
      typeof c.id === "string" || typeof c.id === "number" ? String(c.id) : "";
    if (!id) continue; // no id → no way to fetch the card

    const tees = rec(c.tees);
    if (tees) {
      const male = teeCount(tees.male);
      const female = teeCount(tees.female);
      if (male !== null || female !== null) {
        if ((male ?? 0) + (female ?? 0) === 0) continue; // provably card-less
      }
    }
    out.push({ id, name: courseName(c), where: courseWhere(c) });
  }
  return out;
}

/** One /v1/courses/{id} tee → our 18-hole card, or null if unusable. */
function teeToHoles(tee: Rec): HoleInfo[] | null {
  if (!Array.isArray(tee.holes) || tee.holes.length !== 18) return null;
  const holes: HoleInfo[] = tee.holes.map((h, i) => {
    const r = rec(h);
    return { hole: i + 1, par: Number(r?.par), si: Number(r?.handicap) };
  });
  return validateHoles(holes) === null ? holes : null;
}

/**
 * /v1/courses/{id} response → course with its usable 18-hole tees (men's
 * listed first, matching the old auto-pick order). Null only when the payload
 * isn't a course object at all; a course with no usable tee returns tees: [].
 */
export function parseCoursePayload(payload: unknown): CourseDetail | null {
  const top = rec(payload);
  const c = rec(top?.course) ?? top;
  if (!c) return null;

  const teeGroups = rec(c.tees);
  const tees: CourseTee[] = [];
  for (const gender of ["male", "female"] as const) {
    const group = teeGroups?.[gender];
    if (!Array.isArray(group)) continue;
    for (const raw of group) {
      const tee = rec(raw);
      if (!tee) continue;
      const holes = teeToHoles(tee);
      if (!holes) continue;
      tees.push({
        teeName: typeof tee.tee_name === "string" ? tee.tee_name : "",
        courseRating: finite(tee.course_rating),
        slopeRating: finite(tee.slope_rating),
        holes,
      });
    }
  }
  return { name: courseName(c), where: courseWhere(c), tees };
}
