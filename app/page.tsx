"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Spinner } from "@/components/ui";

type Me = { id: string; username: string };
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

function AuthCard({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"in" | "up">("up");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api(`/api/auth/${mode === "up" ? "signup" : "login"}`, {
        body: { username, password },
      });
      onDone();
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
              mode === m ? "bg-paper shadow" : "text-faint"
            }`}
            onClick={() => setMode(m)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Username</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            required
          />
        </div>
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
        {err && <p className="text-sm font-bold text-danger">{err}</p>}
        <button className="btn btn-felt h-12 w-full text-base" disabled={busy}>
          {busy ? "…" : mode === "up" ? "Create account" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [games, setGames] = useState<GameRow[]>([]);
  const [joinCode, setJoinCode] = useState("");

  const load = useCallback(async () => {
    try {
      const { user } = await api<{ user: Me | null }>("/api/auth/me");
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
        <AuthCard onDone={load} />
        <p className="text-center text-sm text-faint">
          2 v 2. Each team keeps exactly 20 of its 36 scores. The other team
          can&apos;t see which ones. Skip too many holes and you&apos;ll be
          forced to keep the blow-ups.
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
