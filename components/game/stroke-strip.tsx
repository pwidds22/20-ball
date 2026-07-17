"use client";

import type { HoleInfo } from "@/lib/engine";

/** Compact 18-cell map of where a player's handicap strokes land. */
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
    <div className="mb-1.5">
      <p className="text-xs font-bold uppercase tracking-wider text-faint">
        {name} — {total} stroke{total === 1 ? "" : "s"}
      </p>
      <div
        className="mt-0.5 grid gap-px"
        style={{ gridTemplateColumns: "repeat(18, 1fr)" }}
      >
        {holes.map((h) => (
          <div
            key={h.hole}
            className={`h-4 rounded-sm text-center text-[9px] font-bold leading-4 ${
              (strokes[h.hole] ?? 0) > 0
                ? "bg-felt text-cream"
                : "bg-ink/10 text-transparent"
            }`}
          >
            {(strokes[h.hole] ?? 0) > 1 ? strokes[h.hole] : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
