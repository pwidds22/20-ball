import { NextRequest, NextResponse } from "next/server";
import { jsonError, loadGameByCode, memberTeam, requireSession } from "@/lib/game-server";

export const dynamic = "force-dynamic";

/** Public-to-signed-in preview of a game, used by the join screen. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ code: string }> }
) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { code } = await ctx.params;
  const bundle = await loadGameByCode(code);
  if (!bundle) return jsonError(404, "No game with that code.");

  return NextResponse.json({
    code: bundle.game.code,
    name: bundle.game.name,
    status: bundle.game.status,
    players: bundle.players.map((p) => {
      const claim = bundle.members.find((m) => m.player_id === p.id);
      return {
        id: p.id,
        name: p.name,
        handicap: p.handicap,
        team: p.team,
        // Someone else's phone is already on this golfer.
        taken: !!claim && claim.user_id !== session.userId,
        isYou: !!claim && claim.user_id === session.userId,
      };
    }),
    memberCounts: {
      1: bundle.members.filter((m) => m.team === 1).length,
      2: bundle.members.filter((m) => m.team === 2).length,
    },
    yourTeam: memberTeam(bundle, session.userId),
    yourPlayerId:
      bundle.members.find((m) => m.user_id === session.userId)?.player_id ??
      null,
  });
}
