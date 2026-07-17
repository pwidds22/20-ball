"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/client";
import { Spinner } from "@/components/ui";

type Info = {
  code: string;
  name: string;
  status: string;
  players: { name: string; handicap: number; team: number }[];
  memberCounts: Record<string, number>;
  yourTeam: number | null;
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

  const join = async (team: number) => {
    setBusy(true);
    setErr("");
    try {
      const res = await api<{ code: string }>("/api/games/join", {
        body: { code: info!.code, team },
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
              pick your team
            </p>
          </div>
          {[1, 2].map((team) => {
            const roster = info.players.filter((p) => p.team === team);
            return (
              <button
                key={team}
                className="card block w-full p-4 text-left"
                onClick={() => join(team)}
                disabled={busy}
              >
                <div className="flex items-center justify-between">
                  <span className="chip bg-felt text-cream">Team {team}</span>
                  <span className="text-xs font-bold uppercase text-faint">
                    {info.memberCounts[team] ?? 0} phone
                    {(info.memberCounts[team] ?? 0) === 1 ? "" : "s"} on it
                  </span>
                </div>
                <p className="mt-2 font-bold">
                  {roster.map((p) => `${p.name} (${p.handicap})`).join(" & ")}
                </p>
                {info.yourTeam === team && (
                  <p className="mt-1 text-xs font-bold uppercase text-felt">
                    you&apos;re already on this team — tap to continue
                  </p>
                )}
              </button>
            );
          })}
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
