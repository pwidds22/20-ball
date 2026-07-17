import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  jsonError,
  loadGameByCode,
  memberTeam,
  requireSession,
  teamEntries,
  teamKeptCount,
} from "@/lib/game-server";

export const dynamic = "force-dynamic";

/**
 * Finish the round (reveals both cards) or undo the finish.
 * Body: { force?: boolean, undo?: boolean }
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> }
) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { code } = await ctx.params;
  const body = (await req.json().catch(() => null)) ?? {};

  const bundle = await loadGameByCode(code);
  if (!bundle) return jsonError(404, "No game with that code.");

  const myTeam = memberTeam(bundle, session.userId);
  if (!myTeam) return jsonError(403, "You haven't joined this game.");

  if (body.undo) {
    if (bundle.game.status !== "final") return NextResponse.json({ ok: true });
    await sql`
      update twentyball.games set status = 'active', finalized_at = null
      where id = ${bundle.game.id}`;
    return NextResponse.json({ ok: true });
  }

  if (bundle.game.status === "final") return NextResponse.json({ ok: true });

  const warnings: string[] = [];
  for (const team of [1, 2]) {
    const entries = teamEntries(bundle, team);
    if (entries.length < 36)
      warnings.push(`Team ${team} has ${36 - entries.length} score(s) not entered.`);
    const undecided = entries.filter((e) => !e.decided).length;
    if (undecided > 0)
      warnings.push(`Team ${team} has ${undecided} score(s) not locked in.`);
    const kept = teamKeptCount(bundle, team);
    if (kept !== bundle.game.settings.keepTarget)
      warnings.push(
        `Team ${team} kept ${kept}/${bundle.game.settings.keepTarget} scores.`
      );
  }

  if (warnings.length > 0 && !body.force) {
    return NextResponse.json({ warnings }, { status: 409 });
  }

  await sql`
    update twentyball.scores set decided = true
    where game_id = ${bundle.game.id} and decided = false`;
  await sql`
    update twentyball.games set status = 'final', finalized_at = now()
    where id = ${bundle.game.id}`;
  return NextResponse.json({ ok: true });
}
