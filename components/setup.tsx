"use client";

// Course + settings editors shared by the create-game page and the
// creator's mid-round edit modal.

import { useState } from "react";
import { validateHoles, type HoleInfo, type Settings } from "@/lib/engine";
import { Stepper, Toggle } from "./ui";

/** Read-only mini scorecard: par + hole handicap per hole, front/back split. */
function MiniCard({ holes }: { holes: HoleInfo[] }) {
  const nine = (from: number, to: number, label: string) => {
    const slice = holes.slice(from, to);
    const cell = "border border-line px-1 py-0.5 text-center tabular-nums";
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr className="text-faint">
              <td className={`${cell} text-left font-bold uppercase`}>{label}</td>
              {slice.map((h) => (
                <td key={h.hole} className={`${cell} font-bold`}>
                  {h.hole}
                </td>
              ))}
            </tr>
            <tr>
              <td className={`${cell} text-left font-bold`}>Par</td>
              {slice.map((h) => (
                <td key={h.hole} className={cell}>
                  {h.par}
                </td>
              ))}
            </tr>
            <tr className="text-faint">
              <td className={`${cell} text-left font-bold`}>Hdcp</td>
              {slice.map((h) => (
                <td key={h.hole} className={cell}>
                  {h.si}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };
  return (
    <div className="space-y-2">
      {nine(0, 9, "Front")}
      {nine(9, 18, "Back")}
    </div>
  );
}

export function CourseEditor({
  holes,
  onChange,
  title,
  defaultEditing = false,
}: {
  holes: HoleInfo[];
  onChange: (h: HoleInfo[]) => void;
  title?: string;
  defaultEditing?: boolean;
}) {
  const err = validateHoles(holes);
  const [editing, setEditing] = useState(defaultEditing);
  const set = (i: number, patch: Partial<HoleInfo>) => {
    const next = holes.map((h, j) => (j === i ? { ...h, ...patch } : h));
    onChange(next);
  };
  const parTotal = holes.reduce((a, h) => a + h.par, 0);

  // Clean read-only summary — the common case now that cards come from the
  // course search / presets. Tap "Edit card" only when something's off.
  if (!editing && !err) {
    return (
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="font-display text-base font-bold">
            {title || "Course card"}{" "}
            <span className="text-sm font-normal text-faint">· par {parTotal}</span>
          </span>
          <button
            type="button"
            className="btn btn-paper h-9 px-3 text-sm"
            onClick={() => setEditing(true)}
          >
            ✎ Edit card
          </button>
        </div>
        <MiniCard holes={holes} />
        <p className="mt-2 text-xs text-faint">
          Hdcp = hole handicap from the scorecard (1 = hardest hole).
        </p>
      </div>
    );
  }

  const row = (h: HoleInfo, i: number) => (
    <div className="flex items-center gap-2 py-1" key={h.hole}>
      <span className="w-6 text-right font-display text-base font-bold tabular-nums">
        {h.hole}
      </span>
      <div className="flex flex-1 gap-1">
        {[3, 4, 5, 6].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => set(i, { par: p })}
            className={`btn h-9 flex-1 text-sm ${
              h.par === p ? "btn-felt" : "btn-paper"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <select
        className="input h-9 w-16 px-1 py-0 text-center"
        value={h.si}
        onChange={(e) => set(i, { si: Number(e.target.value) })}
      >
        {Array.from({ length: 18 }, (_, k) => k + 1).map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-faint">
        <span className="w-6 text-right">#</span>
        <span className="flex-1">Par</span>
        <span className="w-16 text-center">Hdcp</span>
      </div>
      {holes.slice(0, 9).map((h, i) => row(h, i))}
      <div className="my-2 border-t-2 border-dashed border-line pt-1 text-center text-xs font-bold uppercase tracking-widest text-faint">
        back nine
      </div>
      {holes.slice(9).map((h, i) => row(h, i + 9))}
      <p className="mt-2 text-xs text-faint">
        Hdcp = hole handicap from the scorecard (1 = hardest hole).
      </p>
      {err ? (
        <p className="mt-1 text-sm font-bold text-danger">{err}</p>
      ) : (
        <button
          type="button"
          className="btn btn-felt mt-2 h-9 w-full text-sm"
          onClick={() => setEditing(false)}
        >
          Done editing
        </button>
      )}
    </div>
  );
}

export function SettingsEditor({
  settings,
  onChange,
  maxKeep = 36,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  maxKeep?: number;
}) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  const is40 = maxKeep >= 72;
  return (
    <div className="divide-y divide-line">
      <Stepper
        label="Scores each team keeps"
        hint={
          is40
            ? "40 Ball keeps 40 of the team's 72 scores"
            : "20 Ball keeps 20 of the team's 36 scores"
        }
        value={settings.keepTarget}
        min={1}
        max={maxKeep}
        onChange={(v) => set({ keepTarget: v })}
      />
      <Stepper
        label="Peeks per team"
        hint="Spend one to peek at the other team's score. 0 = no peeking."
        value={settings.peeksPerTeam}
        min={0}
        max={9}
        onChange={(v) => set({ peeksPerTeam: v })}
      />
      <div className="flex items-center justify-between gap-3 py-2">
        <span>
          <span className="block font-bold">Auto-reveal scores</span>
          <span className="block text-sm text-faint">
            Show both teams&apos; running score as you go
          </span>
        </span>
        <select
          className="input h-11 w-28 px-2"
          value={settings.revealEvery}
          onChange={(e) => set({ revealEvery: Number(e.target.value) })}
        >
          <option value={0}>Never</option>
          <option value={3}>Every 3</option>
          <option value={6}>Every 6</option>
          <option value={9}>At the turn</option>
        </select>
      </div>
      <Toggle
        label="Handicap strokes on par 3s"
        hint="Off = strokes only land on par 4s and 5s"
        checked={settings.allowPar3Strokes}
        onChange={(v) => set({ allowPar3Strokes: v })}
      />
      <Toggle
        label="Lock in scores for good"
        hint={
          settings.keepPolicy === "locked"
            ? "On: once you lock a hole, you can't change which scores count."
            : "Off: you can change a locked hole, but the other team is alerted."
        }
        checked={settings.keepPolicy === "locked"}
        onChange={(v) => set({ keepPolicy: v ? "locked" : "flexible" })}
      />
      <div className="flex items-center justify-between gap-3 py-2">
        <span>
          <span className="block font-bold">Starting holes</span>
          <span className="block text-sm text-faint">
            For shotgun or split-tee starts
          </span>
        </span>
        <span className="flex items-center gap-2">
          {([0, 1] as const).map((i) => (
            <label
              key={i}
              className="flex items-center gap-1 text-xs font-bold uppercase text-faint"
            >
              T{i + 1}
              <select
                className="input h-11 w-16 px-1 text-center"
                value={settings.startHoles[i]}
                onChange={(e) => {
                  const next = [...settings.startHoles] as [number, number];
                  next[i] = Number(e.target.value);
                  set({ startHoles: next });
                }}
              >
                {Array.from({ length: 18 }, (_, k) => k + 1).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 py-2">
        <span>
          <span className="block font-bold">Handicap allowance</span>
          <span className="block text-sm text-faint">
            Keep at 100% for full strokes. Lower it to shrink the edge higher
            handicaps get.
          </span>
        </span>
        <select
          className="input h-11 w-24 px-2"
          value={settings.handicapPercent}
          onChange={(e) => set({ handicapPercent: Number(e.target.value) })}
        >
          {[100, 90, 80, 75, 50].map((v) => (
            <option key={v} value={v}>
              {v}%
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
