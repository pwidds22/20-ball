"use client";

import { useState } from "react";
import {
  netLabel,
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
  return (
    <div className="rise">
      <div className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            disabled={disabled}
            onClick={() => onPick(n)}
            className={`btn h-11 text-lg tabular-nums ${
              n === par ? "btn-felt" : "btn-paper"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <button
          disabled={disabled}
          onClick={onPickup}
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

function PlayerPanel({
  player,
  cell,
  hole,
  par,
  active,
  atKeepCap,
  busy,
  onEnter,
  onPickup,
  onClear,
  onToggleKeep,
}: {
  player: PlayerInfo;
  cell: ScoreCell | undefined;
  hole: number;
  par: number;
  active: boolean;
  atKeepCap: boolean;
  busy: boolean;
  onEnter: (gross: number) => Promise<void>;
  onPickup: () => Promise<void>;
  onClear: () => Promise<void>;
  onToggleKeep: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const strokes = player.strokes[hole] ?? 0;
  const showGrid = active && (!cell || editing);

  const net = cell?.gross != null ? cell.gross - strokes : null;
  const netToPar = net != null ? net - par : 0;
  const labelColor =
    netToPar < 0 ? "text-under" : netToPar > 0 ? "text-over" : "text-felt";

  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-lg font-bold">
          {player.name}
          <span className="ml-2 text-sm font-normal text-faint">
            {player.handicap}
          </span>
        </span>
        <span className="text-gold" title={`${strokes} stroke(s) here`}>
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
        <p className="py-3 text-center text-sm text-faint">Round is final.</p>
      ) : cell.pickup ? (
        <div>
          <div className="flex items-center justify-between rounded-xl border-2 border-dashed border-ink/25 bg-ink/5 p-3">
            <span className="font-display text-3xl font-black text-faint">
              X
            </span>
            <span className="chip bg-ink/10 text-faint">picked up · no keep</span>
          </div>
          {active && (
            <button
              className="mt-1.5 text-xs font-bold text-faint underline"
              onClick={() => setEditing(true)}
            >
              ✎ change
            </button>
          )}
        </div>
      ) : (
        <div>
          <button
            disabled={!active || cell.locked || busy || (!cell.kept && atKeepCap)}
            onClick={onToggleKeep}
            className={`w-full rounded-xl border-2 p-3 text-left transition-colors disabled:cursor-not-allowed ${
              cell.kept
                ? "pop border-felt-deep bg-felt text-cream"
                : "border-ink/20 bg-paper active:bg-ink/5"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-5xl font-black tabular-nums">
                  {cell.gross}
                </span>
                <span>
                  <span className="block text-sm font-bold">
                    net {net}
                  </span>
                  <span
                    className={`block text-xs font-black uppercase tracking-wider ${
                      cell.kept ? "text-gold" : labelColor
                    }`}
                  >
                    {netLabel(netToPar)}
                  </span>
                </span>
              </div>
              <span className="text-right">
                {cell.kept ? (
                  <span className="chip bg-cream/25 text-cream">kept ✓</span>
                ) : cell.locked ? (
                  <span className="chip bg-ink/10 text-faint">
                    skipped · locked
                  </span>
                ) : atKeepCap ? (
                  <span className="chip bg-ink/10 text-faint">at cap</span>
                ) : (
                  <span className="chip border-2 border-dashed border-ink/30 text-faint">
                    tap to keep
                  </span>
                )}
              </span>
            </div>
          </button>
          {active && !cell.locked && (
            <button
              className="mt-1.5 text-xs font-bold text-faint underline"
              onClick={() => setEditing(true)}
            >
              ✎ edit score
            </button>
          )}
          {active && cell.locked && (
            <p className="mt-1.5 text-xs text-faint">
              🔒 locked — your team scored a later hole
            </p>
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
}: {
  state: GameState;
  hole: number;
  setHole: (h: number) => void;
  mutate: Mutate;
}) {
  const { game, mine } = state;
  const info = game.holes[hole - 1];
  const active = game.status === "active";
  const [busy, setBusy] = useState(false);
  const atKeepCap = mine.keptCount >= game.settings.keepTarget;

  const run = async (path: string, body: unknown) => {
    setBusy(true);
    await mutate(path, body);
    setBusy(false);
  };
  const base = `/api/games/${game.code}`;

  const bothEntered = mine.players.every((p) => mine.cells[p.id]?.[hole]);

  const holeStatus = (h: number) => {
    let entered = 0;
    let kept = 0;
    for (const p of mine.players) {
      const c = mine.cells[p.id]?.[h];
      if (c) entered++;
      if (c?.kept) kept++;
    }
    if (kept > 0) return "bg-felt text-cream border-felt-deep";
    if (entered === 2) return "bg-ink/70 text-cream border-ink/70";
    if (entered === 1) return "bg-ink/25 border-ink/25";
    return "bg-paper border-ink/20";
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
          disabled={hole <= 1}
          onClick={() => setHole(hole - 1)}
        >
          ‹
        </button>
        <div className="text-center">
          <div className="font-display text-3xl font-black">
            Hole {info.hole}
          </div>
          <div className="text-xs font-bold uppercase tracking-widest text-faint">
            par {info.par} · SI {info.si}
          </div>
        </div>
        <button
          className="btn btn-paper h-11 w-11 text-xl"
          disabled={hole >= 18}
          onClick={() => setHole(hole + 1)}
        >
          ›
        </button>
      </div>

      {mine.players.map((p) => (
        <PlayerPanel
          key={p.id}
          player={p}
          cell={mine.cells[p.id]?.[hole]}
          hole={hole}
          par={info.par}
          active={active}
          atKeepCap={atKeepCap}
          busy={busy}
          onEnter={(gross) => run(`${base}/score`, { playerId: p.id, hole, gross })}
          onPickup={() => run(`${base}/score`, { playerId: p.id, hole, pickup: true })}
          onClear={() => run(`${base}/score`, { playerId: p.id, hole, clear: true })}
          onToggleKeep={() =>
            run(`${base}/keep`, {
              playerId: p.id,
              hole,
              kept: !mine.cells[p.id]?.[hole]?.kept,
            })
          }
        />
      ))}

      {bothEntered && hole < 18 && (
        <button
          className="btn btn-gold h-12 w-full text-base"
          onClick={() => setHole(hole + 1)}
        >
          Next hole →
        </button>
      )}
    </div>
  );
}
