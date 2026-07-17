"use client";

import { Fragment } from "react";
import {
  fmtToPar,
  type GameState,
  type HoleInfo,
  type TeamView,
} from "@/lib/engine";
import { StrokeStrip } from "./stroke-strip";

/** Corner dots marking handicap strokes, scorecard-style. */
function Pips({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="absolute right-0.5 top-0 text-[8px] font-black leading-none text-gold">
      {"•".repeat(Math.min(n, 3))}
      {n > 3 ? "+" : ""}
    </span>
  );
}

function segmentTotals(view: TeamView, holes: HoleInfo[], from: number, to: number) {
  let kept = 0;
  let toPar = 0;
  for (const p of view.players) {
    for (let h = from; h <= to; h++) {
      const c = view.cells[p.id]?.[h];
      if (c?.kept && c.gross != null) {
        kept++;
        toPar += c.gross - p.strokes[h] - holes[h - 1].par;
      }
    }
  }
  return { kept, toPar };
}

function Cell({
  view,
  playerId,
  hole,
  strokes,
  par,
}: {
  view: TeamView;
  playerId: string;
  hole: number;
  strokes: number;
  par: number;
}) {
  const c = view.cells[playerId]?.[hole];
  if (!c)
    return (
      <td className="relative border border-line p-1 text-center text-faint">
        <Pips n={strokes} />·
      </td>
    );
  if (c.pickup)
    return (
      <td className="relative border border-line p-1 text-center font-bold text-faint">
        <Pips n={strokes} />X
      </td>
    );
  const net = (c.gross ?? 0) - strokes;
  const netToPar = net - par;
  const netColor =
    netToPar < 0 ? "text-under" : netToPar > 0 ? "text-over" : "";
  const skipped = c.decided && !c.kept;
  return (
    <td className="relative border border-line p-0.5 text-center">
      <Pips n={strokes} />
      <span
        className={`inline-flex min-w-9 items-baseline justify-center gap-1 rounded-md px-1 py-0.5 ${
          c.kept ? "bg-felt font-bold text-cream" : ""
        } ${skipped ? "opacity-50" : ""} ${
          !c.decided ? "border-b-2 border-dotted border-gold" : ""
        }`}
      >
        <span
          className={`text-base font-bold tabular-nums ${
            skipped ? "line-through" : ""
          }`}
        >
          {c.gross}
        </span>
        <span
          className={`text-[10px] tabular-nums ${
            c.kept ? "text-gold" : netColor
          }`}
        >
          {net}
        </span>
      </span>
    </td>
  );
}

function TotalsRow({
  label,
  view,
  holes,
  from,
  to,
}: {
  label: string;
  view: TeamView;
  holes: HoleInfo[];
  from: number;
  to: number;
}) {
  const t = segmentTotals(view, holes, from, to);
  return (
    <tr className="bg-ink/5 font-bold">
      <td colSpan={3} className="border border-line p-1 text-right text-xs uppercase">
        {label}
      </td>
      <td colSpan={2} className="border border-line p-1 text-center text-sm">
        {t.kept} kept · {fmtToPar(t.toPar)}
      </td>
    </tr>
  );
}

export function TeamTable({
  view,
  holes,
  title,
}: {
  view: TeamView;
  holes: HoleInfo[];
  title: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between bg-felt px-3 py-2 text-cream">
        <span className="font-display font-bold">{title}</span>
        <span className="text-sm font-bold tabular-nums">
          {view.keptCount} kept · {fmtToPar(view.toPar)}
        </span>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-xs uppercase text-faint">
            <th className="border border-line p-1 font-bold">H</th>
            <th className="border border-line p-1 font-bold">Par</th>
            <th className="border border-line p-1 font-bold">SI</th>
            {view.players.map((p) => (
              <th key={p.id} className="border border-line p-1 font-bold">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {holes.map((h) => (
            <Fragment key={h.hole}>
              <tr>
                <td className="border border-line p-1 text-center font-bold tabular-nums">
                  {h.hole}
                </td>
                <td className="border border-line p-1 text-center tabular-nums">
                  {h.par}
                </td>
                <td className="border border-line p-1 text-center text-xs tabular-nums text-faint">
                  {h.si}
                </td>
                {view.players.map((p) => (
                  <Cell
                    key={p.id}
                    view={view}
                    playerId={p.id}
                    hole={h.hole}
                    strokes={p.strokes[h.hole] ?? 0}
                    par={h.par}
                  />
                ))}
              </tr>
              {h.hole === 9 && (
                <TotalsRow
                  label="Out"
                  view={view}
                  holes={holes}
                  from={1}
                  to={9}
                />
              )}
              {h.hole === 18 && (
                <TotalsRow
                  label="In"
                  view={view}
                  holes={holes}
                  from={10}
                  to={18}
                />
              )}
            </Fragment>
          ))}
          <tr className="bg-felt/10 font-black">
            <td colSpan={3} className="border border-line p-1 text-right text-xs uppercase">
              Total
            </td>
            <td colSpan={2} className="border border-line p-1 text-center">
              {view.keptCount} kept · {fmtToPar(view.toPar)}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="px-3 py-2 text-[11px] text-faint">
        big = gross · small = net · green = kept · struck = skipped · corner
        dots = handicap strokes · dotted underline = not locked in yet
      </p>
    </div>
  );
}

export function CardView({ state }: { state: GameState }) {
  const { game, mine, opp } = state;

  if (state.final) {
    const [t1, t2] = state.final.teams;
    const nameOf = (t: TeamView) => t.players.map((p) => p.name).join(" & ");
    return (
      <div className="space-y-4 p-3">
        <TeamTable
          view={t1}
          holes={game.holes}
          title={`Team 1 — ${nameOf(t1)}`}
        />
        <TeamTable
          view={t2}
          holes={game.holes}
          title={`Team 2 — ${nameOf(t2)}`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3">
      <TeamTable
        view={mine}
        holes={game.holes}
        title={`Us — ${mine.players.map((p) => p.name).join(" & ")}`}
      />
      <div className="card p-4 text-center">
        <p className="font-display text-lg font-bold">
          {opp.players.map((p) => p.name).join(" & ")}
        </p>
        {opp.reveal ? (
          <p className="mt-1 text-sm">
            Revealed thru {opp.reveal.thru}:{" "}
            <b>{opp.reveal.keptCount} kept</b> ·{" "}
            <b>{fmtToPar(opp.reveal.toPar)}</b>
          </p>
        ) : (
          <p className="mt-1 text-sm text-faint">
            Their card is face-down until the finish
            {game.settings.peeksPerTeam > 0 ? " — unless you peek" : ""}.
          </p>
        )}
        <p className="mt-2 text-xs font-bold uppercase tracking-widest text-faint">
          they&apos;re thru hole {opp.progress || "—"}
        </p>
        <div className="mt-3 border-t border-line pt-2 text-left">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-faint">
            their strokes (holes 1-18)
          </p>
          {opp.players.map((p) => (
            <StrokeStrip
              key={p.id}
              name={p.name}
              strokes={p.strokes}
              holes={game.holes}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
