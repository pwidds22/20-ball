"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, useGame } from "@/lib/client";
import { Modal, Spinner } from "@/components/ui";
import { HoleView } from "@/components/game/hole-view";
import { CardView } from "@/components/game/card-view";
import { GameTab } from "@/components/game/game-tab";
import { fmtToPar, type GameState } from "@/lib/engine";

type Tab = "hole" | "card" | "game";

function firstOpenHole(state: GameState): number {
  if (state.mine.pendingHole) return state.mine.pendingHole;
  const start =
    state.game.settings.keepPolicy === "locked"
      ? state.mine.decidedThru + 1
      : 1;
  for (let h = Math.max(1, Math.min(start, 18)); h <= 18; h++) {
    for (const p of state.mine.players) {
      if (!state.mine.cells[p.id]?.[h]) return h;
    }
  }
  return 18;
}

function StatusHeader({
  state,
  onPeek,
}: {
  state: GameState;
  onPeek: () => void;
}) {
  const { game, mine, opp } = state;
  const target = game.settings.keepTarget;
  const lastPeek = opp.peeks[opp.peeks.length - 1];

  return (
    <header className="sticky top-0 z-30 bg-felt text-cream shadow-lg">
      <div className="mx-auto max-w-md px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-widest text-cream/80">
          <span className="truncate">{game.name}</span>
          <span className="shrink-0">
            code {game.code}
            {game.status === "final" && " · FINAL"}
          </span>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-felt-deep/60 p-2.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-gold">
              Us — {mine.players.map((p) => p.name.split(" ")[0]).join(" & ")}
            </p>
            <p className="font-display text-2xl font-black tabular-nums leading-tight">
              {mine.keptCount}
              <span className="text-base font-bold text-cream/70">
                /{target}
              </span>
              <span className="ml-2">{fmtToPar(mine.toPar)}</span>
            </p>
            <p
              className={`text-[11px] font-bold uppercase tracking-wider ${
                mine.skipsLeft > 3
                  ? "text-cream/70"
                  : mine.skipsLeft > 0
                    ? "text-gold"
                    : "text-red-300"
              }`}
            >
              {mine.skipsLeft > 0
                ? `${mine.skipsLeft} skips left`
                : mine.skipsLeft === 0
                  ? "no skips left!"
                  : `short ${-mine.skipsLeft}!`}
            </p>
          </div>
          <div className="rounded-xl bg-felt-deep/60 p-2.5">
            <div className="flex items-start justify-between gap-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-cream/70">
                Them —{" "}
                {opp.players.map((p) => p.name.split(" ")[0]).join(" & ")}
              </p>
              {game.status === "active" && mine.peeksLeft > 0 && (
                <button
                  onClick={onPeek}
                  className="chip shrink-0 bg-gold text-ink"
                >
                  👁 {mine.peeksLeft}
                </button>
              )}
            </div>
            {state.final ? (
              <p className="font-display text-2xl font-black tabular-nums leading-tight">
                {state.final.teams[opp.team - 1].keptCount}
                <span className="ml-2">
                  {fmtToPar(state.final.teams[opp.team - 1].toPar)}
                </span>
              </p>
            ) : opp.reveal ? (
              <>
                <p className="font-display text-2xl font-black tabular-nums leading-tight">
                  {opp.reveal.keptCount}
                  <span className="ml-2">{fmtToPar(opp.reveal.toPar)}</span>
                </p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-cream/70">
                  revealed thru {opp.reveal.thru}
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-2xl font-black leading-tight">
                  🔒
                </p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-cream/70">
                  {lastPeek
                    ? `peek: ${lastPeek.keptCount} kept · ${fmtToPar(lastPeek.toPar)} (thru ${lastPeek.thru})`
                    : `thru ${opp.progress || "—"} · face-down`}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default function GamePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { state, error, refresh } = useGame(code);
  const [tab, setTab] = useState<Tab>("hole");
  const [hole, setHole] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [peekConfirm, setPeekConfirm] = useState(false);
  const [peekResult, setPeekResult] = useState<{
    thru: number;
    keptCount: number;
    toPar: number;
  } | null>(null);
  const holeInit = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!error) return;
    if (error.status === 401) router.replace("/");
    else if (error.status === 403 && error.data?.needsJoin)
      router.replace(`/join?code=${code}`);
  }, [error, router, code]);

  useEffect(() => {
    if (state && !holeInit.current) {
      holeInit.current = true;
      setHole(firstOpenHole(state));
    }
  }, [state]);

  const notify = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  }, []);

  const mutate = useCallback(
    async (path: string, body: unknown) => {
      try {
        await api(path, { body });
        await refresh();
        return true;
      } catch (e) {
        notify(e instanceof Error ? e.message : "That didn't work.");
        await refresh();
        return false;
      }
    },
    [refresh, notify]
  );

  // Toast when the OTHER team changes a locked decision/score.
  const lastOppAlert = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!state) return;
    const latest = state.alerts.find((a) => a.team !== state.viewer.team);
    const key = latest ? `${latest.at}|${latest.message}` : null;
    if (lastOppAlert.current === undefined) {
      lastOppAlert.current = key; // don't replay history on first load
      return;
    }
    if (key && key !== lastOppAlert.current) {
      lastOppAlert.current = key;
      notify(`⚠ ${latest!.message}`);
    }
  }, [state, notify]);

  const doPeek = async () => {
    try {
      const res = await api<{
        peek: { thru: number; keptCount: number; toPar: number };
      }>(`/api/games/${code}/peek`, { body: {} });
      setPeekResult(res.peek);
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Peek failed.");
    } finally {
      setPeekConfirm(false);
    }
  };

  if (error && error.status === 404) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <p className="font-display text-2xl font-bold">Game not found</p>
        <Link href="/" className="mt-3 inline-block font-bold underline">
          ← back home
        </Link>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="mx-auto max-w-md p-6">
        <Spinner />
        {error && (
          <p className="text-center text-sm font-bold text-danger">
            {error.message}
          </p>
        )}
      </main>
    );
  }

  const winnerBanner = (() => {
    if (!state.final) return null;
    const { teams, winner } = state.final;
    if (winner === 0)
      return `All square — both teams ${fmtToPar(teams[0].toPar)}`;
    const w = teams[winner - 1];
    const l = teams[2 - winner];
    return `${w.players.map((p) => p.name).join(" & ")} win ${fmtToPar(w.toPar)} to ${fmtToPar(l.toPar)}`;
  })();

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-24">
      <StatusHeader state={state} onPeek={() => setPeekConfirm(true)} />

      {winnerBanner && (
        <div className="bg-gold px-3 py-2 text-center text-sm font-black uppercase tracking-wider text-ink">
          🏆 {winnerBanner}
        </div>
      )}

      {state.game.status === "active" && state.mine.skipsLeft === 0 && (
        <div className="bg-danger px-3 py-2 text-center text-sm font-bold text-white">
          Out of skips — every remaining score must be kept.
        </div>
      )}
      {state.game.status === "active" && state.mine.skipsLeft < 0 && (
        <div className="bg-danger px-3 py-2 text-center text-sm font-bold text-white">
          You can no longer reach {state.game.settings.keepTarget} keeps — max
          possible is {state.mine.potential}.
        </div>
      )}

      {notice && (
        <div className="fixed left-1/2 top-3 z-50 w-[92%] max-w-md -translate-x-1/2 rounded-xl border-2 border-danger bg-paper p-3 text-center text-sm font-bold text-danger shadow-xl">
          {notice}
        </div>
      )}

      <main>
        {tab === "hole" && (
          <HoleView state={state} hole={hole} setHole={setHole} mutate={mutate} />
        )}
        {tab === "card" && <CardView state={state} />}
        {tab === "game" && (
          <GameTab
            state={state}
            refresh={refresh}
            onPeek={() => setPeekConfirm(true)}
            notify={notify}
          />
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-1 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {(
            [
              ["hole", "⛳", "Hole"],
              ["card", "▦", "Card"],
              ["game", "☰", "Game"],
            ] as const
          ).map(([t, icon, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`btn h-12 flex-col gap-0 text-[11px] ${
                tab === t ? "bg-felt text-cream" : "text-faint"
              }`}
            >
              <span className="text-base leading-none">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </nav>

      {peekConfirm && (
        <Modal title="Use a peek?" onClose={() => setPeekConfirm(false)}>
          <p className="text-sm">
            Your team has <b>{state.mine.peeksLeft}</b> peek
            {state.mine.peeksLeft === 1 ? "" : "s"} left. A peek shows the other
            team&apos;s kept count and total right now — they won&apos;t be
            told.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              className="btn btn-paper h-12 flex-1"
              onClick={() => setPeekConfirm(false)}
            >
              Cancel
            </button>
            <button className="btn btn-gold h-12 flex-1" onClick={doPeek}>
              👁 Peek
            </button>
          </div>
        </Modal>
      )}

      {peekResult && (
        <Modal title="👁 Their card right now" onClose={() => setPeekResult(null)}>
          <p className="py-3 text-center font-display text-4xl font-black tabular-nums">
            {peekResult.keptCount} kept · {fmtToPar(peekResult.toPar)}
          </p>
          <p className="text-center text-sm text-faint">
            thru hole {peekResult.thru || "—"} — saved to your Game tab
          </p>
          <button
            className="btn btn-felt mt-4 h-12 w-full"
            onClick={() => setPeekResult(null)}
          >
            Got it
          </button>
        </Modal>
      )}
    </div>
  );
}
