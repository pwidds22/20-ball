"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client";
import { Modal } from "@/components/ui";

/** Confirm-and-finish flow: reveals both cards, with server-side warnings
 *  (missing scores, un-locked decisions, kept counts) surfaced first. */
export function FinishModal({
  code,
  onClose,
  refresh,
  notify,
}: {
  code: string;
  onClose: () => void;
  refresh: () => Promise<void>;
  notify: (msg: string) => void;
}) {
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const finish = async (force: boolean) => {
    setBusy(true);
    try {
      await api(`/api/games/${code}/finalize`, { body: { force } });
      await refresh();
      onClose();
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

  return (
    <Modal title="Finish for your team?" onClose={onClose}>
      <p className="text-sm">
        This locks in <b>your team&apos;s</b> card and shows your recap. The
        other team&apos;s scores stay hidden until they finish too — only then
        do both cards reveal and the winner is called. You can reopen your card
        from the Game tab if someone fat-fingers it.
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
        <button className="btn btn-paper h-12 flex-1" onClick={onClose}>
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
  );
}
