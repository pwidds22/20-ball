import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { checkPassword, createSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");

  const rows = await sql`
    select id, username, password_hash from twentyball.users
    where lower(username) = lower(${username})`;
  const ok = rows.length > 0 && (await checkPassword(password, rows[0].password_hash));
  if (!ok) {
    return NextResponse.json(
      { error: "Wrong username or password." },
      { status: 401 }
    );
  }
  await createSession(rows[0].id, rows[0].username);
  return NextResponse.json({ user: { id: rows[0].id, username: rows[0].username } });
}
