import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  insertAlert,
  jsonError,
  loadGameByCode,
  memberTeam,
  requireSession,
  teamDecidedThru,
  teamPendingHole,
  teamProgress,
} from "@/lib/game-server";

export const dynamic = "force-dynamic";

/**
 * Enter / edit / clear a gross score, or mark a pickup (X).
 * Body: { playerId, hole, gross } | { playerId, hole, pickup: true } | { playerId, hole, clear: true }
 *
 * Keep-policy rules:
 *  - "locked": a decided score is immutable, and no new scores may be entered
 *    on holes at/behind the team's locked position or ahead of an undecided hole.
 *  - "flexible": anything goes, but touching a decided score (or backfilling a
 *    past hole) raises an alert the other team can see.
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

  const locked = bundle.game.settings.keepPolicy === "locked";
  const existing = bundle.entries.find(
    (e) => e.playerId === playerId && e.hole === hole
  );
  const decidedThru = teamDecidedThru(bundle, myTeam);
  const pendingHole = teamPendingHole(bundle, myTeam);
  const teamLabel = `Team ${myTeam}`;

  // Touching an already-decided score.
  if (existing?.decided) {
    if (locked)
      return jsonError(
        400,
        `Hole ${hole} is locked in — decisions are final in this game.`
      );
    // flexible: allow, but tell on them.
    const wasLabel = existing.kept ? "a KEPT score" : "a skipped score";
    if (body.clear) {
      await sql`
        delete from twentyball.scores
        where player_id = ${playerId} and hole = ${hole}`;
      await insertAlert(
        bundle.game.id,
        myTeam,
        `${teamLabel} deleted ${player.name}'s locked hole ${hole} score (${existing.pickup ? "X" : existing.gross}, ${wasLabel}).`
      );
      return NextResponse.json({ ok: true });
    }
    if (body.pickup) {
      await sql`
        update twentyball.scores
        set gross = null, pickup = true, kept = false, decided = true, updated_at = now()
        where player_id = ${playerId} and hole = ${hole}`;
      await insertAlert(
        bundle.game.id,
        myTeam,
        `${teamLabel} changed ${player.name}'s locked hole ${hole} score (${existing.gross}, ${wasLabel}) to an X.`
      );
      return NextResponse.json({ ok: true });
    }
    const gross = Number(body.gross);
    if (!Number.isInteger(gross) || gross < 1 || gross > 20)
      return jsonError(400, "Score must be 1-20.");
    await sql`
      update twentyball.scores
      set gross = ${gross}, pickup = false, updated_at = now()
      where player_id = ${playerId} and hole = ${hole}`;
    await insertAlert(
      bundle.game.id,
      myTeam,
      `${teamLabel} changed ${player.name}'s locked hole ${hole} score from ${existing.pickup ? "X" : existing.gross} to ${gross} (${wasLabel}).`
    );
    return NextResponse.json({ ok: true });
  }

  // Clearing or editing an undecided entry is always free.
  if (body.clear) {
    if (!existing) return NextResponse.json({ ok: true });
    await sql`
      delete from twentyball.scores
      where player_id = ${playerId} and hole = ${hole}`;
    return NextResponse.json({ ok: true });
  }

  // Brand-new entry: enforce the no-backfill / decide-first cadence.
  if (!existing && locked) {
    if (hole <= decidedThru)
      return jsonError(
        400,
        `Hole ${hole} is closed — your team already locked in hole ${decidedThru}.`
      );
    if (pendingHole !== null && hole > pendingHole)
      return jsonError(
        400,
        `Lock in hole ${pendingHole} first — decisions are final before you move on.`
      );
  }
  if (!existing && !locked) {
    const progress = teamProgress(bundle, myTeam);
    if (hole < progress)
      await insertAlert(
        bundle.game.id,
        myTeam,
        `${teamLabel} went back and added a score for ${player.name} on hole ${hole}.`
      );
  }

  if (body.pickup) {
    // An X can never be kept, so it's decided the moment it happens.
    await sql`
      insert into twentyball.scores (game_id, player_id, hole, gross, pickup, kept, decided)
      values (${bundle.game.id}, ${playerId}, ${hole}, null, true, false, true)
      on conflict (player_id, hole)
      do update set gross = null, pickup = true, kept = false, decided = true, updated_at = now()`;
    return NextResponse.json({ ok: true });
  }

  const gross = Number(body.gross);
  if (!Number.isInteger(gross) || gross < 1 || gross > 20)
    return jsonError(400, "Score must be 1-20.");

  await sql`
    insert into twentyball.scores (game_id, player_id, hole, gross, pickup)
    values (${bundle.game.id}, ${playerId}, ${hole}, ${gross}, false)
    on conflict (player_id, hole)
    do update set gross = ${gross}, pickup = false, updated_at = now()`;
  return NextResponse.json({ ok: true });
}
