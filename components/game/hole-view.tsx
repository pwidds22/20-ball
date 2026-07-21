"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui";
import {
  netLabel,
  orderIndex,
  playOrder,
  type GameState,
  type PlayerInfo,
  type ScoreCell,
} from "@/lib/engine";

type Mutate = (path: string, body: unknown) => Promise<boolean>;

function ScoreGrid({
  par,
  hasCell,
  onPick,
  onPickup,
  onClear,
  onCancel,
  disabled,
}: {
  par: number;
  hasCell: boolean;
  onPick: (gross: number) => void;
  onPickup: () => void;
  onClear: () => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  // Cap at double par — anything worse is a pickup (X).
  const maxScore = par * 2;
  return (
    <div className="rise">
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: maxScore }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            disabled={disabled}
            onClick={() => onPick(n)}
            className="btn btn-paper h-11 text-lg tabular-nums"
          >
            {n}
          </button>
        ))}
      </div>
      <p className="mt-1 text-center text-[11px] text-faint">
        Double par ({maxScore}) is the max — worse than that, tap X.
      </p>
      <div className="mt-1.5 flex gap-1.5">
        <button
          disabled={disabled}
          onClick={() => {
            if (
              window.confirm(
                "Mark an X (picked up)? An X can never be kept, and it counts as decided right away."
              )
            )
              onPickup();
          }}
          className="btn btn-paper h-10 flex-1 text-sm text-danger"
        >
          X · picked up
        </button>
        {hasCell && (
          <>
            <button
              disabled={disabled}
              onClick={onClear}
              className="btn btn-paper h-10 flex-1 text-sm"
            >
              clear
            </button>
            <button
              disabled={disabled}
              onClick={onCancel}
              className="btn btn-paper h-10 flex-1 text-sm"
            >
              cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ScoreReadout({
  cell,
  strokes,
  par,
  inverse,
}: {
  cell: ScoreCell;
  strokes: number;
  par: number;
  inverse?: boolean;
}) {
  const net = (cell.gross ?? 0) - strokes;
  const netToPar = net - par;
  const labelColor =
    netToPar < 0 ? "text-under" : netToPar > 0 ? "text-over" : "text-felt";
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-display text-5xl font-black tabular-nums">
        {cell.gross}
      </span>
      <span>
        <span className="block text-sm font-bold">net {net}</span>
        <span
          className={`block text-xs font-black uppercase tracking-wider ${
            inverse ? "text-gold" : labelColor
          }`}
        >
          {netLabel(netToPar)}
        </span>
      </span>
    </div>
  );
}

function PlayerPanel({
  player,
  cell,
  hole,
  par,
  active,
  policy,
  busy,
  holeClosed,
  selection,
  onSelect,
  onEnter,
  onPickup,
  onClear,
  onRequestChange,
}: {
  player: PlayerInfo;
  cell: ScoreCell | undefined;
  hole: number;
  par: number;
  active: boolean;
  policy: "locked" | "flexible";
  busy: boolean;
  holeClosed: boolean;
  selection: boolean | undefined;
  onSelect: (keep: boolean) => void;
  onEnter: (gross: number) => Promise<void>;
  onPickup: () => Promise<void>;
  onClear: () => Promise<void>;
  onRequestChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  useEffect(() => setEditing(false), [hole]);
  const strokes = player.strokes[hole] ?? 0;

  const canUseGrid =
    active && (!cell || (!cell.decided && editing) || (cell.decided && policy === "flexible" && editing));
  const showGrid = active && ((!cell && !holeClosed) || editing) && canUseGrid;

  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-lg font-bold">
          {player.name}
          <span className="ml-2 text-sm font-normal text-faint">
            {player.handicap}
          </span>
        </span>
        <span className="text-gold">
          {strokes > 0 ? "●".repeat(Math.min(strokes, 4)) : ""}
          {strokes > 0 && (
            <span className="ml-1 text-xs font-bold uppercase text-faint">
              {strokes} stroke{strokes > 1 ? "s" : ""}
            </span>
          )}
        </span>
      </div>

      {showGrid ? (
        <ScoreGrid
          par={par}
          hasCell={!!cell}
          disabled={busy}
          onPick={async (g) => {
            await onEnter(g);
            setEditing(false);
          }}
          onPickup={async () => {
            await onPickup();
            setEditing(false);
          }}
          onClear={async () => {
            await onClear();
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : !cell ? (
        <p className="py-3 text-center text-sm text-faint">
          {holeClosed
            ? "Hole closed — locked without a score."
            : "Round is final."}
        </p>
      ) : cell.pickup ? (
        <div>
          <div className="flex items-center justify-between rounded-xl border-2 border-dashed border-ink/25 bg-ink/5 p-3">
            <span className="font-display text-3xl font-black text-faint">
              X
            </span>
            <span className="chip bg-ink/10 text-faint">
              picked up · auto-skip
            </span>
          </div>
          {active && policy === "flexible" && (
            <button
              className="mt-1.5 text-xs font-bold text-faint underline"
              onClick={() => setEditing(true)}
            >
              ✎ change (alerts the other team)
            </button>
          )}
        </div>
      ) : !cell.decided ? (
        <div>
          <div className="rounded-xl border-2 border-ink/20 bg-paper p-3">
            <div className="flex items-center justify-between gap-2">
              <ScoreReadout cell={cell} strokes={strokes} par={par} />
              <div className="flex flex-col gap-1.5">
                <button
                  disabled={!active || busy}
                  onClick={() => onSelect(true)}
                  className={`btn h-10 px-4 text-sm ${
                    selection === true
                      ? "btn-felt"
                      : "btn-paper border-dashed"
                  }`}
                >
                  Keep
                </button>
                <button
                  disabled={!active || busy}
                  onClick={() => onSelect(false)}
                  className={`btn h-10 px-4 text-sm ${
                    selection === false
                      ? "bg-ink text-cream"
                      : "btn-paper border-dashed"
                  }`}
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
          {active && (
            <button
              className="mt-1.5 text-xs font-bold text-faint underline"
              onClick={() => setEditing(true)}
            >
              ✎ edit score
            </button>
          )}
        </div>
      ) : (
        <div>
          <div
            className={`rounded-xl border-2 p-3 ${
              cell.kept
                ? "border-felt-deep bg-felt text-cream"
                : "border-ink/15 bg-ink/5"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className={cell.kept ? "" : "opacity-60"}>
                <ScoreReadout
                  cell={cell}
                  strokes={strokes}
                  par={par}
                  inverse={cell.kept}
                />
              </div>
              <span className="text-right">
                {cell.kept ? (
                  <span className="chip bg-cream/25 text-cream">
                    kept ✓ {policy === "locked" ? "🔒" : ""}
                  </span>
                ) : (
                  <span className="chip bg-ink/10 text-faint">
                    skipped {policy === "locked" ? "🔒" : ""}
                  </span>
                )}
              </span>
            </div>
          </div>
          {active && policy === "flexible" && (
            <button
              className="mt-1.5 text-xs font-bold text-danger underline"
              onClick={onRequestChange}
            >
              change decision (alerts the other team)
            </button>
          )}
          {active && policy === "locked" && (
            <p className="mt-1.5 text-xs text-faint">🔒 locked in — final</p>
          )}
        </div>
      )}
    </div>
  );
}

export function HoleView({
  state,
  hole,
  setHole,
  mutate,
  onFinish,
}: {
  state: GameState;
  hole: number;
  setHole: (h: number) => void;
  mutate: Mutate;
  onFinish: () => void;
}) {
  const { game, mine } = state;
  const info = game.holes[hole - 1];
  const active = game.status === "active";
  const policy = game.settings.keepPolicy;
  const target = game.settings.keepTarget;
  const [busy, setBusy] = useState(false);
  const [selections, setSelections] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [changeReq, setChangeReq] = useState<{
    player: PlayerInfo;
    cell: ScoreCell;
  } | null>(null);

  useEffect(() => {
    setSelections({});
    setConfirmOpen(false);
  }, [hole]);

  const run = async (path: string, body: unknown) => {
    setBusy(true);
    const ok = await mutate(path, body);
    setBusy(false);
    return ok;
  };
  const base = `/api/games/${game.code}`;

  const order = playOrder(mine.startHole);
  const orderPos = orderIndex(hole, mine.startHole);

  const cellOf = (p: PlayerInfo) => mine.cells[p.id]?.[hole];
  const undecided = mine.players.filter((p) => {
    const c = cellOf(p);
    return c && !c.decided && !c.pickup;
  });
  const blockedBy =
    active &&
    policy === "locked" &&
    mine.pendingHole !== null &&
    orderIndex(mine.pendingHole, mine.startHole) < orderPos
      ? mine.pendingHole
      : null;
  const holeClosed =
    active && policy === "locked" && orderPos <= mine.decidedThruOrder;

  const allSelected = undecided.every((p) => selections[p.id] !== undefined);
  const keepAdds = undecided.filter((p) => selections[p.id] === true).length;
  const wouldKeep = mine.keptCount + keepAdds;
  const overCap = wouldKeep > target;

  const allSettled =
    mine.players.every((p) => {
      const c = cellOf(p);
      return c ? c.decided : holeClosed;
    }) && mine.players.some((p) => cellOf(p));

  const holeStatus = (h: number) => {
    let entered = 0;
    let kept = 0;
    let undec = 0;
    for (const p of mine.players) {
      const c = mine.cells[p.id]?.[h];
      if (c) entered++;
      if (c?.kept) kept++;
      if (c && !c.decided) undec++;
    }
    if (undec > 0) return "bg-gold/70 border-gold";
    if (kept > 0) return "bg-felt text-cream border-felt-deep";
    if (entered === 2) return "bg-ink/70 text-cream border-ink/70";
    if (entered === 1) return "bg-ink/25 border-ink/25";
    return "bg-paper border-ink/20";
  };

  const lockIn = async () => {
    const ok = await run(`${base}/decide`, {
      hole,
      decisions: undecided.map((p) => ({
        playerId: p.id,
        keep: selections[p.id],
      })),
    });
    if (ok) {
      setConfirmOpen(false);
      setSelections({});
    }
  };

  return (
    <div className="space-y-3 p-3">
      <div className="grid grid-cols-9 gap-1">
        {game.holes.map((h) => (
          <button
            key={h.hole}
            onClick={() => setHole(h.hole)}
            className={`h-8 rounded-md border-2 text-xs font-bold tabular-nums transition ${holeStatus(
              h.hole
            )} ${h.hole === hole ? "ring-2 ring-gold" : ""}`}
          >
            {h.hole}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          className="btn btn-paper h-11 w-11 text-xl"
          disabled={orderPos <= 0}
          onClick={() => setHole(order[orderPos - 1])}
        >
          ‹
        </button>
        <div className="text-center">
          <div className="font-display text-3xl font-black">
            Hole {info.hole}
          </div>
          <div className="text-xs font-bold uppercase tracking-widest text-faint">
            par {info.par} · hdcp {info.si}
            {mine.startHole !== 1 && ` · #${orderPos + 1} of your round`}
          </div>
        </div>
        <button
          className="btn btn-paper h-11 w-11 text-xl"
          disabled={orderPos >= 17}
          onClick={() => setHole(order[orderPos + 1])}
        >
          ›
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-ink/5 px-2.5 py-1.5 text-xs">
        <span className="font-bold uppercase tracking-wider text-faint">
          Their strokes here:
        </span>
        {state.opp.players.map((p) => {
          const s = p.strokes[hole] ?? 0;
          return (
            <span
              key={p.id}
              className={s > 0 ? "font-bold text-felt" : "text-faint"}
            >
              {p.name}{" "}
              {s > 0 ? "●".repeat(Math.min(s, 3)) + (s > 1 ? ` ${s}` : "") : "–"}
            </span>
          );
        })}
      </div>

      {blockedBy && (
        <div className="card border-gold bg-gold/15 p-3 text-center">
          <p className="text-sm font-bold">
            Lock in hole {blockedBy} before scoring this one.
          </p>
          <button
            className="btn btn-gold mt-2 h-10 px-4 text-sm"
            onClick={() => setHole(blockedBy)}
          >
            Go to hole {blockedBy}
          </button>
        </div>
      )}

      {!blockedBy &&
        mine.players.map((p) => (
          <PlayerPanel
            key={p.id}
            player={p}
            cell={cellOf(p)}
            hole={hole}
            par={info.par}
            active={active}
            policy={policy}
            busy={busy}
            holeClosed={holeClosed}
            selection={selections[p.id]}
            onSelect={(keep) =>
              setSelections((s) => ({ ...s, [p.id]: keep }))
            }
            onEnter={async (gross) => {
              await run(`${base}/score`, { playerId: p.id, hole, gross });
            }}
            onPickup={async () => {
              await run(`${base}/score`, { playerId: p.id, hole, pickup: true });
            }}
            onClear={async () => {
              await run(`${base}/score`, { playerId: p.id, hole, clear: true });
            }}
            onRequestChange={() => {
              const c = cellOf(p);
              if (c) setChangeReq({ player: p, cell: c });
            }}
          />
        ))}

      {active && !blockedBy && undecided.length > 0 && (
        <div className="card sticky bottom-20 border-felt bg-paper p-3 shadow-xl">
          {overCap && (
            <p className="mb-2 text-center text-sm font-bold text-danger">
              That&apos;s {wouldKeep}/{target} kept — too many. Skip something.
            </p>
          )}
          <button
            className="btn btn-felt h-12 w-full text-base"
            disabled={!allSelected || overCap || busy}
            onClick={() => setConfirmOpen(true)}
          >
            🔒 Lock in hole {hole}
          </button>
          {!allSelected && (
            <p className="mt-1.5 text-center text-xs font-bold uppercase tracking-wider text-faint">
              choose keep or skip for each score first
            </p>
          )}
        </div>
      )}

      {allSettled && orderPos < 17 && (
        <button
          className="btn btn-gold h-12 w-full text-base"
          onClick={() => setHole(order[orderPos + 1])}
        >
          Next hole ({order[orderPos + 1]}) →
        </button>
      )}

      {active && mine.roundComplete && (
        <button
          className="btn btn-gold h-14 w-full text-base"
          onClick={onFinish}
        >
          🏁 That&apos;s 18 — finish &amp; reveal the cards
        </button>
      )}

      {confirmOpen && (
        <Modal title={`Lock in hole ${hole}?`} onClose={() => setConfirmOpen(false)}>
          <ul className="space-y-2">
            {undecided.map((p) => {
              const c = cellOf(p)!;
              const keep = selections[p.id];
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border-2 border-line p-2.5"
                >
                  <span className="font-bold">
                    {p.name}: {c.gross}
                    <span className="ml-1 text-sm font-normal text-faint">
                      net {(c.gross ?? 0) - (p.strokes[hole] ?? 0)}
                    </span>
                  </span>
                  <span
                    className={`chip ${
                      keep ? "bg-felt text-cream" : "bg-ink/15 text-ink"
                    }`}
                  >
                    {keep ? "KEEP" : "SKIP"}
                  </span>
                </li>
              );
            })}
          </ul>
          {mine.players.some((p) => !cellOf(p)) && policy === "locked" && (
            <p className="mt-3 rounded-lg border-2 border-gold bg-gold/15 p-2 text-sm font-bold">
              ⚠ Not every player has a score on this hole — once locked, the
              hole closes and missing scores can&apos;t be added.
            </p>
          )}
          <p className="mt-3 text-center text-sm">
            You&apos;ll be at <b>{wouldKeep}/{target}</b> kept.{" "}
            {policy === "locked"
              ? "This is final — no take-backs."
              : "Changing it later alerts the other team."}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              className="btn btn-paper h-12 flex-1"
              onClick={() => setConfirmOpen(false)}
            >
              Wait
            </button>
            <button
              className="btn btn-felt h-12 flex-1"
              disabled={busy}
              onClick={lockIn}
            >
              Lock it in
            </button>
          </div>
        </Modal>
      )}

      {changeReq && (
        <Modal title="Change a locked decision?" onClose={() => setChangeReq(null)}>
          <p className="text-sm">
            Flip <b>{changeReq.player.name}</b>&apos;s hole {hole} ({changeReq.cell.gross})
            from <b>{changeReq.cell.kept ? "KEEP to SKIP" : "SKIP to KEEP"}</b>?
          </p>
          <p className="mt-2 rounded-lg border-2 border-danger/40 bg-danger/10 p-2 text-sm font-bold text-danger">
            ⚠ The other team will see an alert about this change.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              className="btn btn-paper h-12 flex-1"
              onClick={() => setChangeReq(null)}
            >
              Never mind
            </button>
            <button
              className="btn h-12 flex-1 bg-danger text-white"
              disabled={busy}
              onClick={async () => {
                const ok = await run(`${base}/decide`, {
                  hole,
                  decisions: [
                    {
                      playerId: changeReq.player.id,
                      keep: !changeReq.cell.kept,
                    },
                  ],
                });
                if (ok) setChangeReq(null);
              }}
            >
              Change it
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
