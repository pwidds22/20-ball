"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { CourseEditor, SettingsEditor } from "@/components/setup";
import {
  DEFAULT_SETTINGS,
  OLD_BRIDGE_HOLES,
  validateHoles,
  type HoleInfo,
  type Settings,
} from "@/lib/engine";

type Draft = { name: string; handicap: string };
type CourseHit = {
  id?: number;
  name: string;
  where: string;
  holes: HoleInfo[];
};

const emptyDraft = (): Draft => ({ name: "", handicap: "" });

export default function NewGamePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"20" | "40">("20");
  const [name, setName] = useState("");
  const [players, setPlayers] = useState<Draft[]>(
    Array.from({ length: 4 }, emptyDraft)
  );
  const [myIndex, setMyIndex] = useState(0);
  const [holes, setHoles] = useState<HoleInfo[]>(
    OLD_BRIDGE_HOLES.map((h) => ({ ...h }))
  );
  const [courseName, setCourseName] = useState("Old Bridge GC");
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [courseQ, setCourseQ] = useState("");
  const [courseResults, setCourseResults] = useState<CourseHit[] | null>(null);
  const [courseMsg, setCourseMsg] = useState("");
  const [searching, setSearching] = useState(false);

  const teamSize = players.length / 2;

  const switchMode = (m: "20" | "40") => {
    if (m === mode) return;
    setMode(m);
    const count = m === "40" ? 8 : 4;
    setPlayers((prev) => {
      const next = Array.from({ length: count }, (_, i) =>
        i < prev.length ? prev[i] : emptyDraft()
      );
      return next;
    });
    setMyIndex(0);
    setSettings((s) => ({ ...s, keepTarget: m === "40" ? 40 : 20 }));
  };

  const setPlayer = (i: number, patch: Partial<Draft>) =>
    setPlayers(players.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const searchCourses = async () => {
    if (courseQ.trim().length < 3) {
      setCourseMsg("Type at least 3 letters of the course name.");
      return;
    }
    setSearching(true);
    setCourseMsg("");
    try {
      const res = await api<{ enabled: boolean; courses: CourseHit[] }>(
        `/api/courses/search?q=${encodeURIComponent(courseQ.trim())}`
      );
      if (!res.enabled) {
        setCourseResults(null);
        setCourseMsg(
          "Course search isn't switched on right now — tap Edit card to type the scorecard in by hand."
        );
      } else {
        setCourseResults(res.courses);
        if (res.courses.length === 0)
          setCourseMsg(
            "No courses with a full scorecard found — try another spelling, or enter the card manually."
          );
      }
    } catch (e) {
      setCourseMsg(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const create = async () => {
    setErr("");
    for (const p of players) {
      if (!p.name.trim()) return setErr("Enter every player name.");
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
            team: i < teamSize ? 1 : 2,
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
          <label className="label">Game type</label>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink/10 p-1">
            {(
              [
                ["20", "20 Ball", "2 v 2 · keep 20"],
                ["40", "40 Ball", "4 v 4 · keep 40"],
              ] as const
            ).map(([m, label, sub]) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`btn h-14 flex-col gap-0 ${
                  mode === m ? "bg-paper shadow" : "text-faint"
                }`}
              >
                <span className="text-base">{label}</span>
                <span className="text-[10px] font-bold normal-case tracking-normal">
                  {sub}
                </span>
              </button>
            ))}
          </div>
          <label className="label mt-4">Game name (optional)</label>
          <input
            className="input"
            placeholder={`${mode} Ball — ${new Date().toLocaleDateString(
              undefined,
              { month: "short", day: "numeric" }
            )}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </section>

        <section className="card rise p-4">
          <h2 className="label">Team 1</h2>
          {players.slice(0, teamSize).map((_, i) => playerRow(i))}
          <h2 className="label mt-4">Team 2</h2>
          {players.slice(teamSize).map((_, i) => playerRow(teamSize + i))}
          <p className="mt-2 text-xs text-faint">
            Tap{" "}
            <b>me</b>{" "}
            next to your own name — that decides which team&apos;s card you run.
            Strokes come off the lowest handicap in the game.
            {mode === "40" &&
              " Each foursome can start on its own hole — set that under House rules."}
          </p>
        </section>

        <section className="card rise p-4">
          <h2 className="mb-2 font-display text-lg font-bold">Course card</h2>
          <div className="mb-3 flex gap-2">
            <input
              className="input flex-1"
              placeholder="Search a course (name or city)…"
              value={courseQ}
              onChange={(e) => setCourseQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  searchCourses();
                }
              }}
            />
            <button
              type="button"
              className="btn btn-paper h-12 px-4"
              onClick={searchCourses}
              disabled={searching}
            >
              {searching ? "…" : "Find"}
            </button>
          </div>
          {courseMsg && <p className="mb-2 text-sm text-faint">{courseMsg}</p>}
          {courseResults && courseResults.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {courseResults.map((c, i) => (
                <button
                  key={c.id ?? i}
                  type="button"
                  className="card block w-full p-2.5 text-left"
                  onClick={() => {
                    setHoles(c.holes.map((h) => ({ ...h })));
                    setCourseName(c.name);
                    setCourseResults(null);
                    setCourseMsg(`Loaded: ${c.name}`);
                  }}
                >
                  <span className="font-bold">{c.name}</span>
                  {c.where && (
                    <span className="ml-1.5 text-xs text-faint">{c.where}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          <CourseEditor
            holes={holes}
            title={courseName}
            onChange={(h) => {
              setHoles(h);
              setCourseName("Custom card");
            }}
          />
        </section>

        <section className="card rise p-4">
          <h2 className="mb-2 font-display text-lg font-bold">House rules</h2>
          <SettingsEditor
            settings={settings}
            onChange={setSettings}
            maxKeep={teamSize * 18}
          />
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
            {busy ? "Creating…" : `Create ${mode} Ball game`}
          </button>
        </div>
      </div>
    </main>
  );
}
