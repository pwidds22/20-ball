# Vision

**One line:** The easiest way for golfers to play games against each other — put
in your handicaps, pick an opponent and a format, and we handle the strokes and
the scorecard.

## The problem

Casual golfers constantly want to play games against each other — a singles
match, 2v2 best ball, skins, a Nassau, 20 Ball — but two things get in the way:

1. **Nobody knows the right strokes.** How many shots should a 14 give a 22 in a
   singles match? In 2v2 best ball? Off the low man, or off each other? The
   answer changes with every format, so people guess, argue, or just play it
   straight and call it "close enough."
2. **Keeping the game is a hassle.** Who's up, who kept what, who won — it lives
   on a paper card or in someone's head.

## The vision

A platform where you keep your handicap, track your scores over time, and — the
core magic — **play games against friends with the strokes figured out for you.**
Pick a friend (or teams), pick a format, and the app tells everyone exactly how
many strokes they get and runs the scorecard. Your rounds feed your handicap,
which feeds fairer games — a virtuous loop.

## Where it fits

Think of **18Birdies / TheGrint** as the round-tracking, handicap, GPS, and stats
layer. This app is the **games-between-people layer**: less about logging every
shot, more about making it dead simple to set up a fair match and score it. We
track scores and handicaps — not shot-by-shot GPS or strokes-gained analytics.

## Platform direction: mobile-first, eventually mobile-only

The end product is a **native mobile app** (iOS + Android). That's where golfers
live — on the course, phone in pocket. The current Next.js **web app is a
temporary bridge**: something to share with friends and prove the game out now,
before the real app exists. We don't expect long-term web usage.

This shapes how we build: the app is **API-first**. All rules, scoring, and the
stroke engine run server-side behind clean API routes; the browser is a thin
client. So the web app isn't throwaway — when we build native, it talks to the
**same backend**, and the pure rules engine (`lib/engine.ts`, no dependencies)
can be reused or ported directly. The hard, high-value part (the stroke +
scoring logic) carries over intact; only the UI gets rebuilt natively.

## Core capabilities (long-term)

- **Profiles + handicaps** — each player has a handicap that updates from their
  tracked rounds (or is entered manually).
- **Friends** — add the people you actually play with.
- **Game library** — a catalog of formats, each with correct, format-specific
  stroke allocation:
  - Singles: match play, stroke play
  - 2v2: best ball (four-ball), match, scramble, alternate shot
  - Group games: skins, Nassau, wolf, 20 Ball, 40 Ball
- **The stroke engine** — the heart of it. Given handicaps + format + course,
  compute exactly how many strokes each player/side gets and on which holes.
  Necessary but not sufficient: rivals compute strokes too, so *fair strokes
  alone is table-stakes.* Our moat is the **combination** — fair strokes,
  *shown* (not a black box), on a live, focused scorecard, with formats
  nobody else has (hidden-info 20 Ball). See [ROADMAP.md](ROADMAP.md).
- **Live scorecard + results** — run the game hole by hole, see who's winning,
  record the outcome.
- **Fair side games** — net birdies/eagles, skins, closest-to-pin, long drive.
  Counting gross birdies is lopsided when a 20 plays a 5, so the app scores
  these *net*, reusing the stroke engine.
- **History / head-to-head** — your record against each friend, across formats.

## Prior art / features worth borrowing

Apps already in this space — study them, take what's good:

- **Live group scorecards** — a match/skins view that updates hole by hole.
- **Broad format catalogs** — apps that do all the match math for many formats.
- **Stroke calculators** — the narrow "just tell me the strokes" tool.

The space is fragmented, so polish and the right feature mix can stand out.

## What it is not (for now)

- Not a shot-by-shot GPS or strokes-gained tracker.
- Not a payments product. It organizes friendly games and keeps score; it never
  handles money.

## Current state

The MVP ships one family of formats — **20 Ball (2v2)** and **40 Ball (4v4)** —
end to end: accounts, handicaps, per-format stroke allocation, hidden-information
scoring, live sync, and final results. It runs as a **web app** for now (the
bridge described above), but already exercises the hardest part — the stroke
engine + live scorecard — so it's a strong base to generalize on and to point a
native client at later.

## Roadmap

The detailed, current plan lives in **[ROADMAP.md](ROADMAP.md)** — prioritized
features, the phased sequence, and the strategic calls (web first, then PWA,
then native via Expo once there's real usage). The short version:

1. **Now:** 20 / 40 Ball as a web app, in real use with friends.
2. **Format-aware stroke engine** + the everyday formats (singles match, 2v2 best
   ball) — the reach unlock.
3. **Fair side games** (net birdies + skins) + a shareable results card.
4. **Profiles, friends, and a Rivals scoreboard** — head-to-head records.
5. **Growth loop** — PWA push, onboarding, frictionless guest join.
6. **Native app** (Expo/React Native) against the existing API once usage grows;
   rebrand off "20 Ball" then.

Keeping the codebase **API-first** from here on is what makes the native step
cheap: don't bury game logic in the browser; it belongs in the shared backend.
