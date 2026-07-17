// Server-side game loading, redaction, and shared route guards.
// Everything a browser receives goes through buildState(), which only ever
// includes the opponent's kept information via peeks, scheduled reveals, or
// the final card — that's what enforces the hidden-information rules.

import { NextResponse } from "next/server";
import { sql } from "./db";
import { clearSession, getSession, type Session } from "./auth";
import {
  type Entry,
  type GameState,
  type HoleInfo,
  type PlayerInfo,
  type Settings,
  type TeamView,
  buildTeamView,
  keptSummaryThru,
  revealCheckpoint,
  strokesForHandicap,
} from "./engine";

export type GameBundle = {
  game: {
    id: string;
    code: string;
    name: string;
    status: "active" | "final";
    settings: Settings;
    holes: HoleInfo[];
    created_by: string;
    created_at: Date;
  };
  players: PlayerInfo[]; // strokes populated
  members: { user_id: string; team: number }[];
  entries: Entry[];
  peeks: { team: number; thru: number; snapshot: { keptCount: number; toPar: number }; created_at: Date }[];
  alerts: { team: number; message: string; created_at: Date }[];
};

export function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

// With `prepare: false` (required by Supabase's transaction pooler) postgres-js
// skips type fetching, so json/jsonb columns arrive as raw strings.
export function parseJsonb<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

export async function requireSession(): Promise<Session | NextResponse> {
  const session = await getSession();
  if (!session) return jsonError(401, "You need to sign in first.");
  // A signed cookie can outlive its user row (e.g. a database reset) —
  // treat that as signed-out instead of letting inserts hit FK violations.
  const rows = await sql`
    select 1 from twentyball.users where id = ${session.userId}`;
  if (rows.length === 0) {
    await clearSession();
    return jsonError(401, "Your account is gone (database was reset) — sign up again, takes 10 seconds.");
  }
  return session;
}

export async function loadGameByCode(code: string): Promise<GameBundle | null> {
  const games = await sql`
    select id, code, name, status, settings, holes, created_by, created_at
    from twentyball.games where code = ${code.toUpperCase()}`;
  if (games.length === 0) return null;
  const game = games[0] as unknown as GameBundle["game"];
  game.settings = parseJsonb<Settings>(game.settings);
  game.holes = parseJsonb<HoleInfo[]>(game.holes);

  const [playerRows, members, scoreRows, peekRows, alertRows] =
    await Promise.all([
      sql`select id, team, pos, name, handicap::float8 as handicap
          from twentyball.players where game_id = ${game.id} order by team, pos`,
      sql`select user_id, team from twentyball.members where game_id = ${game.id}`,
      sql`select player_id, hole, gross, pickup, kept, decided
          from twentyball.scores where game_id = ${game.id}`,
      sql`select team, thru, snapshot, created_at
          from twentyball.peeks where game_id = ${game.id} order by created_at`,
      sql`select team, message, created_at
          from twentyball.alerts where game_id = ${game.id}
          order by created_at desc limit 30`,
    ]);

  const settings = game.settings;
  const holes = game.holes;
  const minHandicap = Math.min(
    ...playerRows.map((p) => Number(p.handicap))
  );
  const players: PlayerInfo[] = playerRows.map((p) => ({
    id: p.id,
    team: p.team,
    pos: p.pos,
    name: p.name,
    handicap: Number(p.handicap),
    strokes: strokesForHandicap(Number(p.handicap), minHandicap, holes, settings),
  }));

  const entries: Entry[] = scoreRows.map((s) => ({
    playerId: s.player_id,
    hole: s.hole,
    gross: s.gross,
    pickup: s.pickup,
    kept: s.kept,
    decided: s.decided,
  }));

  return {
    game,
    players,
    members: members as unknown as GameBundle["members"],
    entries,
    peeks: peekRows.map((p) => ({
      team: p.team,
      thru: p.thru,
      snapshot: parseJsonb<{ keptCount: number; toPar: number }>(p.snapshot),
      created_at: p.created_at,
    })),
    alerts: alertRows as unknown as GameBundle["alerts"],
  };
}

/** Record a rules alert (score/decision changes) visible to both teams. */
export async function insertAlert(
  gameId: string,
  team: number,
  message: string
) {
  await sql`
    insert into twentyball.alerts (game_id, team, message)
    values (${gameId}, ${team}, ${message})`;
}

