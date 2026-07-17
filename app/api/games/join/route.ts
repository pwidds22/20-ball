import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { jsonError, loadGameByCode, requireSession } from "@/lib/game-server";

export const dynamic = "force-dynamic";

/** Join a game by code. Body: { code, team } */
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase();
  const team = Number(body?.team);
  if (!code) return jsonError(400, "Enter a game code.");
  if (team !== 1 && team !== 2) return jsonError(400, "Pick a team.");

  const bundle = await loadGameByCode(code);
  if (!bundle) return jsonError(404, "No game with that code.");

  await sql`
    insert into twentyball.members (game_id, user_id, team)
    values (${bundle.game.id}, ${session.userId}, ${team})
    on conflict (game_id, user_id) do update set team = excluded.team`;

  return NextResponse.json({ code: bundle.game.code });
}
