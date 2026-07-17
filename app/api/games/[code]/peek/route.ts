import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  jsonError,
  loadGameByCode,
  memberTeam,
  peeksUsed,
  requireSession,
  teamEntries,
  teamPlayers,
  teamProgress,
} from "@/lib/game-server";
import { keptSummaryThru } from "@/lib/engine";

export const dynamic = "force-dynamic";

/** Burn one of the team's peeks to see the opponent's kept summary right now. */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ code: string }> }
) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { code } = await ctx.params;
  const bundle = await loadGameByCode(code);
  if (!bundle) return jsonError(404, "No game with that code.");
  if (bundle.game.status !== "active")
    return jsonError(400, "This round is final — the full card is visible.");

  const myTeam = memberTeam(bundle, session.userId);
  if (!myTeam) return jsonError(403, "You haven't joined this game.");

  const left = bundle.game.settings.peeksPerTeam - peeksUsed(bundle, myTeam);
  if (left <= 0) return jsonError(400, "Your team is out of peeks.");

  const oppTeam = 3 - myTeam;
  const thru = teamProgress(bundle, oppTeam);
  const summary = keptSummaryThru(
    teamPlayers(bundle, oppTeam),
    teamEntries(bundle, oppTeam),
    bundle.game.holes,
    18
  );

  const snapshot = { keptCount: summary.keptCount, toPar: summary.toPar };
  await sql`
    insert into twentyball.peeks (game_id, team, thru, snapshot)
    values (${bundle.game.id}, ${myTeam}, ${thru}, ${JSON.stringify(snapshot)}::jsonb)`;

  return NextResponse.json({ peek: { thru, ...snapshot } });
}
