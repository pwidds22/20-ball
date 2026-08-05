"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/client";
import { Spinner } from "@/components/ui";

type InfoPlayer = {
  id: string;
  name: string;
  handicap: number;
  team: number;
  /** Another phone already claimed this golfer. */
  taken: boolean;
  isYou: boolean;
};

type Info = {
  code: string;
  name: string;
  status: string;
  players: InfoPlayer[];
  memberCounts: Record<string, number>;
  yourTeam: number | null;
  yourPlayerId: string | null;
};

function JoinInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const lookup = useCallback(
    async (c: string) => {
      setErr("");
      setBusy(true);
      try {
        setInfo(await api<Info>(`/api/games/${c.trim().toUpperCase()}/info`));
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/");
          return;
        }
        setErr(e instanceof Error ? e.message : "Lookup failed.");
        setInfo(null);
      } finally {
        setBusy(false);
      }
    },
    [router]
  );

  useEffect(() => {
    const c = params.get("code");
    if (c) lookup(c);
  }, [params, lookup]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim()) lookup(code);
  };

  // You claim a PLAYER, not a team — the server reads the team off the roster,
  // so you can't end up watching the wrong side's card.
  const join = async (playerId: string) => {
    setBusy(true);
    setErr("");
    try {
      const res = await api<{ code: string }>("/api/games/join", {
        body: { code: info!.code, playerId },
      });
      router.push(`/g/${res.code}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not join.");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md p-5">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm font-bold text-faint underline">
          ← back
        </Link>
        <h1 className="font-display text-2xl font-black text-felt">
          Join a game
        </h1>
      </header>

      <form className="flex gap-2" onSubmit={submit}>
        <input
          className="input flex-1 uppercase tracking-[0.25em]"
          placeholder="CODE"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={8}
          autoCapitalize="characters"
        />
        <button className="btn btn-paper h-12 px-5" disabled={busy}>
          Find
        </button>
      </form>
      {err && <p className="mt-3 text-sm font-bold text-danger">{err}</p>}
      {busy && !info && <Spinner />}

      {info && (
        <div className="rise mt-5 space-y-3">
          <div className="text-center">
            <p className="font-display text-xl font-bold">{info.name}</p>
            <p className="text-xs font-bold uppercase tracking-widest text-faint">
              which one are you?
            </p>
          </div>
          {[1, 2].map((team) => {
            const roster = info.players.filter((p) => p.team === team);
            if (roster.length === 0) return null;
            return (
              <div key={team}>
                <div className="mb-1.5 flex items-center justify-between px-1">
                  <span className="chip bg-felt text-cream">Team {team}</span>
                  <span className="text-xs font-bold uppercase text-faint">
                    with {roster.map((p) => p.name).join(" & ")}
                  </span>
                </div>
                <div className="space-y-2">
                  {roster.map((p) => (
                    <button
                      key={p.id}
                      className={`card block w-full p-4 text-left ${
                        p.taken ? "opacity-50" : ""
                      }`}
                      onClick={() => join(p.id)}
                      disabled={busy || p.taken}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-lg font-bold">
                          {p.name}
                        </span>
                        <span className="text-sm font-bold text-faint">
                          {p.handicap} hcp
                        </span>
                      </div>
                      {p.isYou ? (
                        <p className="mt-1 text-xs font-bold uppercase text-felt">
                          that&apos;s you — tap to continue
                        </p>
                      ) : p.taken ? (
                        <p className="mt-1 text-xs font-bold uppercase text-faint">
                          already on another phone
                        </p>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="pt-1 text-center text-xs text-faint">
            Tap the player you&apos;re playing as — your team comes from the
            card, so you can&apos;t end up on the wrong side.
          </p>
        </div>
      )}
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md p-5">
          <Spinner />
        </main>
      }
    >
      <JoinInner />
    </Suspense>
  );
}
