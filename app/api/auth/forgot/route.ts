import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { APP_ORIGIN } from "@/lib/config";
import { emailEnabled, sendEmail } from "@/lib/email";
import { jsonError } from "@/lib/game-server";

export const dynamic = "force-dynamic";

// One generic answer no matter what matched — the endpoint must not confirm
// whether a username or email exists.
const GENERIC =
  "If that account has an email on file, a reset link is on its way.";

export async function POST(req: NextRequest) {
  if (!emailEnabled()) {
    return jsonError(503, "Password reset by email isn't switched on yet.");
  }

  const body = await req.json().catch(() => null);
  const identifier = String(body?.identifier ?? "").trim();
  if (!identifier) return jsonError(400, "Enter your username or email.");

  const rows = await sql`
    select id, username, email from twentyball.users
    where lower(username) = lower(${identifier})
       or lower(email) = lower(${identifier})
    limit 1`;
  const user = rows[0];
  if (!user?.email) return NextResponse.json({ ok: true, message: GENERIC });

  // Housekeeping + a lid on outstanding links: expired ones go, and past 3
  // live tokens we quietly stop minting new ones.
  await sql`
    delete from twentyball.password_resets
    where user_id = ${user.id} and expires_at < now()`;
  const [{ count }] = await sql`
    select count(*)::int as count from twentyball.password_resets
    where user_id = ${user.id} and used_at is null`;
  if (count >= 3) return NextResponse.json({ ok: true, message: GENERIC });

  // The plaintext token lives only in the emailed link; we store its hash.
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await sql`
    insert into twentyball.password_resets (user_id, token_hash, expires_at)
    values (${user.id}, ${tokenHash}, now() + interval '30 minutes')`;

  const link = `${APP_ORIGIN}/reset?token=${token}`;
  const sent = await sendEmail(
    user.email,
    "Reset your 20 Ball password",
    `Hi ${user.username},\n\n` +
      `Someone asked to reset the password for the 20 Ball account ` +
      `"${user.username}". Use this link within 30 minutes to set a new one:\n\n` +
      `${link}\n\n` +
      `Didn't ask? Ignore this email — your password is unchanged.`
  );
  if (!sent) {
    return jsonError(502, "Couldn't send the reset email — try again in a bit.");
  }

  return NextResponse.json({ ok: true, message: GENERIC });
}
