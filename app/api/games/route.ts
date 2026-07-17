import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  jsonError,
  makeGameCode,
  parseJsonb,
  requireSession,
} from "@/lib/game-server";
import { normalizeSettings, validateHoles, type HoleInfo } from "@/lib/engine";

export const dynamic = "force-dynamic";

type NewPlayer = { name: string; handicap: number; team: number };

/** Create a game. Body: { name, players[4], myIndex, holes[18], settings } */
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError(400, "Bad request.");

  const name = String(body.name ?? "").trim().slice(0, 60) || "20 Ball";
  const rawPlayers = Array.isArray(body.players) ? (body.players as NewPlayer[]) : [];
  if (rawPlayers.length !== 4 && rawPlayers.length !== 8)
    return jsonError(400, "Play 2v2 (4 players) or 4v4 (8 players).");
  const teamSize = rawPlayers.length / 2;

  const players = rawPlayers.map((p, i) => ({
    name: String(p?.name ?? "").trim().slice(0, 24) || `Player ${i + 1}`,
    handicap: Number(p?.handicap),
    team: Number(p?.team),
  }));
  for (const p of players) {
    if (!Number.isFinite(p.handicap) || p.handicap < 0 || p.handicap > 60)
      return jsonError(400, `Handicap for ${p.name} must be 0-60.`);
    if (p.team !== 1 && p.team !== 2)
      return jsonError(400, "Each player must be on team 1 or 2.");
  }
  if (players.filter((p) => p.team === 1).length !== teamSize)
    return jsonError(400, `Each team needs exactly ${teamSize} players.`);

  const myIndex = Number(body.myIndex);
  if (!Number.isInteger(myIndex) || myIndex < 0 || myIndex >= players.length)
    return jsonError(400, "Pick which player is you.");
  const myTeam = players[myIndex].team;

  const holes = body.holes as HoleInfo[];
  const holesError = validateHoles(holes);
  if (holesError) return jsonError(400, holesError);
  const cleanHoles: HoleInfo[] = holes.map((h) => ({
    hole: h.hole,
    par: h.par,
    si: h.si,
  }));

  const settings = normalizeSettings(body.settings);
  settings.keepTarget = Math.min(settings.keepTarget, teamSize * 18);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeGameCode();
    try {
      await sql.begin(async (tx) => {
        const g = await tx`
          insert into twentyball.games (code, name, status, settings, holes, created_by)
          values (${code}, ${name}, 'active',
                  ${JSON.stringify(settings)}::jsonb,
                  ${JSON.stringify(cleanHoles)}::jsonb,
                  ${session.userId})
          returning id`;
        const gameId = g[0].id;
        let pos = { 1: 0, 2: 0 } as Record<number, number>;
        for (const p of players) {
          pos[p.team] += 1;
          await tx`
            insert into twentyball.players (game_id, team, pos, name, handicap)
            values (${gameId}, ${p.team}, ${pos[p.team]}, ${p.name}, ${p.handicap})`;
        }
        await tx`
          insert into twentyball.members (game_id, user_id, team)
          values (${gameId}, ${session.userId}, ${myTeam})`;
      });
      return NextResponse.json({ code });
    } catch (e) {
      if ((e as { code?: string })?.code === "23505" && attempt < 4) continue;
      throw e;
    }
  }
  return jsonError(500, "Could not create game code. Try again.");
}

/** List the caller's games. */
export async function GET() {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const rows = await sql`
    select g.code, g.name, g.status, g.created_at, m.team,
      (select json_agg(json_build_object('name', p.name, 'team', p.team) order by p.team, p.pos)
       from twentyball.players p where p.game_id = g.id) as players
    from twentyball.members m
    join twentyball.games g on g.id = m.game_id
    where m.user_id = ${session.userId}
    order by g.created_at desc
    limit 25`;

  return NextResponse.json({
    games: rows.map((r) => ({
      code: r.code,
      name: r.name,
      status: r.status,
      createdAt: new Date(r.created_at).toISOString(),
      team: r.team,
      players: r.players ? parseJsonb(r.players) : [],
    })),
  });
}
