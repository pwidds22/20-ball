import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  jsonError,
  loadGameByCode,
  memberTeam,
  requireSession,
  teamDone,
  teamEntries,
  teamKeptCount,
} from "@/lib/game-server";

export const dynamic = "force-dynamic";

/**
 * Finish for YOUR team (locks in your card, shows your recap; the other team
 * stays hidden until they finish too — only then does the full reveal happen),
 * or undo your team's finish.
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
  const doneCol = myTeam === 1 ? "team1_done" : "team2_done";

  if (body.undo) {
    // Reopen our card. If the game had fully revealed, drop it back to active.
    await sql`
      update twentyball.games
      set status = 'active', finalized_at = null,
          ${sql(doneCol)} = false
      where id = ${bundle.game.id}`;
    return NextResponse.json({ ok: true });
  }

  if (teamDone(bundle, myTeam)) return NextResponse.json({ ok: true });

  // Warn only about OUR team's own card — never block on the other team.
  const warnings: string[] = [];
  const slots = bundle.players.filter((p) => p.team === myTeam).length * 18;
  const entries = teamEntries(bundle, myTeam);
  if (entries.length < slots)
    warnings.push(`Your team has ${slots - entries.length} score(s) not entered.`);
  const undecided = entries.filter((e) => !e.decided).length;
  if (undecided > 0)
    warnings.push(`Your team has ${undecided} score(s) not locked in.`);
  const kept = teamKeptCount(bundle, myTeam);
  if (kept !== bundle.game.settings.keepTarget)
    warnings.push(
      `Your team kept ${kept}/${bundle.game.settings.keepTarget} scores.`
    );

  if (warnings.length > 0 && !body.force) {
    return NextResponse.json({ warnings }, { status: 409 });
  }

  // Sweep our still-undecided scores to decided (skipped) so our card is clean,
  // then mark our team done.
  const playerIds = bundle.players
    .filter((p) => p.team === myTeam)
    .map((p) => p.id);
  await sql`
    update twentyball.scores set decided = true
    where game_id = ${bundle.game.id}
      and player_id = any(${playerIds}) and decided = false`;
  await sql`
    update twentyball.games set ${sql(doneCol)} = true
    where id = ${bundle.game.id}`;

  // If the other team is already done, the whole game reveals now.
  const bothDone = teamDone(bundle, 3 - myTeam);
  if (bothDone) {
    await sql`
      update twentyball.games set status = 'final', finalized_at = now()
      where id = ${bundle.game.id}`;
  }

  return NextResponse.json({ ok: true, bothDone });
}
