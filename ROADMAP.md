# Roadmap

**Date:** 2026-07-21 · **Status:** planning complete, ready to build
**Companion docs:** [`VISION.md`](VISION.md) (direction), [`CLAUDE.md`](CLAUDE.md) (how to build)

> **One line:** Build the everyday formats + fair side bets on the web app,
> harden it into an installable PWA, and go native (Expo) once there's real
> signal — becoming *the fair, friendly golf-games app that doesn't touch your
> wallet.*

---

## 1. Where we are, where we're going

- **Now:** 20/40 Ball MVP is live at [20ball.golf](https://20ball.golf), polished,
  and in real use with friends. It already exercises the hardest part — a pure,
  tested stroke engine + hidden-information live scorecard.
- **Ambition (decided):** a *real product with reach* — strangers discover it,
  sign up, and play. Native mobile is the end state; the web app is the bridge.
- **The refined thesis (post-competitive-research, §3):** "we compute fair
  handicap strokes" is **table-stakes**, not a moat — the serious competitors
  already do it. The defensible position is the *combination* nobody else
  offers:

  > **Fair strokes + *shown* (not a black box) + live multi-device + focused
  > (not a bloated super-app) + no money movement + formats nobody else has
  > (hidden-info 20 Ball).**

---

## 2. Strategic decisions (locked this session)

### 2.1 Build sequence: web-first → PWA → native later
Ship features on the existing Next.js app; **harden it into an installable PWA**
(home-screen icon, standalone full-screen, push — all supported on iOS 16.4+) so
it *feels* like an app on the course today. Go native only after real signal.

**Why:** the differentiation is the format engine + fair side bets, **not** the
app shell. Native-first would burn months re-implementing today's UI just to
reach parity, before shipping anything new. The API-first architecture makes
"native later" nearly free — the durable asset (pure engine + API) is done and
framework-agnostic; the UI is the cheap, replaceable layer. A shareable web link
is also the single best instrument for *validating reach* before betting on
native.

### 2.2 Native tech (when the time comes): Expo / React Native
Constraint: **no Mac** (Xcode is Mac-only), testing on iPhone. This rules native
tech decisively **in** for Expo: **EAS Build compiles iOS in the cloud** (no Mac
needed), testing on a physical iPhone via TestFlight, and **EAS Submit** ships to
the App Store — all from Windows. Bonus: reuses the existing React/TypeScript
stack and talks to the same API. Requires an Apple Developer account ($99/yr) at
submit time.

### 2.3 Money: track it, never move it (hard guardrail)
The app computes real-money results ("you owe Dave $15") and shows a clean
settle-up card, but **never holds or transfers funds** — players settle
themselves via Venmo/cash off-app.

**Why this is a guardrail, not a preference:** the moment the app holds/pays
money it becomes a *regulated gambling operator* — state-by-state gaming +
money-transmitter licensing, KYC/age/geo verification, specialized payment
processors (Stripe/PayPal ban betting), App Store 17+ "real-money gaming". That's
a different, lawyer-and-capital-heavy business, and it discards the no-money
wedge. **No buy-in/cash-out. No virtual gambling tokens. No money custody.**

### 2.4 Positioning
"The fair, friendly games app — depth of the betting apps, scored net and
*shown*, with none of the wallet." Keep hidden-info **20 Ball** as a signature
format (unique in the entire field); don't bury it at rebrand.

---

## 3. Competitive landscape

Researched 2026-07-21 (primary sources: product sites + App/Play listings).

**Verdict:** more crowded than the headline names suggest, but *fragmented*, and
nobody owns our position. Fair-net-strokes is table-stakes. The market splits
into two camps — **betting/settlement-first** (Venmo ledgers, "take money off
your buddies") and **scoring/social** (track results, no money) — and the closest
twin is unlaunched, the incumbent is bloated, and the novel entrant is unproven
and gambling-flagged.

| App | Platform | Price | Formats / side-games | Fair strokes? | Money? | Traction |
|---|---|---|---|---|---|---|
| **Matchplay** | iOS *(soon)* | Free (Pro hinted) | Stroke, match, skins, CTP | Manual, no method | Venmo labels | **Unlaunched** (waitlist) |
| **Golf GameBook** | iOS/Android | Free+ads; $40/yr | ~20 formats; **no Nassau** | Yes (WHS, headline) | No | iOS 4.7★/2.1K; ~500K installs |
| **mScorecard** | iOS/Android/web | Free+ads; ~$23/yr | Skins, Nassau, CTP, LD, net dots — *concurrent + netted* | Yes | Tracks $ | 4.7★/9.3K; 500K+ |
| **Golf Bettor** | iOS | Free; $10/yr | 12 formats (Nassau, Wolf, Vegas…) | Yes (dots, 85K tees) | Bet-oriented | **4.5★/237** (best-proven) |
| **Beezer Golf** | iOS+Watch | Free + Prem | 25+ games; "Beezer Bank" ledger | Yes | Ledger | Established |
| **The Skins App** | iOS/Android | ~$40/yr | Skins, Banker, Nassau, Vegas, Wolf | Yes (auto net) | Venmo/etc. | 3.7★/29; buzzy |
| **Unknown Golf** | iOS/Android/web | Free + tier | Skins, Nassau, Vegas (gross/net) | Yes | Venmo | USGA partner |
| **LevelGolf** | iOS only | Free | Match, Nassau — *Odds or Strokes* | De-emphasized | Shows payout | **0 ratings; 18+ gambling** |
| *First-T* | iOS/Android/web | — | *Calculator only* — wide format list | Yes (UK/IE) | n/a | Niche |
| *Matchplay Stroke Calc* | iOS/Android | Free | *Calculator* — singles + four-ball | Yes (allowances) | n/a | Negligible |

### Borrow (prioritized)
1. **Shareable settlement/results card** — Matchplay & mScorecard both center on
   an auto-tallied "who-owes-who" recap dropped in the group chat. Loop-closer +
   viral hook. In real $, tracked, self-settled.
2. **Guest players + share-a-link join, no install** — the #1 complaint across
   mScorecard/GameBook is "everyone must register first." Web-first, one-scorer-
   runs-the-group is the structural answer. A *headline*, not a detail.
3. **Public, no-signup "fair strokes" calculator** — First-T / Matchplay Stroke
   Calc prove the "just tell me the shots" wedge but *stop at the number*. Nobody
   pairs a free calculator with a live game → SEO/top-of-funnel front door that
   upsells into the scorecard.
4. **Odds mode + CTP/long-drive stake-suggester** — LevelGolf's "win the hole →
   bank your odds; tie = 0" is novel, but only applied to full-hole match/Nassau.
   **Odds for closest-to-pin / long drive is unclaimed territory** we can own.
5. **Show the math** — competitors either hide it ("no math degree needed") or
   black-box it ("proprietary odds"). For a fairness product, transparency is
   trust others don't offer.

### Beat (structural edges)
- **Live multi-device + hidden information** — most rivals are single-phone paper
  scorecards. 20 Ball is unique in the field.
- **No-money framing = broader reach + App Store safety** — stay out of the
  gambling classification the betting apps flirt with (LevelGolf = 18+).
- **Focus** — beat GameBook's bloat and the betting apps' friction with one
  clean, generous, no-forced-social experience.

### Watchlist
**Golf Bettor, Beezer, The Skins App** — the proven players. If any ships a clean
no-money scorecard mode, they encroach.

---

## 4. Prioritized feature list

**Lens:** the game is multiplayer and shared by link, so sequence by the growth
loop — *be worth finding → be fun & fair → make people return and invite →
convert the newcomer.* Formats expand *who can play at all*; everything compounds
on top.

**Tier 1 — Moat & reach unlock (build first)**
- **Format-aware stroke engine** — generalize from "20/40 Ball off the low
  handicap" to per-format allocation. The platform thesis; everything depends on it.
- **Singles match play + 2v2 best ball** — the formats most golfers actually
  play. Biggest audience multiplier on the board.
- **Public no-signup strokes calculator** — expose the engine as an SEO front door.

**Tier 2 — Fun & fair (wanted, rides the engine)**
- **Side bets v1: net "dots" (birdies/eagles) + net skins** — reuse per-player
  net scores; low rework risk.
- **Shareable settlement/results card** — real-$ "who-owes-who," tracked & self-settled.
- **Real-money stakes tracking** — compute results, show settle-up; **never move money.**
- **Handicap onboarding (the ladder)** — *activation-critical:* most casual
  golfers have no official handicap (GHIN needs club affiliation + ~$40–60/yr),
  so "enter your index" blocks the very audience we want. Meet them where they
  are: **(1)** have an index → type it; **(2)** don't → enter your last **3–5
  rounds** (course → tee → score) for a real WHS-methodology index; **(3)** no
  idea → *"what do you usually shoot?"* → provisional estimate so they can play
  now; **(4)** auto-refine from every round played in-app; **(5)** "add a past
  round" anytime.

**Tier 3 — Return & invite (retention loop)**
- **Profiles + friends / saved opponents** — social graph; auto-fills handicaps.
- **Rivals scoreboard** — persistent standings across the people you play most:
  record *and* running real-money tally with each friend, settled as you go. The
  reason to reopen the app on a Tuesday.
- **Head-to-head history**; **season standings**; **rematch button** (cheap loop-closer).
- **PWA push** — "your turn," "opponent kept their card," "rematch?"

**Tier 4 — Convert the newcomer**
- **"How to play" onboarding** — the invited stranger's first 60 seconds.
- **Guest + share-link join, no install** — every game a clean acquisition event.

**Spine (woven through, not features)**
- **PWA install shell** — cheap; prove the iOS PWA path early.
- **Funnel instrumentation** — signups, games created/completed, invite→join,
  weekly-active groups. Without it the native gate (§6) is blind.
- **Keep the engine pure + API-first** so the Expo client is a UI rebuild only.

**Deferred (real, but later / post-signal)**
- **Side bets v2: CTP / long-drive stake-suggester odds model** (research-y).
- **Full stats tracking** — fairways/GIR/putts/shot-level. Still 18Birdies' lane.
  *(Note: lightweight round entry — score + course + tee, enough to compute an
  index — is NOT deferred; it moved into Phase 3. The scope boundary is stats,
  not scores.)*
- **Rebrand + native (Expo)** — triggered by signal, not a date.

---

## 5. Phased roadmap

Paced to ~10–20 focused hrs/week.

### Phase 0 — Quick wins + prove the PWA path · *~1 week*
Warm up, ship visible wins, surface iOS PWA quirks now rather than late.
- PWA install shell (manifest, icons, installable, standalone, basic offline).
- Rematch button (clone a finished game's teams + settings).
- Funnel instrumentation (minimal — you have a PostHog project).
- Harden guest / share-link join (this is a headline wedge — start early).
- **Stopgap handicap estimator** — *"what do you usually shoot?"* → provisional
  index, so a handicap-less newcomer is never blocked. (Trivial; the real
  engine lands in Phase 3.)
- **Exit:** install 20ball.golf to the iPhone home screen, opens full-screen,
  "Rematch" works, a guest can join by link without an account. Verified on iPhone.

### Phase 1 — Format engine + first two everyday formats · *~3–5 weeks* — the big one
Go from "20 Ball app" to "fair match for any golfers."
- Generalize `lib/engine.ts` to be **format-aware** (per-format allocation),
  keeping it pure, dependency-free, unit-tested.
- Implement **singles match play** and **2v2 best ball (four-ball)**. Make
  hidden-info a per-format property (20 Ball hides; match/best-ball are open).
- Extend `scripts/engine.test.ts` with cases per format — TDD the crown jewel.
- UI: a "pick a format" step + format-appropriate scorecard/results.
- **Public strokes calculator** as a thin no-signup wrapper over the engine.
- *Decision to make when specced:* best-ball allowance convention (off low man vs
  100% of difference; full vs 90%).
- **Exit:** two friends play a singles match **and** a 2v2 best ball end-to-end,
  correct strokes, live, on prod. Engine tests green.

### Phase 2 — Side bets v1 + settlement · *~2–3 weeks*
The delight layer, riding the generalized engine.
- Net "dots" (birdies/eagles) and net skins (low net per hole, carryovers),
  attachable to any game/format.
- **Shareable results/settlement card:** running tally + end-of-round "who owes
  who" in real $, **tracked and self-settled — no money movement.**
- Engine tests for dot/skin math.
- *Fast-follow format:* **Nassau** (front/back/total match) — natural pairing.
- **Exit:** add dots + skins to any game, watch them tally live, get a clean
  shareable settle-up card.

### Phase 3 — Handicaps for everyone · *~2–3 weeks*
Close the cold-start gap: most casual golfers have no official handicap, so
"enter your index" blocks the exact audience we're chasing. This makes the
fairness promise real for a stranger, not just for friends who already know
their number.
- **Capture Course Rating + Slope, and make tee selection real.** Verified
  2026-08: golfcourseapi returns both per tee, and `app/api/courses/[id]`
  already serves every usable tee as `{teeName, courseRating, slopeRating,
  holes}` — the New Game screen just auto-picks `tees[0]` and drops the
  ratings. What's left here is a tee picker in the UI and storing the chosen
  tee's numbers on the game.
- **WHS-methodology index** in the pure engine:
  `differential = (113/slope) × (adjusted gross − course rating)`, index =
  average of the lowest 8 of the last 20, with the **short-record lookup table**
  so **3 rounds is enough** to establish a number.
- **Round entry UI** — search course → pick tee → enter score. Used both to
  backfill at onboarding and to **"add a past round" anytime**.
- **Auto-refine** — rounds played in-app feed the index automatically;
  provisional estimates converge to computed ones.
- **Show the derivation** — how the number was reached, and whether it's
  provisional or computed. Label it an **"estimated index," never "Handicap
  Index®"** (that's the USGA's, and requires an authorized association).
- **Slope-adjust the strokes given in a match** (course handicap, not just the
  index). Course handicap is `index × (slope/113) + (course rating − par)`.
  Playing off the low man, the `(rating − par)` term is identical for everyone
  and cancels out of the stroke *differences* — so **only slope matters**, and
  it is arithmetically the same factor `settings.handicapPercent` already
  applies (slope 105 ≈ 93%, slope 125 ≈ 111%). **No new engine math**: capture
  slope, derive the percentage from it, done. Keep the manual percentage as a
  separate competition-allowance override — allowance and slope are two
  different golf concepts sharing one field today, and should be split.
  - *Why it matters:* on an easy course a 22 genuinely should not receive 16
    more shots than a 6. Real complaint from a real round (2026-08-04).
  - *Magnitude, measured:* replaying that round across slopes 100–140 moved the
    margin only between 4 and 6 shots and never changed the winner. Worth
    building for correctness, not because it decides matches.
- *Scope boundary:* score + course + tee only. **No** fairways/GIR/putts.
- **Exit:** a brand-new user with no handicap enters 3 rounds and walks away with
  a defensible index — and can then start a fair match.

### Phase 4 — Social graph + Rivals scoreboard · *~3–4 weeks*
Make people return and invite.
- Profiles with stored handicap; friends / saved opponents → auto-fill at creation.
- **Rivals scoreboard** — persistent standings across your regulars: W/L record +
  running real-money tally per friend, settle-as-you-go.
- Head-to-head history; season standings.
- **Exit:** pick a saved friend to start a game; see the Rivals scoreboard update.

### Phase 5 — Growth loop: push + onboarding · *~2–3 weeks*
Convert newcomers, re-engage the lapsed.
- PWA push ("your turn," etc.).
- "How to play" onboarding — a 60-second first run for invited strangers.
- Polish invite → join → first game.
- **Exit:** an invitee goes link → understands → playing smoothly, gets a push
  when it's their turn.

### Phase 6 — Side bets v2: the odds model · *~3–4 weeks, gated, specced separately*
The speculative differentiator.
- Closest-to-pin / long-drive **stake-suggester** (odds from handicap/skill) —
  unclaimed territory LevelGolf left open.
- Optionally an "odds mode" alternative to strokes for match play.
- *Framing guardrail:* keep it "fair stakes," never casino-style — avoid the
  simulated-gambling App Store flag.
- Gate behind "core side bets are used and loved."

**Total through Phase 5 on web: ~13–19 focused weeks → realistically ~4–6 months.**

---

## 6. The native gate (define "signal")

Native isn't a date — it's a trigger, and it must be *measured* (hence funnel
instrumentation in Phase 0). Commit to the Expo client + rebrand when, roughly:

- **Organic signups from shared links beyond your circle**, AND
- **Multiple groups running multiple games over multiple weeks, unprompted.**

Concrete starting threshold to refine: **~5 weekly-active groups**, or **≥30% of
games include someone you didn't personally invite.**

---

## 7. Open decisions (to spec when reached)

- **Best-ball allowance convention** (Phase 1) — off low man vs % of difference; full vs 90%.
- **Course Rating / Slope availability** (Phase 3) — confirm golfcourseapi returns
  `course_rating` + `slope_rating` per tee. If not, source them elsewhere or fall
  back to a par-based estimate (less rigorous — decide the tradeoff then).
  Blocks both the index calc *and* slope-adjusted strokes; without slope we are
  permanently assuming 113 (a neutral course) for every round.
- **Slope vs allowance in one field** (Phase 3) — `handicapPercent` currently
  serves as a manual competition allowance, but slope adjustment wants the same
  multiplier. Split into two fields, or derive one and let the other override?
- **Handicap naming** (Phase 3) — what to call the computed number ("estimated
  index"? app-branded, à la "GGB Handicap"?) without implying USGA officialdom.
- **Odds-model design** (Phase 6) — the outcome-probability-by-handicap math for CTP/long-drive.
- **Rebrand name** (at native) — leaning golf-games-flavored; avoid "Handicapper"
  (reads as a crowded handicap-tracker category).
- **Monetization** (post-signal) — free vs freemium; deliberately unresolved until reach is proven.

---

## What we're explicitly NOT doing (for now)
- Not moving money / no gambling tokens / no buy-in-cash-out (§2.3).
- Not shot-by-shot GPS or strokes-gained tracking (that's 18Birdies' lane).
- Not native-first (§2.1); not a rebrand before native.
- Not building round-tracking→handicaps until the social graph exists.
- Not chasing GameBook's super-app scope (GPS, feed, store, B2B tournaments).
