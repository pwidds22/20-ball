import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });
  // Verify the user still exists — a valid cookie for a deleted account
  // should read as signed-out, not as a ghost session.
  const rows = await sql`
    select id, username from twentyball.users where id = ${session.userId}`;
  if (rows.length === 0) {
    await clearSession();
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: { id: rows[0].id, username: rows[0].username },
  });
}
