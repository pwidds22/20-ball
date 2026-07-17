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

/** Toggle whether a score is kept. Body: { playerId, hole, kept } */
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
    return jsonError(400, "This round is final.");

  const myTeam = memberTeam(bundle, session.userId);
  if (!myTeam) return jsonError(403, "You haven't joined this game.");

  const playerId = String(body.playerId ?? "");
  const hole = Number(body.hole);
  const kept = !!body.kept;

  const player = bundle.players.find((p) => p.id === playerId);
  if (!player || player.team !== myTeam)
    return jsonError(403, "You can only keep scores for your own team.");

  const entry = bundle.entries.find(
    (e) => e.playerId === playerId && e.hole === hole
  );
  if (!entry) return jsonError(400, "Enter a score first.");
  if (entry.pickup) return jsonError(400, "A pickup (X) can't be kept.");

  if (
    bundle.game.settings.lockKeeps &&
    hole < teamProgress(bundle, myTeam)
  ) {
    return jsonError(
      400,
      "Locked — your team already scored a later hole. (Lock keeps is on for this game.)"
    );
  }

  if (!kept) {
    await sql`
      update twentyball.scores set kept = false, updated_at = now()
      where player_id = ${playerId} and hole = ${hole}`;
    return NextResponse.json({ ok: true });
  }

  // Atomic guard against racing past the keep target from two phones.
  const updated = await sql`
    update twentyball.scores s
    set kept = true, updated_at = now()
    where s.player_id = ${playerId} and s.hole = ${hole} and s.pickup = false
      and (
        select count(*) from twentyball.scores sc
        join twentyball.players p on p.id = sc.player_id
        where sc.game_id = ${bundle.game.id} and p.team = ${myTeam} and sc.kept
          and not (sc.player_id = ${playerId} and sc.hole = ${hole})
      ) < ${bundle.game.settings.keepTarget}
    returning s.player_id`;

  if (updated.length === 0) {
    return jsonError(
      400,
      `Your team has already kept ${bundle.game.settings.keepTarget} scores — un-keep one first.`
    );
  }
  return NextResponse.json({ ok: true });
}
