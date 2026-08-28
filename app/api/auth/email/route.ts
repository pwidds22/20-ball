import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { normalizeEmail } from "@/lib/email";
import { jsonError, requireSession } from "@/lib/game-server";

export const dynamic = "force-dynamic";

/** Put an email on the signed-in account (existing accounts predate the
 *  signup field, and it's what a reset link gets sent to). */
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const body = await req.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  if (!email) return jsonError(400, "That doesn't look like an email address.");

  try {
    await sql`
      update twentyball.users set email = ${email}
      where id = ${session.userId}`;
  } catch (e) {
    if ((e as { code?: string })?.code === "23505") {
      return jsonError(409, "That email is already on another account.");
    }
    throw e;
  }
  return NextResponse.json({ ok: true, email });
}
