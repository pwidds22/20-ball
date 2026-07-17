"use client";

import { type ReactNode } from "react";

export function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-felt border-t-transparent" />
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        className="card rise w-full max-w-md max-h-[85dvh] overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button
            className="btn btn-paper h-8 w-8 rounded-full text-sm"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 py-2 text-left"
    >
      <span>
        <span className="block font-bold">{label}</span>
        {hint && <span className="block text-sm text-faint">{hint}</span>}
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full border-2 transition-colors ${
          checked ? "border-felt bg-felt" : "border-ink/25 bg-ink/10"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper shadow transition-all ${
            checked ? "left-6" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  label,
  hint,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span>
        <span className="block font-bold">{label}</span>
        {hint && <span className="block text-sm text-faint">{hint}</span>}
      </span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-paper h-10 w-10 text-xl"
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <span className="w-10 text-center font-display text-2xl font-bold tabular-nums">
          {value}
        </span>
        <button
          type="button"
          className="btn btn-paper h-10 w-10 text-xl"
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </button>
      </span>
    </div>
  );
}
