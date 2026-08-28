"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Spinner } from "@/components/ui";

type Me = { id: string; username: string; email: string | null };
type GameRow = {
  code: string;
  name: string;
  status: string;
  createdAt: string;
  team: number;
  isCreator: boolean;
  players: { name: string; team: number }[];
};

function Brand({ big }: { big?: boolean }) {
  return (
    <div className={big ? "text-center" : "flex items-center gap-2"}>
      <span
        className={`font-display font-black tracking-tight ${
          big ? "block text-6xl" : "text-2xl"
        }`}
      >
        20 BALL
      </span>
      {big && (
        <span className="mt-2 block text-sm font-bold uppercase tracking-[0.3em] text-gold">
          keep twenty · hide them · hold your nerve
        </span>
      )}
    </div>
  );
}

function AuthCard({
  onDone,
  resetEnabled,
}: {
  onDone: () => void;
  resetEnabled: boolean;
}) {
  const [mode, setMode] = useState<"in" | "up" | "forgot">("up");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const switchMode = (m: "in" | "up" | "forgot") => {
    setMode(m);
    setErr("");
    setInfo("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setInfo("");
    try {
      if (mode === "forgot") {
        const res = await api<{ message?: string }>("/api/auth/forgot", {
          body: { identifier: username },
        });
        setInfo(res.message ?? "If that account has an email on file, a reset link is on its way.");
      } else {
        await api(`/api/auth/${mode === "up" ? "signup" : "login"}`, {
          body:
            mode === "up" && email.trim()
              ? { username, password, email: email.trim() }
              : { username, password },
        });
        onDone();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card rise p-5">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-ink/10 p-1">
        {(
          [
            ["up", "New account"],
            ["in", "Sign in"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            className={`btn h-10 text-sm ${
              mode === m || (m === "in" && mode === "forgot")
                ? "bg-paper shadow"
                : "text-faint"
            }`}
            onClick={() => switchMode(m)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">
            {mode === "forgot" ? "Username or email" : "Username"}
          </label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            required
          />
        </div>
        {mode !== "forgot" && (
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        )}
        {mode === "up" && resetEnabled && (
          <div>
            <label className="label">Email (optional — for password resets)</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
        )}
        {err && <p className="text-sm font-bold text-danger">{err}</p>}
        {info && <p className="text-sm font-bold text-felt">{info}</p>}
        <button className="btn btn-felt h-12 w-full text-base" disabled={busy}>
          {busy
            ? "…"
            : mode === "up"
              ? "Create account"
              : mode === "in"
                ? "Sign in"
                : "Email me a reset link"}
        </button>
        {mode === "in" && resetEnabled && (
          <button
            type="button"
            className="block w-full text-center text-xs font-bold text-faint underline"
            onClick={() => switchMode("forgot")}
          >
            Forgot password?
          </button>
        )}
        {mode === "forgot" && (
          <button
            type="button"
            className="block w-full text-center text-xs font-bold text-faint underline"
            onClick={() => switchMode("in")}
          >
            ← back to sign in
          </button>
        )}
      </form>
    </div>
  );
}

/** Nags an email-less account once resets exist — that's the address a
 *  forgotten password gets rescued through. */
function EmailPrompt({ onSaved }: { onSaved: () => void }) {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("/api/auth/email", { body: { email } });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save that email.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="card mb-4 p-3">
      <p className="label">
        Add an email so you can reset your password if you forget it
      </p>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button className="btn btn-paper h-12 px-4" disabled={busy}>
          {busy ? "…" : "Save"}
        </button>
      </div>
      {err && <p className="mt-1 text-sm font-bold text-danger">{err}</p>}
    </form>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [games, setGames] = useState<GameRow[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [resetEnabled, setResetEnabled] = useState(false);

  const load = useCallback(async () => {
    try {
      const { user, features } = await api<{
        user: Me | null;
        features?: { passwordReset?: boolean };
      }>("/api/auth/me");
      setResetEnabled(!!features?.passwordReset);
      setMe(user);
      if (user) {
        const res = await api<{ games: GameRow[] }>("/api/games");
        setGames(res.games);
      }
    } catch {
      setMe(null);
    }
  }, []);

  const deleteGame = useCallback(
    async (g: GameRow) => {
      if (
        !window.confirm(
          `Delete "${g.name}" (code ${g.code})? This erases the round for everyone and can't be undone.`
        )
      )
        return;
      setGames((prev) => prev.filter((x) => x.code !== g.code));
      try {
        await api(`/api/games/${g.code}`, { method: "DELETE" });
      } catch {
        load(); // restore on failure
      }
    },
    [load]
  );

  useEffect(() => {
    load();
  }, [load]);

  if (me === undefined)
    return (
      <main className="mx-auto max-w-md p-6">
        <Spinner />
      </main>
    );

  if (!me) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
        <div className="rise text-felt">
          <Brand big />
        </div>
        <AuthCard onDone={load} resetEnabled={resetEnabled} />
        <p className="text-center text-sm text-faint">
          Play <b>20 Ball</b> (2 v 2, keep 20 of 36) or <b>40 Ball</b> (4 v 4,
          keep 40 of 72). Your team picks which scores to keep — the other team
          can&apos;t see which. Skip too many holes and you&apos;ll be forced to
          keep the blow-ups.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md p-5 pb-16">
      <header className="mb-6 flex items-center justify-between">
        <div className="text-felt">
          <Brand />
        </div>
        <button
          className="text-sm font-bold text-faint underline"
          onClick={async () => {
            await api("/api/auth/logout", { body: {} });
            setMe(null);
          }}
        >
          sign out ({me.username})
        </button>
      </header>

      {resetEnabled && !me.email && <EmailPrompt onSaved={load} />}

      <div className="rise space-y-4">
        <Link href="/new" className="btn btn-felt h-14 w-full text-lg">
          + New game
        </Link>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (joinCode.trim())
              router.push(`/join?code=${joinCode.trim().toUpperCase()}`);
          }}
        >
          <input
            className="input flex-1 uppercase tracking-[0.2em]"
            placeholder="GAME CODE"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            maxLength={8}
          />
          <button className="btn btn-paper h-12 px-5">Join</button>
        </form>

        <section className="pt-2">
          <h2 className="label">Your games</h2>
          {games.length === 0 && (
            <p className="py-6 text-center text-sm text-faint">
              No games yet — start one and text the boys the code.
            </p>
          )}
          <div className="space-y-3">
            {games.map((g) => {
              const t1 = g.players.filter((p) => p.team === 1).map((p) => p.name);
              const t2 = g.players.filter((p) => p.team === 2).map((p) => p.name);
              return (
                <div key={g.code} className="card p-4">
                  <Link href={`/g/${g.code}`} className="block">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-lg font-bold">
                        {g.name}
                      </span>
                      <span
                        className={`chip ${
                          g.status === "final"
                            ? "bg-ink text-cream"
                            : "bg-gold/30 text-ink"
                        }`}
                      >
                        {g.status === "final" ? "Final" : "Live"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-faint">
                      {t1.join(" & ")} <span className="font-bold">vs</span>{" "}
                      {t2.join(" & ")}
                    </p>
                  </Link>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-faint">
                      code {g.code} ·{" "}
                      {new Date(g.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    {g.isCreator && (
                      <button
                        onClick={() => deleteGame(g)}
                        className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-danger underline"
                        aria-label={`Delete ${g.name}`}
                      >
                        🗑 delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
