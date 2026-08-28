import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { jsonError } from "@/lib/game-server";

export const dynamic = "force-dynamic";

/** Trade a valid reset token for a new password + a signed-in session. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? "");
  const password = String(body?.password ?? "");

  if (!token) return jsonError(400, "That reset link is missing its token.");
  if (password.length < 4) {
    return jsonError(400, "Password must be at least 4 characters.");
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const rows = await sql`
    select r.id, u.id as user_id, u.username
    from twentyball.password_resets r
    join twentyball.users u on u.id = r.user_id
    where r.token_hash = ${tokenHash}
      and r.used_at is null
      and r.expires_at > now()
    limit 1`;
  const hit = rows[0];
  if (!hit) {
    return jsonError(400, "That reset link is invalid or has expired — ask for a fresh one.");
  }

  const hash = await hashPassword(password);
  await sql`
    update twentyball.users set password_hash = ${hash}
    where id = ${hit.user_id}`;
  // Burn this token and void any other outstanding links for the account.
  await sql`
    delete from twentyball.password_resets where user_id = ${hit.user_id}`;

  await createSession(hit.user_id, hit.username);
  return NextResponse.json({ user: { id: hit.user_id, username: hit.username } });
}
