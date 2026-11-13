# Roadmap

**Companion docs:** [`VISION.md`](VISION.md) (direction), [`CLAUDE.md`](CLAUDE.md) (how to build)

> **One line:** Build the everyday golf formats on the web app, harden it into
> an installable PWA, and go native (Expo) once there's real usage — becoming
> *the fair, friendly golf-games app.*

---

## 1. Where we are, where we're going

- **Now:** the 20 Ball / 40 Ball MVP is live and in real use with friends. It
  already exercises the hardest part: a pure, tested stroke engine and a
  hidden-information live scorecard.
- **Goal:** a real product that strangers discover, sign up for, and play.
  Native mobile is the end state; the web app is the bridge.
- **Thesis:** computing fair handicap strokes is table-stakes — other golf apps
  do it too. The defensible position is the combination:

  > **Fair strokes + the math *shown* (not a black box) + live multi-device +
  > focused (not a bloated super-app) + formats nobody else has (hidden-info
  > 20 Ball).**

---

## 2. Strategic decisions

### 2.1 Build sequence: web first, then PWA, then native
Ship features on the existing Next.js app, and harden it into an installable
PWA (home-screen icon, full-screen, push notifications on iOS 16.4+) so it feels
like an app on the course today. Go native only after real usage.

**Why:** the value is the format engine, not the app shell. Native-first would
spend months rebuilding today's UI before shipping anything new. The API-first
architecture makes "native later" cheap: the pure engine and the API carry over,
and only the UI gets rebuilt. A shareable web link is also the best way to test
reach before investing in native.

### 2.2 Native tech: Expo / React Native
EAS Build compiles iOS in the cloud, so no Mac is needed. TestFlight covers
on-device testing and EAS Submit ships to the App Store. Expo also reuses the
existing React/TypeScript stack and talks to the same API.

### 2.3 Scope guardrail: a scorekeeper, not a payments app
The app scores games and shows results. It never handles payments or money.
That keeps the product simple, broadly appropriate, and out of the regulated
categories that payments would bring.

### 2.4 Positioning
"The fair, friendly golf-games app — many formats, scored net, with the math
shown." Keep hidden-info **20 Ball** as a signature format.

---

## 3. Lessons from existing golf apps

A review of the existing golf-games apps (2026-07) showed a fragmented field.
Fair net strokes are common; a live, multi-device, hidden-information game is not.

**Ideas worth borrowing**
1. **Shareable results card** — an auto-tallied recap to drop in the group chat.
2. **Guest players and share-a-link join, no install** — the most common
   complaint about other apps is "everyone must register first."
3. **Public, no-signup strokes calculator** — "just tell me the shots," then
   offer to run the game live.
4. **Show the math** — for a fairness product, transparency builds trust.

**Structural edges**
- **Live multi-device play and hidden information** — most apps are single-phone
  scorecards.
- **Focus** — one clean experience instead of a super-app.

---

## 4. Prioritized feature list

**Lens:** the game is multiplayer and shared by link, so sequence by the growth
loop: *be worth finding → be fun and fair → make people return and invite →
convert the newcomer.*

**Tier 1 — Core engine and reach**
- **Format-aware stroke engine** — generalize from "20/40 Ball off the low
  handicap" to per-format allocation. Everything depends on it.
- **Singles match play + 2v2 best ball** — the formats most golfers play.
- **Public no-signup strokes calculator** — the engine as a front door.

**Tier 2 — Fun and fair**
- **Side games v1: net birdies/eagles + net skins** — reuse per-player net scores.
- **Shareable results card.**
- **Handicap onboarding** — most casual golfers have no official handicap, so
  "enter your index" blocks the audience we want. Offer a ladder:
  **(1)** have an index → type it; **(2)** don't → enter your last 3–5 rounds
  for a WHS-methodology estimate; **(3)** no idea → "what do you usually shoot?"
  → provisional estimate; **(4)** auto-refine from every round played in-app.

**Tier 3 — Return and invite**
- **Profiles + friends / saved opponents** — auto-fills handicaps.
- **Rivals scoreboard** — win/loss record with the people you play most.
- **Head-to-head history**, **season standings**, **rematch button**.
- **PWA push** — "your turn," "opponent kept their card," "rematch?"

