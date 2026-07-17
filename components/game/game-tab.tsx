"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/client";
import { CourseEditor, SettingsEditor } from "@/components/setup";
import { Modal } from "@/components/ui";
import {
  fmtToPar,
  validateHoles,
  type GameState,
  type HoleInfo,
  type Settings,
} from "@/lib/engine";

function EditModal({
  state,
  onClose,
  onSaved,
}: {
  state: GameState;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { game, mine, opp } = state;
  const [name, setName] = useState(game.name);
  const [settings, setSettings] = useState<Settings>({ ...game.settings });
  const [holes, setHoles] = useState<HoleInfo[]>(
    game.holes.map((h) => ({ ...h }))
  );
  const [players, setPlayers] = useState(() =>
    [
      ...mine.players.map((p) => ({
        id: p.id,
        team: mine.team,
        name: p.name,
        handicap: String(p.handicap),
      })),
      ...opp.players.map((p) => ({
        id: p.id,
        team: opp.team,
        name: p.name,
        handicap: String(p.handicap),
      })),
    ].sort((a, b) => a.team - b.team)
  );
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const holesErr = validateHoles(holes);
    if (holesErr) return setErr(holesErr);
    for (const p of players) {
      if (!Number.isFinite(Number(p.handicap)))
        return setErr(`Handicap for ${p.name} isn't a number.`);
    }
    setBusy(true);
    setErr("");
    try {
      await api(`/api/games/${game.code}`, {
        method: "PATCH",
        body: {
          name,
          settings,
          holes,
          players: players.map((p) => ({
            id: p.id,
            name: p.name,
            handicap: Number(p.handicap),
          })),
        },
      });
      await onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
      setBusy(false);
    }
  };

  return (
    <Modal title="Edit setup" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <label className="label">Game name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <h3 className="label">Players</h3>
          {players.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 py-1">
              <span className="chip w-14 justify-center bg-ink/10">T{p.team}</span>
              <input
                className="input flex-1"
                value={p.name}
                onChange={(e) =>
                  setPlayers(
                    players.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x
                    )
                  )
                }
              />
              <input
                className="input w-20 text-center"
                inputMode="decimal"
                value={p.handicap}
                onChange={(e) =>
                  setPlayers(
                    players.map((x, j) =>
                      j === i ? { ...x, handicap: e.target.value } : x
                    )
                  )
                }
              />
            </div>
          ))}
          <p className="mt-1 text-xs text-faint">
            Handicap or course changes re-compute strokes for the whole round.
          </p>
        </div>
        <div>
          <h3 className="label">Course card</h3>
          <CourseEditor holes={holes} onChange={setHoles} />
        </div>
        <div>
          <h3 className="label">House rules</h3>
          <SettingsEditor settings={settings} onChange={setSettings} />
        </div>
        {err && <p className="text-sm font-bold text-danger">{err}</p>}
        <button className="btn btn-felt h-12 w-full" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}

