"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Spinner } from "@/components/ui";

/** Landing page for emailed reset links: /reset?token=... */
export default function ResetPage() {
  const router = useRouter();
  // Read from window at mount instead of useSearchParams — no Suspense
  // boundary needed, and the token never appears in prerendered HTML.
  const [token, setToken] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) return setErr("Those passwords don't match.");
    setBusy(true);
    setErr("");
    try {
      await api("/api/auth/reset", { body: { token, password: pw } });
      router.push("/"); // reset signs you in
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not reset the password.");
      setBusy(false);
    }
  };

  if (token === null)
    return (
      <main className="mx-auto max-w-md p-6">
        <Spinner />
      </main>
    );

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-center font-display text-3xl font-black text-felt">
        New password
      </h1>
      {token === "" ? (
        <div className="card rise p-5 text-center">
          <p className="text-sm">
            This link is missing its reset token — open the link from the email
            again, or ask for a fresh one from the sign-in screen.
          </p>
          <Link href="/" className="mt-3 inline-block text-sm font-bold underline">
            ← back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="card rise space-y-3 p-5">
          <div>
            <label className="label">New password</label>
            <input
              className="input"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              minLength={4}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Same again</label>
            <input
              className="input"
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              required
            />
          </div>
          {err && <p className="text-sm font-bold text-danger">{err}</p>}
          <button className="btn btn-felt h-12 w-full text-base" disabled={busy}>
            {busy ? "…" : "Set password & sign in"}
          </button>
        </form>
      )}
    </main>
  );
}
