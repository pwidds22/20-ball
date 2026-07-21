"use client";

import { Fragment } from "react";
import {
  fmtToPar,
  fmtUsed,
  playerRoundTotals,
  type GameState,
  type HoleInfo,
  type TeamView,
} from "@/lib/engine";
import { StrokeMap } from "./stroke-strip";

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
  compact,
}: {
  view: TeamView;
  playerId: string;
  hole: number;
  strokes: number;
  par: number;
  compact?: boolean;
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
        className={`inline-flex items-baseline justify-center rounded-md py-0.5 ${
          compact ? "min-w-6 gap-0.5 px-0.5" : "min-w-9 gap-1 px-1"
        } ${
          c.kept ? "bg-felt font-bold text-cream" : ""
        } ${skipped ? "opacity-50" : ""} ${
          !c.decided ? "border-b-2 border-dotted border-gold" : ""
        }`}
      >
        <span
          className={`font-bold tabular-nums ${
            compact ? "text-sm" : "text-base"
          } ${skipped ? "line-through" : ""}`}
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
  const compact = view.players.length > 2;
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
            <th className="border border-line p-1 font-bold">Hdcp</th>
            {view.players.map((p) => (
              <th
                key={p.id}
                className={`border border-line p-1 font-bold ${
                  compact ? "max-w-10 truncate px-0.5 text-[9px]" : ""
                }`}
              >
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
                    compact={compact}
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

function PlayerRounds({
  teams,
  holes,
}: {
  teams: TeamView[];
  holes: HoleInfo[];
}) {
  const rows = teams
    .flatMap((t) => playerRoundTotals(t, holes))
    .sort((a, b) => a.net - a.parSum - (b.net - b.parSum));
  const anyShort = rows.some((r) => r.holesIn < 18);
  const anySplit = rows.some((r) => !Number.isInteger(Math.round(r.used * 10) / 10));

  return (
    <div className="card overflow-hidden">
      <div className="bg-felt px-3 py-2 font-display font-bold text-cream">
        Player rounds
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase text-faint">
            <th className="border-b-2 border-line p-2 text-left font-bold">
              Player
            </th>
            <th className="border-b-2 border-line p-2 font-bold">Gross</th>
            <th className="border-b-2 border-line p-2 font-bold">Net</th>
            <th className="border-b-2 border-line p-2 font-bold">Used</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.player.id} className="border-b border-line last:border-0">
              <td className="p-2 text-left">
                <span className="font-display font-bold">{r.player.name}</span>
                <span className="ml-1.5 text-xs text-faint">
                  T{r.team} · {r.player.handicap}
                </span>
              </td>
              <td className="p-2 text-center tabular-nums">
                {r.holesIn === 0 ? (
                  "—"
                ) : (
                  <>
                    <b>{r.gross}</b>
                    {r.holesIn < 18 ? "*" : ""}{" "}
                    <span className="text-xs text-faint">
                      ({fmtToPar(r.gross - r.parSum)})
                    </span>
                  </>
                )}
              </td>
              <td className="p-2 text-center tabular-nums">
                {r.holesIn === 0 ? (
                  "—"
                ) : (
                  <>
                    <b>{r.net}</b>{" "}
                    <span
                      className={`text-xs ${
                        r.net - r.parSum < 0 ? "text-under" : "text-faint"
                      }`}
                    >
                      ({fmtToPar(r.net - r.parSum)})
                    </span>
                  </>
                )}
              </td>
              <td className="p-2 text-center font-bold tabular-nums">
                {fmtUsed(r.used)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[11px] text-faint">
        Used = kept scores credited to each golfer
        {anySplit ? " — a tie the team could have kept either way splits ½ and ½" : ""}
        {anyShort
          ? ". * = picked up or skipped some holes; totals cover finished holes"
          : ""}
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
        <PlayerRounds teams={[t1, t2]} holes={game.holes} />
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
          they&apos;ve played {opp.progress} of 18
          {opp.startHole !== 1 && ` (starting hole ${opp.startHole})`}
        </p>
        <div className="mt-3 border-t border-line pt-2 text-left">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-faint">
            their strokes by hole
          </p>
          <StrokeMap
            players={opp.players.map((p) => ({
              id: p.id,
              name: p.name,
              strokes: p.strokes,
            }))}
            holes={game.holes}
          />
        </div>
      </div>
    </div>
  );
}
