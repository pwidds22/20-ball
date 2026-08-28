// Outbound email via Resend's HTTP API (no SDK — one endpoint, one fetch).
// Everything email-flavored is feature-flagged on RESEND_API_KEY being set.

import { EMAIL_FROM, RESEND_API_KEY } from "./config";

export const emailEnabled = () => RESEND_API_KEY !== "";

/** Loose shape check + length cap; storage is what the user typed. */
export function normalizeEmail(raw: unknown): string | null {
  const email = String(raw ?? "").trim();
  if (!email) return null;
  if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) return null;
  return email;
}

/** Sends one plain-text email. Returns false (and logs) on failure — the
 *  caller decides whether that's fatal. */
export async function sendEmail(to: string, subject: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, text }),
    cache: "no-store",
  }).catch(() => null);
  if (!res || !res.ok) {
    const detail = res ? `${res.status} ${await res.text().catch(() => "")}` : "network error";
    console.error(`sendEmail to Resend failed: ${detail}`);
    return false;
  }
  return true;
}
