"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { CourseEditor, SettingsEditor } from "@/components/setup";
import {
  COURSE_PRESETS,
  DEFAULT_SETTINGS,
  validateHoles,
  type HoleInfo,
  type Settings,
} from "@/lib/engine";

type Draft = { name: string; handicap: string };

export default function NewGamePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [players, setPlayers] = useState<Draft[]>([
    { name: "", handicap: "" },
    { name: "", handicap: "" },
    { name: "", handicap: "" },
    { name: "", handicap: "" },
  ]);
  const [myIndex, setMyIndex] = useState(0);
  const [holes, setHoles] = useState<HoleInfo[]>(
    COURSE_PRESETS[0].holes.map((h) => ({ ...h }))
  );
  const [preset, setPreset] = useState(COURSE_PRESETS[0].name);
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const setPlayer = (i: number, patch: Partial<Draft>) =>
    setPlayers(players.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const create = async () => {
    setErr("");
    for (const p of players) {
      if (!p.name.trim()) return setErr("Enter all four player names.");
      if (p.handicap.trim() === "" || !Number.isFinite(Number(p.handicap)))
        return setErr(`Enter a handicap for ${p.name || "every player"}.`);
    }
    const holesErr = validateHoles(holes);
    if (holesErr) return setErr(holesErr);

    setBusy(true);
    try {
      const res = await api<{ code: string }>("/api/games", {
        body: {
          name,
          players: players.map((p, i) => ({
            name: p.name,
            handicap: Number(p.handicap),
            team: i < 2 ? 1 : 2,
          })),
          myIndex,
          holes,
          settings,
        },
      });
      router.push(`/g/${res.code}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create the game.");
      setBusy(false);
    }
  };

  const playerRow = (i: number) => (
    <div className="flex items-center gap-2 py-1" key={i}>
      <input
        className="input flex-1"
        placeholder={`Player ${i + 1}`}
        value={players[i].name}
        onChange={(e) => setPlayer(i, { name: e.target.value })}
      />
      <input
        className="input w-20 text-center"
        placeholder="HCP"
        inputMode="decimal"
        value={players[i].handicap}
        onChange={(e) => setPlayer(i, { handicap: e.target.value })}
      />
      <button
        type="button"
        onClick={() => setMyIndex(i)}
        className={`chip h-9 shrink-0 border-2 px-2 ${
          myIndex === i
            ? "border-felt bg-felt text-cream"
            : "border-ink/20 bg-paper text-faint"
        }`}
      >
        me
      </button>
    </div>
  );

  return (
    <main className="mx-auto max-w-md p-5 pb-36">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm font-bold text-faint underline">
          ← back
        </Link>
        <h1 className="font-display text-2xl font-black text-felt">New game</h1>
      </header>

      <div className="space-y-5">
        <section className="card rise p-4">
          <label className="label">Game name (optional)</label>
          <input
            className="input"
            placeholder={`20 Ball — ${new Date().toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </section>

        <section className="card rise p-4">
          <h2 className="label">Team 1</h2>
          {playerRow(0)}
          {playerRow(1)}
          <h2 className="label mt-4">Team 2</h2>
          {playerRow(2)}
          {playerRow(3)}
          <p className="mt-2 text-xs text-faint">
            Tap <b>me</b> next to your own name — that decides which team&apos;s
            card you run. Strokes come off the lowest handicap automatically.
          </p>
        </section>

        <section className="card rise p-4">
          <h2 className="mb-2 font-display text-lg font-bold">Course card</h2>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {COURSE_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setHoles(p.holes.map((h) => ({ ...h })));
                  setPreset(p.name);
                }}
                className={`chip h-8 border-2 px-3 ${
                  preset === p.name
                    ? "border-felt bg-felt text-cream"
                    : "border-ink/20 bg-paper text-faint"
                }`}
              >
                {p.name}
              </button>
            ))}
            {preset === "custom" && (
              <span className="chip h-8 border-2 border-gold bg-gold/20 px-3">
                custom card
              </span>
            )}
          </div>
          <CourseEditor
            holes={holes}
            onChange={(h) => {
              setHoles(h);
              setPreset("custom");
            }}
          />
        </section>

        <section className="card rise p-4">
          <h2 className="mb-2 font-display text-lg font-bold">House rules</h2>
          <SettingsEditor settings={settings} onChange={setSettings} />
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line bg-cream/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-md">
          {err && (
            <p className="mb-2 text-center text-sm font-bold text-danger">
              {err}
            </p>
          )}
          <button
            className="btn btn-felt h-14 w-full text-lg"
            onClick={create}
            disabled={busy}
          >
            {busy ? "Creating…" : "Create game"}
          </button>
        </div>
      </div>
    </main>
  );
}