/** Highest hole this team has locked in. */
export function teamDecidedThru(bundle: GameBundle, team: number) {
  return teamEntries(bundle, team).reduce(
    (m, e) => (e.decided ? Math.max(m, e.hole) : m),
    0
  );
}

/** Lowest hole with an entered score still awaiting its keep decision. */
export function teamPendingHole(bundle: GameBundle, team: number) {
  let pending: number | null = null;
  for (const e of teamEntries(bundle, team)) {
    if (!e.decided && (pending === null || e.hole < pending)) pending = e.hole;
  }
  return pending;
}

export function memberTeam(bundle: GameBundle, userId: string): number | null {
  return bundle.members.find((m) => m.user_id === userId)?.team ?? null;
}

export function teamPlayers(bundle: GameBundle, team: number) {
  return bundle.players.filter((p) => p.team === team);
}

export function teamEntries(bundle: GameBundle, team: number) {
  const ids = new Set(teamPlayers(bundle, team).map((p) => p.id));
  return bundle.entries.filter((e) => ids.has(e.playerId));
}

export function teamProgress(bundle: GameBundle, team: number) {
  return teamEntries(bundle, team).reduce((m, e) => Math.max(m, e.hole), 0);
}

export function teamKeptCount(bundle: GameBundle, team: number) {
  return teamEntries(bundle, team).filter((e) => e.kept).length;
}

export function peeksUsed(bundle: GameBundle, team: number) {
  return bundle.peeks.filter((p) => p.team === team).length;
}

function fullTeamView(bundle: GameBundle, team: number): TeamView {
  const { settings, holes } = bundle.game;
  return buildTeamView(
    team,
    teamPlayers(bundle, team),
    teamEntries(bundle, team),
    holes,
    settings,
    Math.max(0, settings.peeksPerTeam - peeksUsed(bundle, team))
  );
}

export function buildState(bundle: GameBundle, session: Session): GameState {
  const { game } = bundle;
  const myTeam = memberTeam(bundle, session.userId);
  if (!myTeam) throw new Error("not a member");
  const oppTeam = 3 - myTeam;

  const mine = fullTeamView(bundle, myTeam);
  const oppEntriesAll = teamEntries(bundle, oppTeam);
  const oppPlayers = teamPlayers(bundle, oppTeam);
  const oppProgress = oppEntriesAll.reduce((m, e) => Math.max(m, e.hole), 0);

  const checkpoint = revealCheckpoint(
    game.settings.revealEvery,
    mine.progress,
    oppProgress
  );
  const reveal =
    game.status === "active" && checkpoint > 0
      ? keptSummaryThru(oppPlayers, oppEntriesAll, game.holes, checkpoint)
      : null;

  const state: GameState = {
    game: {
      id: game.id,
      code: game.code,
      name: game.name,
      status: game.status,
      settings: game.settings,
      holes: game.holes,
      createdBy: game.created_by,
      createdAt: new Date(game.created_at).toISOString(),
    },
    viewer: {
      userId: session.userId,
      username: session.username,
      team: myTeam,
      isCreator: game.created_by === session.userId,
    },
    mine,
    opp: {
      team: oppTeam,
      players: oppPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        handicap: p.handicap,
        strokes: p.strokes,
      })),
      progress: oppProgress,
      reveal,
      peeks: bundle.peeks
        .filter((p) => p.team === myTeam)
        .map((p) => ({
          thru: p.thru,
          keptCount: p.snapshot.keptCount,
          toPar: p.snapshot.toPar,
          at: new Date(p.created_at).toISOString(),
        })),
    },
    alerts: bundle.alerts.map((a) => ({
      team: a.team,
      message: a.message,
      at: new Date(a.created_at).toISOString(),
    })),
  };

  if (game.status === "final") {
    const t1 = fullTeamView(bundle, 1);
    const t2 = fullTeamView(bundle, 2);
    let winner = 0;
    if (t1.toPar < t2.toPar) winner = 1;
    else if (t2.toPar < t1.toPar) winner = 2;
    state.final = { teams: [t1, t2], winner };
  }

  return state;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function makeGameCode(length = 5): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}
