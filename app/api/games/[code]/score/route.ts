import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  jsonError,
  loadGameByCode,
  memberTeam,
  requireSession,
  teamProgress,
} from "@/lib/game-server";

export const dynamic = "force-dynamic";

/**
 * Enter / edit / clear a gross score, or mark a pickup (X).
 * Body: { playerId, hole, gross } | { playerId, hole, pickup: true } | { playerId, hole, clear: true }
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> }
) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { code } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body) return jsonError(400, "Bad request.");

  const bundle = await loadGameByCode(code);
  if (!bundle) return jsonError(404, "No game with that code.");
  if (bundle.game.status !== "active")
    return jsonError(400, "This round is final — undo the finish to edit.");

  const myTeam = memberTeam(bundle, session.userId);
  if (!myTeam) return jsonError(403, "You haven't joined this game.");

  const playerId = String(body.playerId ?? "");
  const player = bundle.players.find((p) => p.id === playerId);
  if (!player) return jsonError(400, "Unknown player.");
  if (player.team !== myTeam)
    return jsonError(403, "You can only enter scores for your own team.");

  const hole = Number(body.hole);
  if (!Number.isInteger(hole) || hole < 1 || hole > 18)
    return jsonError(400, "Hole must be 1-18.");

  const existing = bundle.entries.find(
    (e) => e.playerId === playerId && e.hole === hole
  );
  const locked =
    bundle.game.settings.lockKeeps && hole < teamProgress(bundle, myTeam);

  if (body.clear) {
    if (!existing) return NextResponse.json({ ok: true });
    if (existing.kept && locked)
      return jsonError(400, "That score is locked in — it already counts.");
    await sql`
      delete from twentyball.scores
      where player_id = ${playerId} and hole = ${hole}`;
    return NextResponse.json({ ok: true });
  }

  if (body.pickup) {
    if (existing?.kept && locked)
      return jsonError(400, "That score is locked in — it already counts.");
    await sql`
      insert into twentyball.scores (game_id, player_id, hole, gross, pickup, kept)
      values (${bundle.game.id}, ${playerId}, ${hole}, null, true, false)
      on conflict (player_id, hole)
      do update set gross = null, pickup = true, kept = false, updated_at = now()`;
    return NextResponse.json({ ok: true });
  }

  const gross = Number(body.gross);
  if (!Number.isInteger(gross) || gross < 1 || gross > 20)
    return jsonError(400, "Score must be 1-20.");

  // Gross edits are always allowed (honest corrections); the kept flag survives.
  await sql`
    insert into twentyball.scores (game_id, player_id, hole, gross, pickup)
    values (${bundle.game.id}, ${playerId}, ${hole}, ${gross}, false)
    on conflict (player_id, hole)
    do update set gross = ${gross}, pickup = false, updated_at = now()`;
  return NextResponse.json({ ok: true });
}
