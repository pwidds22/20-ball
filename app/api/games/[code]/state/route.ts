import { NextRequest, NextResponse } from "next/server";
import {
  buildState,
  jsonError,
  loadGameByCode,
  memberTeam,
  requireSession,
} from "@/lib/game-server";

export const dynamic = "force-dynamic";

/** The polled game state, redacted for the viewer's team. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ code: string }> }
) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { code } = await ctx.params;
  const bundle = await loadGameByCode(code);
  if (!bundle) return jsonError(404, "No game with that code.");
  if (!memberTeam(bundle, session.userId)) {
    return NextResponse.json(
      { error: "You haven't joined this game.", needsJoin: true },
      { status: 403 }
    );
  }

  return NextResponse.json(buildState(bundle, session));
}
