import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  insertAlert,
  jsonError,
  loadGameByCode,
  memberTeam,
  requireSession,
  startHoleOf,
  teamEntries,
  teamPendingHole,
  teamPlayers,
} from "@/lib/game-server";
import { orderIndex } from "@/lib/engine";

export const dynamic = "force-dynamic";

/**
 * Lock in the keep/skip decisions for one hole (the whole hole at once),
 * or — under the "flexible" policy — change an already-locked decision,
 * which raises an alert the other team can see.
 *
 * Body: { hole, decisions: [{ playerId, keep: boolean }] }
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> }
) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { code } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.decisions) || body.decisions.length === 0)
    return jsonError(400, "Bad request.");

  const bundle = await loadGameByCode(code);
  if (!bundle) return jsonError(404, "No game with that code.");
  if (bundle.game.status !== "active")
    return jsonError(400, "This round is final.");

  const myTeam = memberTeam(bundle, session.userId);
  if (!myTeam) return jsonError(403, "You haven't joined this game.");

  const hole = Number(body.hole);
  if (!Number.isInteger(hole) || hole < 1 || hole > 18)
    return jsonError(400, "Hole must be 1-18.");

  const { settings } = bundle.game;
  const locked = settings.keepPolicy === "locked";
  const myEntries = teamEntries(bundle, myTeam);
  const holeEntries = myEntries.filter((e) => e.hole === hole);
  const playersById = new Map(bundle.players.map((p) => [p.id, p]));

  type Decision = { playerId: string; keep: boolean };
  const decisions: Decision[] = [];
  for (const d of body.decisions as Decision[]) {
    const player = playersById.get(String(d?.playerId));
    if (!player || player.team !== myTeam)
      return jsonError(403, "You can only decide your own team's scores.");
    decisions.push({ playerId: player.id, keep: !!d.keep });
  }

  const initial: Decision[] = [];
  const changes: Decision[] = [];
  for (const d of decisions) {
    const entry = holeEntries.find((e) => e.playerId === d.playerId);
    if (!entry) return jsonError(400, "Enter that score first.");
    if (entry.pickup)
      return jsonError(400, "An X can't be kept — nothing to decide.");
    if (entry.decided) {
      if (entry.kept === d.keep) continue; // no-op
      changes.push(d);
    } else {
      initial.push(d);
    }
  }

  if (changes.length > 0 && locked)
    return jsonError(
      400,
      "Decisions are final in this game — no take-backs."
    );

  if (initial.length > 0) {
    // Must decide the whole hole at once, and (locked policy) in play order.
    if (locked) {
      const start = startHoleOf(bundle, myTeam);
      const pending = teamPendingHole(bundle, myTeam);
      if (
        pending !== null &&
        orderIndex(pending, start) < orderIndex(hole, start)
      )
        return jsonError(400, `Lock in hole ${pending} first.`);
    }
    // Everyone on the team must have posted something before the hole can be
    // locked: a real score, or an X if they picked up. Locking while a teammate
    // has no entry strands that score permanently — under the locked policy the
    // hole falls behind decidedThruOrder and can never be filled in.
    const noEntry = teamPlayers(bundle, myTeam).filter(
      (p) => !holeEntries.some((e) => e.playerId === p.id)
    );
    if (noEntry.length > 0) {
      const who = noEntry.map((p) => p.name).join(" and ");
      return jsonError(
        400,
        `Enter a score for ${who} on hole ${hole} first — or mark an X if ` +
          `they picked up.`
      );
    }
    const undecidedHere = holeEntries.filter((e) => !e.decided && !e.pickup);
    const covered = new Set(initial.map((d) => d.playerId));
    for (const e of undecidedHere) {
      if (!covered.has(e.playerId))
        return jsonError(
          400,
          "Decide keep-or-skip for every score on the hole."
        );
    }
  }

  if (initial.length === 0 && changes.length === 0)
    return NextResponse.json({ ok: true });

  // Keep-target guard on the resulting total.
  const keptNow = myEntries.filter((e) => e.kept).length;
  let delta = 0;
  for (const d of initial) if (d.keep) delta++;
  for (const d of changes) delta += d.keep ? 1 : -1;
  if (keptNow + delta > settings.keepTarget)
    return jsonError(
      400,
      `That would put you at ${keptNow + delta}/${settings.keepTarget} kept — too many.`
    );

  await sql.begin(async (tx) => {
    for (const d of [...initial, ...changes]) {
      await tx`
        update twentyball.scores
        set kept = ${d.keep}, decided = true, updated_at = now()
        where player_id = ${d.playerId} and hole = ${hole}`;
    }
  });

  for (const d of changes) {
    const player = playersById.get(d.playerId)!;
    const entry = holeEntries.find((e) => e.playerId === d.playerId)!;
    await insertAlert(
      bundle.game.id,
      myTeam,
      `Team ${myTeam} changed ${player.name}'s hole ${hole} (${entry.gross}) from ${d.keep ? "SKIP to KEEP" : "KEEP to SKIP"}.`
    );
  }

  return NextResponse.json({ ok: true });
}
