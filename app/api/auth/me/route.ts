import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/auth";
import { emailEnabled } from "@/lib/email";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// The auth screen reads `features` while signed out (it decides whether
// "Forgot password?" and the email field exist), so it rides on this response
// rather than a route of its own.
export async function GET() {
  const features = { passwordReset: emailEnabled() };
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null, features });
  // Verify the user still exists — a valid cookie for a deleted account
  // should read as signed-out, not as a ghost session.
  const rows = await sql`
    select id, username, email from twentyball.users where id = ${session.userId}`;
  if (rows.length === 0) {
    await clearSession();
    return NextResponse.json({ user: null, features });
  }
  return NextResponse.json({
    user: { id: rows[0].id, username: rows[0].username, email: rows[0].email ?? null },
    features,
  });
}
