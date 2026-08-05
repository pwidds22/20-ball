import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { jsonError, loadGameByCode, requireSession } from "@/lib/game-server";

export const dynamic = "force-dynamic";

/**
 * Join a game by claiming the golfer you're playing as. Body: { code, playerId }
 *
 * You pick a PLAYER, never a team — the team is read off the roster. Picking a
 * team directly is what let someone join the side their golfer wasn't on: the
 * app then served them the opponents' card as their own and redacted their real
 * scores as opponent data, with score entry 403ing. Deriving team from the
 * roster makes that state unrepresentable.
 */
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase();
  const playerId = String(body?.playerId ?? "");
  if (!code) return jsonError(400, "Enter a game code.");
  if (!playerId) return jsonError(400, "Pick which player you are.");

  const bundle = await loadGameByCode(code);
  if (!bundle) return jsonError(404, "No game with that code.");

  const player = bundle.players.find((p) => p.id === playerId);
  if (!player) return jsonError(400, "That player isn't in this game.");

  const takenBy = bundle.members.find(
    (m) => m.player_id === playerId && m.user_id !== session.userId
  );
  if (takenBy)
    return jsonError(
      409,
      `${player.name} is already claimed by another phone. Pick the player you're actually playing as.`
    );

  await sql`
    insert into twentyball.members (game_id, user_id, team, player_id)
    values (${bundle.game.id}, ${session.userId}, ${player.team}, ${playerId})
    on conflict (game_id, user_id) do update
      set team = excluded.team, player_id = excluded.player_id`;

  return NextResponse.json({
    code: bundle.game.code,
    team: player.team,
    player: player.name,
  });
}
