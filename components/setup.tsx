"use client";

// Course + settings editors shared by the create-game page and the
// creator's mid-round edit modal.

import { validateHoles, type HoleInfo, type Settings } from "@/lib/engine";
import { Stepper, Toggle } from "./ui";

export function CourseEditor({
  holes,
  onChange,
}: {
  holes: HoleInfo[];
  onChange: (h: HoleInfo[]) => void;
}) {
  const err = validateHoles(holes);
  const set = (i: number, patch: Partial<HoleInfo>) => {
    const next = holes.map((h, j) => (j === i ? { ...h, ...patch } : h));
    onChange(next);
  };

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
        <span className="w-16 text-center">SI</span>
      </div>
      {holes.slice(0, 9).map((h, i) => row(h, i))}
      <div className="my-2 border-t-2 border-dashed border-line pt-1 text-center text-xs font-bold uppercase tracking-widest text-faint">
        back nine
      </div>
      {holes.slice(9).map((h, i) => row(h, i + 9))}
      <p className="mt-2 text-xs text-faint">
        SI = stroke index from the card (1 = hardest hole).
      </p>
      {err && <p className="mt-1 text-sm font-bold text-danger">{err}</p>}
    </div>
  );
}

export function SettingsEditor({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
}) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  return (
    <div className="divide-y divide-line">
      <Stepper
        label="Scores each team keeps"
        hint="The classic game keeps 20 of 36"
        value={settings.keepTarget}
        min={1}
        max={36}
        onChange={(v) => set({ keepTarget: v })}
      />
      <Stepper
        label="Peeks per team"
        hint="Burn one to see their kept count + total"
        value={settings.peeksPerTeam}
        min={0}
        max={9}
        onChange={(v) => set({ peeksPerTeam: v })}
      />
      <div className="flex items-center justify-between gap-3 py-2">
        <span>
          <span className="block font-bold">Auto-reveal kept counts</span>
          <span className="block text-sm text-faint">
            Both teams&apos; summaries unlock as you go
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
        label="Strokes on par 3s"
        hint="Off = handicap strokes only land on par 4s/5s"
        checked={settings.allowPar3Strokes}
        onChange={(v) => set({ allowPar3Strokes: v })}
      />
      <Toggle
        label="Lock keeps"
        hint="Decisions freeze once your team scores a later hole"
        checked={settings.lockKeeps}
        onChange={(v) => set({ lockKeeps: v })}
      />
      <div className="flex items-center justify-between gap-3 py-2">
        <span>
          <span className="block font-bold">Handicap allowance</span>
          <span className="block text-sm text-faint">
            % of the difference off the low man
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
