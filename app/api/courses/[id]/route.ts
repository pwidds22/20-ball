import { NextRequest, NextResponse } from "next/server";
import { GOLF_COURSE_API_KEY } from "@/lib/config";
import { jsonError, requireSession } from "@/lib/game-server";
import { parseCoursePayload } from "@/lib/golfcourseapi";

export const dynamic = "force-dynamic";

/**
 * One course's usable 18-hole tees (name, rating, slope, holes), fetched when
 * a search hit is picked. `tees` can be empty — not every course in the
 * upstream data has a full card.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  if (!GOLF_COURSE_API_KEY) {
    return jsonError(503, "Course search isn't switched on right now.");
  }

  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) {
    return jsonError(400, "That course id doesn't look right.");
  }

  let payload: unknown;
  try {
    const res = await fetch(`https://api.golfcourseapi.com/v1/courses/${id}`, {
      headers: { Authorization: `Key ${GOLF_COURSE_API_KEY}` },
      cache: "no-store",
    });
    if (res.status === 404) return jsonError(404, "Course not found.");
    if (!res.ok) {
      return jsonError(502, `Course lookup failed (${res.status}).`);
    }
    payload = await res.json();
  } catch {
    return jsonError(502, "Course lookup is unreachable right now.");
  }

  const detail = parseCoursePayload(payload);
  if (!detail) return jsonError(502, "Course data was unreadable.");
  return NextResponse.json(detail);
}