export function GameTab({
  state,
  refresh,
  onPeek,
  notify,
}: {
  state: GameState;
  refresh: () => Promise<void>;
  onPeek: () => void;
  notify: (msg: string) => void;
}) {
  const { game, mine, opp, viewer } = state;
  const [editOpen, setEditOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const active = game.status === "active";

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join?code=${game.code}`
      : "";

  const share = async () => {
    const text = `20 Ball — join "${game.name}" with code ${game.code}: ${joinUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* fall through to clipboard */
      }
    }
    await navigator.clipboard.writeText(text);
    notify("Invite copied to clipboard");
  };

  const finish = async (force: boolean) => {
    setBusy(true);
    try {
      await api(`/api/games/${game.code}/finalize`, { body: { force } });
      await refresh();
      setFinishOpen(false);
      setWarnings([]);
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.data.warnings)) {
        setWarnings(e.data.warnings as string[]);
      } else {
        notify(e instanceof Error ? e.message : "Could not finish.");
      }
    } finally {
      setBusy(false);
    }
  };

  const undoFinish = async () => {
    setBusy(true);
    try {
      await api(`/api/games/${game.code}/finalize`, { body: { undo: true } });
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not reopen.");
    } finally {
      setBusy(false);
    }
  };

  const nextReveal = (() => {
    const n = game.settings.revealEvery;
    if (!n) return null;
    const joint = Math.min(mine.progress, opp.progress);
    const next = (Math.floor(joint / n) + 1) * n;
    return next <= 18 ? next : null;
  })();

  const allPlayers = [
    ...mine.players.map((p) => ({ ...p, teamNo: mine.team })),
    ...opp.players.map((p) => ({ ...p, teamNo: opp.team })),
  ].sort((a, b) => a.teamNo - b.teamNo);

  return (
    <div className="space-y-4 p-3">
      <section className="card p-4 text-center">
        <p className="label">Game code — other team joins with this</p>
        <p className="font-display text-5xl font-black tracking-[0.15em] text-felt">
          {game.code}
        </p>
        <button className="btn btn-paper mt-3 h-11 w-full" onClick={share}>
          Share invite
        </button>
      </section>

      {active && (
        <section className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold">Peek at their card</p>
              <p className="text-sm text-faint">
                See their kept count + total. {mine.peeksLeft} left.
              </p>
            </div>
            <button
              className="btn btn-gold h-11 px-4"
              disabled={mine.peeksLeft <= 0}
              onClick={onPeek}
            >
              👁 Peek
            </button>
          </div>
          {opp.peeks.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-line pt-2 text-sm">
              {opp.peeks.map((p, i) => (
                <li key={i}>
                  👁 They&apos;d kept <b>{p.keptCount}</b> at{" "}
                  <b>{fmtToPar(p.toPar)}</b>{" "}
                  <span className="text-faint">(thru {p.thru})</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="card p-4 text-sm">
        <p className="font-bold">House rules</p>
        <ul className="mt-1 space-y-0.5 text-faint">
          <li>Keep {game.settings.keepTarget} scores per team</li>
          <li>
            Strokes on par 3s:{" "}
            {game.settings.allowPar3Strokes ? "allowed" : "no"} ·{" "}
            {game.settings.handicapPercent}% allowance
          </li>
          <li>
            Keeps {game.settings.lockKeeps ? "lock when you score a later hole" : "stay editable"}
          </li>
          <li>
            {game.settings.revealEvery
              ? `Kept counts auto-reveal every ${game.settings.revealEvery} holes` +
                (nextReveal ? ` — next at hole ${nextReveal}` : "")
              : "No auto-reveals"}
          </li>
        </ul>
      </section>

      <section className="card p-4">
        <p className="mb-2 text-sm font-bold">Strokes by hole</p>
        {allPlayers.map((p) => (
          <div key={p.id} className="mb-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-faint">
              {p.name} — {p.strokes.reduce((a, b) => a + b, 0)} strokes
            </p>
            <div className="mt-0.5 grid grid-cols-18 gap-px" style={{ gridTemplateColumns: "repeat(18, 1fr)" }}>
              {state.game.holes.map((h) => (
                <div
                  key={h.hole}
                  className={`h-4 rounded-sm text-center text-[9px] font-bold leading-4 ${
                    (p.strokes[h.hole] ?? 0) > 0
                      ? "bg-felt text-cream"
                      : "bg-ink/10 text-transparent"
                  }`}
                >
                  {p.strokes[h.hole] > 1 ? p.strokes[h.hole] : ""}
                </div>
              ))}
            </div>
          </div>
        ))}
        <p className="mt-1 text-[11px] text-faint">
          green = gets a stroke (number = 2+ strokes), off the low man&apos;s
          handicap
        </p>
      </section>

      {viewer.isCreator && active && (
        <button
          className="btn btn-paper h-12 w-full"
          onClick={() => setEditOpen(true)}
        >
          ✎ Edit setup (course, handicaps, rules)
        </button>
      )}

      {active ? (
        <button
          className="btn btn-felt h-14 w-full text-base"
          onClick={() => {
            setWarnings([]);
            setFinishOpen(true);
          }}
        >
          🏁 Finish round — reveal both cards
        </button>
      ) : (
        <button
          className="btn btn-paper h-12 w-full"
          onClick={undoFinish}
          disabled={busy}
        >
          Reopen round (undo finish)
        </button>
      )}

      <div className="pb-4 text-center">
        <Link href="/" className="text-sm font-bold text-faint underline">
          ← all games
        </Link>
      </div>

      {editOpen && (
        <EditModal
          state={state}
          onClose={() => setEditOpen(false)}
          onSaved={refresh}
        />
      )}

      {finishOpen && (
        <Modal title="Finish the round?" onClose={() => setFinishOpen(false)}>
          <p className="text-sm">
            Both cards flip face-up and the winner is called. You can undo this
            if someone fat-fingers it.
          </p>
          {warnings.length > 0 && (
            <div className="mt-3 rounded-lg border-2 border-gold bg-gold/15 p-3 text-sm">
              <p className="font-bold">Hold on:</p>
              <ul className="list-inside list-disc">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button
              className="btn btn-paper h-12 flex-1"
              onClick={() => setFinishOpen(false)}
            >
              Not yet
            </button>
            <button
              className="btn btn-felt h-12 flex-1"
              disabled={busy}
              onClick={() => finish(warnings.length > 0)}
            >
              {warnings.length > 0 ? "Finish anyway" : "Finish"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
