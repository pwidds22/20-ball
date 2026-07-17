import { NextRequest, NextResponse } from "next/server";
import { GOLF_COURSE_API_KEY } from "@/lib/config";
import { jsonError, requireSession } from "@/lib/game-server";
import { validateHoles, type HoleInfo } from "@/lib/engine";

export const dynamic = "force-dynamic";

type ApiTee = {
  tee_name?: string;
  number_of_holes?: number;
  holes?: { par?: number; yardage?: number; handicap?: number }[];
};
type ApiCourse = {
  id?: number;
  club_name?: string;
  course_name?: string;
  location?: { city?: string; state?: string };
  tees?: { male?: ApiTee[]; female?: ApiTee[] };
};

/** Turn a golfcourseapi.com tee into our 18-hole card, or null if unusable. */
function teeToHoles(tee: ApiTee): HoleInfo[] | null {
  if (!Array.isArray(tee.holes) || tee.holes.length !== 18) return null;
  const holes: HoleInfo[] = tee.holes.map((h, i) => ({
    hole: i + 1,
    par: Number(h?.par),
    si: Number(h?.handicap),
  }));
  return validateHoles(holes) === null ? holes : null;
}

/** Search courses by name/city. Returns {enabled:false} until a key is set. */
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  if (!GOLF_COURSE_API_KEY) {
    return NextResponse.json({ enabled: false, courses: [] });
  }

  const q = String(req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 3)
    return NextResponse.json({ enabled: true, courses: [] });

  let payload: { courses?: ApiCourse[] };
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

  const courses = (payload.courses ?? [])
    .slice(0, 12)
    .map((c) => {
      const tees = [...(c.tees?.male ?? []), ...(c.tees?.female ?? [])];
      let holes: HoleInfo[] | null = null;
      for (const tee of tees) {
        holes = teeToHoles(tee);
        if (holes) break;
      }
      const name = [c.club_name, c.course_name]
        .filter((x) => x && x.trim())
        .filter((x, i, a) => a.indexOf(x) === i)
        .join(" — ");
      const where = [c.location?.city, c.location?.state]
        .filter(Boolean)
        .join(", ");
      return { id: c.id, name: name || "Unnamed course", where, holes };
    })
    .filter((c) => c.holes !== null)
    .slice(0, 8);

  return NextResponse.json({ enabled: true, courses });
}
