"use client";

// Client-side fetch helpers + the polling hook that keeps a game live.

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState } from "./engine";

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api<T = Record<string, unknown>>(
  path: string,
  opts?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(path, {
    method: opts?.method ?? (opts?.body !== undefined ? "POST" : "GET"),
    headers:
      opts?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      typeof data.error === "string" ? data.error : `Request failed (${res.status})`,
      res.status,
      data
    );
  }
  return data as T;
}

/** Polls game state every 4s while the tab is visible. */
export function useGame(code: string) {
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const s = await api<GameState>(`/api/games/${code}/state`);
      setState(s);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError) setError(e);
    } finally {
      inflight.current = false;
    }
  }, [code]);

  useEffect(() => {
    refresh();
    const iv = setInterval(() => {
      if (!document.hidden) refresh();
    }, 4000);
    const onVis = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  return { state, error, refresh };
}
