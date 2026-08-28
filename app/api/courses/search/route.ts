import { NextRequest, NextResponse } from "next/server";
import { GOLF_COURSE_API_KEY } from "@/lib/config";
import { jsonError, requireSession } from "@/lib/game-server";
import { parseSearchPayload } from "@/lib/golfcourseapi";

export const dynamic = "force-dynamic";

/**
 * Search courses by name/city. Returns {enabled:false} until a key is set.
 * Hits are name + location only — the upstream search stopped carrying hole
 * data (Aug 2026), so the card is fetched from /api/courses/[id] on pick.
 */
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  if (!GOLF_COURSE_API_KEY) {
    return NextResponse.json({ enabled: false, courses: [] });
  }

  const q = String(req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 3)
    return NextResponse.json({ enabled: true, courses: [] });

  let payload: unknown;
  try {
    const res = await fetch(
      `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(q)}`,
      {
        headers: { Authorization: `Key ${GOLF_COURSE_API_KEY}` },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      return jsonError(502, `Course search failed (${res.status}).`);
    }
    payload = await res.json();
  } catch {
    return jsonError(502, "Course search is unreachable right now.");
  }

  return NextResponse.json({ enabled: true, courses: parseSearchPayload(payload) });
}
