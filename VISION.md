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
shot, more about making it dead simple to set up a fair match and settle it. We
track scores and handicaps — not shot-by-shot GPS or strokes-gained analytics.

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
  This is the expertise most golfers don't have and the reason to open the app.
- **Live scorecard + results** — run the game hole by hole, see who's winning,
  record the outcome.
- **History / head-to-head** — your record against each friend, across formats.

## What it is not (for now)

- Not a shot-by-shot GPS or strokes-gained tracker.
- Not a gambling / money-handling product. It organizes friendly games and keeps
  score; any stakes stay between the players. (Money movement carries real App
  Store and legal constraints and is out of scope.)

## Current state

The MVP ships one family of formats — **20 Ball (2v2)** and **40 Ball (4v4)** —
end to end: accounts, handicaps, per-format stroke allocation, hidden-information
scoring, live sync, and final results. That already exercises the hardest part
(the stroke engine + live scorecard), so it's a strong base to generalize on.

## Rough roadmap

1. **Now:** 20 / 40 Ball, solid and in real use.
2. **Generalize the stroke engine** so it's format-aware — it already computes
   per-hole strokes off the low handicap; extend it to match / best-ball / skins
   allocation rules.
3. **Add the first "everyday" formats** — singles match and 2v2 best ball, the
   ones people ask about most.
4. **Profiles, friends, and history** — pick a saved opponent, auto-fill
   handicaps, record head-to-head.
5. **Round tracking** that feeds handicaps.
6. **Rename / rebrand** from "20 Ball" to the platform name.
