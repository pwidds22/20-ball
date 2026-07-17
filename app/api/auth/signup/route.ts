import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");

  if (!/^[a-zA-Z0-9_.-]{2,20}$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be 2-20 characters (letters, numbers, _ . -)." },
      { status: 400 }
    );
  }
  if (password.length < 4) {
    return NextResponse.json(
      { error: "Password must be at least 4 characters." },
      { status: 400 }
    );
  }

  const hash = await hashPassword(password);
  try {
    const rows = await sql`
      insert into twentyball.users (username, password_hash)
      values (${username}, ${hash})
      returning id, username`;
    await createSession(rows[0].id, rows[0].username);
    return NextResponse.json({ user: { id: rows[0].id, username: rows[0].username } });
  } catch (e) {
    if ((e as { code?: string })?.code === "23505") {
      return NextResponse.json({ error: "That username is taken." }, { status: 409 });
    }
    throw e;
  }
}
