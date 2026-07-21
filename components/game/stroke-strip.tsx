"use client";

import type { HoleInfo } from "@/lib/engine";

const COLS = { gridTemplateColumns: "repeat(18, minmax(0, 1fr))" } as const;

/** A ruler of hole numbers that lines up above stroke strips. */
function Ruler({ holes }: { holes: HoleInfo[] }) {
  return (
    <div className="grid gap-px" style={COLS}>
      {holes.map((h) => (
        <div
          key={h.hole}
          className={`text-center text-[8px] font-bold leading-4 text-faint ${
            h.hole === 9 ? "border-r-2 border-line" : ""
          }`}
        >
          {h.hole}
        </div>
      ))}
    </div>
  );
}

function Strip({ strokes, holes }: { strokes: number[]; holes: HoleInfo[] }) {
  return (
    <div className="grid gap-px" style={COLS}>
      {holes.map((h) => (
        <div
          key={h.hole}
          className={`h-4 rounded-sm text-center text-[9px] font-bold leading-4 ${
            h.hole === 9 ? "border-r-2 border-line" : ""
          } ${
            (strokes[h.hole] ?? 0) > 0
              ? "bg-felt text-cream"
              : "bg-ink/10 text-transparent"
          }`}
        >
          {(strokes[h.hole] ?? 0) > 1 ? strokes[h.hole] : ""}
        </div>
      ))}
    </div>
  );
}

/** One player's stroke map (hole-number ruler + a strip). */
export function StrokeStrip({
  name,
  strokes,
  holes,
}: {
  name: string;
  strokes: number[];
  holes: HoleInfo[];
}) {
  const total = strokes.reduce((a, b) => a + b, 0);
  return (
    <div className="mb-2">
      <p className="text-xs font-bold uppercase tracking-wider text-faint">
        {name} — {total} stroke{total === 1 ? "" : "s"}
      </p>
      <Ruler holes={holes} />
      <Strip strokes={strokes} holes={holes} />
    </div>
  );
}

/** Several players' stroke maps sharing one hole-number ruler at the top. */
export function StrokeMap({
  players,
  holes,
}: {
  players: { id: string; name: string; strokes: number[] }[];
  holes: HoleInfo[];
}) {
  return (
    <div>
      <div className="mb-0.5 pl-0">
        <Ruler holes={holes} />
      </div>
      {players.map((p) => {
        const total = p.strokes.reduce((a, b) => a + b, 0);
        return (
          <div key={p.id} className="mb-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-faint">
              {p.name} — {total} stroke{total === 1 ? "" : "s"}
            </p>
            <Strip strokes={p.strokes} holes={holes} />
          </div>
        );
      })}
      <p className="mt-1 text-[10px] text-faint">
        Numbers above = hole · green = a stroke (number shown when 2+)
      </p>
    </div>
  );
}