**Tier 4 — Convert the newcomer**
- **"How to play" onboarding** — the invited player's first 60 seconds.
- **Guest + share-link join, no install.**

**Throughout**
- PWA install shell; funnel instrumentation; keep the engine pure and the app
  API-first so the Expo client is a UI rebuild only.

**Deferred**
- **Side games v2: closest-to-pin / long drive** with handicap-fair scoring.
- **Full stats tracking** (fairways, GIR, putts). Lightweight round entry —
  score, course, tee — is in scope; shot-level stats are not.
- **Rebrand + native (Expo)** — triggered by usage, not a date.

---

## 5. Phased roadmap

### Phase 0 — Quick wins + prove the PWA path
- PWA install shell (manifest, icons, standalone, basic offline).
- Rematch button (clone a finished game's teams and settings).
- Minimal funnel instrumentation.
- Guest / share-link join.
- Stopgap handicap estimator ("what do you usually shoot?").
- **Exit:** installs to the iPhone home screen, opens full-screen, rematch works,
  and a guest can join by link without an account.

### Phase 1 — Format engine + the first two everyday formats
- Generalize `lib/engine.ts` to be format-aware, keeping it pure and unit-tested.
- Implement **singles match play** and **2v2 best ball (four-ball)**. Make
  hidden information a per-format property.
- Extend `scripts/engine.test.ts` with cases per format.
- UI: a "pick a format" step and format-appropriate results.
- **Public strokes calculator** as a thin wrapper over the engine.
- **Exit:** two friends play a singles match and a 2v2 best ball end to end,
  with correct strokes, live, in production.

### Phase 2 — Side games v1 + results card
- Net birdies/eagles and net skins (low net per hole, carryovers), attachable to
  any game.
- Shareable results card with a running tally and end-of-round summary.
- Engine tests for the side-game math.
- Fast-follow format: **Nassau** (front / back / total match).

### Phase 3 — Handicaps for everyone
- **Capture Course Rating + Slope and make tee selection real.** The course API
  already returns both per tee; what remains is a tee picker and storing the
  chosen tee on the game.
- **WHS-methodology index** in the pure engine:
  `differential = (113 / slope) × (adjusted gross − course rating)`; the index
  is the average of the lowest 8 of the last 20, with the short-record table so
  3 rounds is enough.
- **Round entry UI** — search course → pick tee → enter score.
- **Show the derivation**, and label it an "estimated index," never
  "Handicap Index®" (a USGA trademark).
- **Slope-adjusted match strokes.** Course handicap is
  `index × (slope / 113) + (course rating − par)`. Playing off the low man, the
  `(rating − par)` term cancels out of the stroke differences, so only slope
  matters — and it is the same multiplier `settings.handicapPercent` already
  applies. No new engine math is needed.
- **Exit:** a new user with no handicap enters 3 rounds, gets a defensible
  estimate, and can start a fair match.

### Phase 4 — Social graph + Rivals scoreboard
- Profiles with a stored handicap; saved friends auto-fill at game creation.
- Rivals scoreboard and head-to-head history.

### Phase 5 — Growth loop: push + onboarding
- PWA push, a 60-second "how to play," and a polished invite → join → first game.

---

## 6. The native gate

Native is a trigger, not a date, so it must be measured. Commit to the Expo
client and a rebrand when:

- organic signups come from shared links beyond the original group, **and**
- multiple groups run multiple games over multiple weeks, unprompted.

Starting threshold: about 5 weekly-active groups, or at least 30% of games
include someone the creator didn't personally invite.

---

## 7. Open decisions

- **Best-ball allowance convention** (Phase 1) — off the low man vs a percentage
  of the difference; full vs 90%.
- **Slope vs allowance in one field** (Phase 3) — `handicapPercent` serves as a
  manual competition allowance today, but slope adjustment wants the same
  multiplier. Split them into two fields, or derive one and let the other override?
- **Handicap naming** — what to call the computed number without implying USGA
  status.
- **Rebrand name** — at the native step.

## Not doing (for now)
- No payments or money handling (§2.3).
- No shot-by-shot GPS or strokes-gained tracking.
- Not native-first (§2.1).
