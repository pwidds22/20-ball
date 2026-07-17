import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { jsonError, loadGameByCode, requireSession } from "@/lib/game-server";
import { normalizeSettings, validateHoles, type HoleInfo } from "@/lib/engine";

export const dynamic = "force-dynamic";

/**
 * Creator-only mid-round fixes: settings, course card, player names/handicaps.
 * Body: { settings?, holes?, players?: [{id, name, handicap}] }
 */
export async function PATCH(
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
  if (bundle.game.created_by !== session.userId)
    return jsonError(403, "Only the game creator can edit the setup.");

  if (body.holes !== undefined) {
    const err = validateHoles(body.holes);
    if (err) return jsonError(400, err);
    const clean = (body.holes as HoleInfo[]).map((h) => ({
      hole: h.hole,
      par: h.par,
      si: h.si,
    }));
    await sql`
      update twentyball.games set holes = ${JSON.stringify(clean)}::jsonb
      where id = ${bundle.game.id}`;
  }

  if (body.settings !== undefined) {
    const settings = normalizeSettings(body.settings);
    await sql`
      update twentyball.games set settings = ${JSON.stringify(settings)}::jsonb
      where id = ${bundle.game.id}`;
  }

  if (Array.isArray(body.players)) {
    for (const p of body.players) {
      const player = bundle.players.find((x) => x.id === p?.id);
      if (!player) return jsonError(400, "Unknown player in update.");
      const name = String(p.name ?? player.name).trim().slice(0, 24) || player.name;
      const handicap = Number(p.handicap);
      if (!Number.isFinite(handicap) || handicap < 0 || handicap > 60)
        return jsonError(400, `Handicap for ${name} must be 0-60.`);
      await sql`
        update twentyball.players set name = ${name}, handicap = ${handicap}
        where id = ${player.id}`;
    }
  }

  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 60);
    if (name)
      await sql`
        update twentyball.games set name = ${name} where id = ${bundle.game.id}`;
  }

  return NextResponse.json({ ok: true });
}
