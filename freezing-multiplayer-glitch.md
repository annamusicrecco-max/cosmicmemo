# Freezing Multiplayer Glitch — Investigation Log

> Living document. Append a new dated entry every time you investigate, attempt
> a fix, or learn something new. Do not delete old entries — they are evidence.

## TL;DR for new contributors

Online multiplayer (the **Random Match** and **Invite a Friend** flows under
`/online-match`) suffers from two user-visible symptoms:

1. **Slow matchmaking** — finding a random opponent takes much longer than it
   should. Beta testers report waiting many seconds even when another player
   is clearly in the queue.
2. **Laggy + "burst" card flips** — after tapping a card, the flip animation
   takes **3–5 seconds** to appear. Once the UI "unfreezes", **multiple
   cards flip open at once**, as if every tap during the freeze was
   queued and replayed.

The leading hypothesis is that impatient users tap repeatedly during the
freeze, and each tap fires an independent Supabase write that all land at
once when the round-trip finally completes. But we have **not confirmed**
the root cause yet — see "Suspects" below.

---

## Where the code lives

- Route: `src/routes/online-match.tsx`
- Matchmaking server fns: `src/lib/matchmake.functions.ts`
  (`joinMatchmaking`, `leaveMatchmaking`, `createInviteRoom`, `joinInviteRoom`)
- Realtime subscription: `supabase.channel("room:<id>")` listening to
  `postgres_changes` UPDATE on `public.game_rooms`
- Shared helpers / deck builder: `src/lib/online.ts`
- DB tables: `public.waiting_players`, `public.game_rooms`
  (see `supabase/migrations/2026060*`)

---

## Reproduction

1. Open two browsers (or one + an incognito window) on `/online-match`.
2. Pick any grid size and click **Find Random Match** on both.
3. Observe time-to-match. Expected: ~1s. Actual: often 5–15s+.
4. Once in a match, tap a card. Expected: instant flip + ~1s reveal.
   Actual: 3–5s of nothing, then several cards flip at once if you tapped
   more than once.
5. The freeze is more pronounced on mobile / poor network.

---

## Suspects (ranked by current suspicion)

### S1. Polling-based matchmaking instead of realtime  *(high)*
`online-match.tsx` calls `tryJoin` every **2000ms** via `setInterval`. Each
poll is a round-trip to the server function, which writes to
`waiting_players` and scans for an opponent. Two players polling
out-of-phase can take up to 2s just to *see* each other, plus DB write
contention. This alone explains slow matchmaking but **not** the in-match
freeze.

**Possible fix:** subscribe to `waiting_players` via realtime and let the
server fn run once on join + once per realtime event, instead of every 2s.

### S2. Every card tap is an independent Supabase round-trip  *(high)*
In `flip()` we always `await supabase.from("game_rooms").update(...)`. There
is **no client-side optimistic state**, **no disabled-while-pending lock**,
and **no debouncing**. The button's `disabled` only checks
`!isMyTurn || c.matched || revealed`, all derived from the *server* `room`
state — which hasn't updated yet because the write is in-flight.

Sequence we suspect during a freeze:
1. User taps card A → optimistic UI shows nothing → `update()` in flight.
2. User taps card B 200ms later → button is still "enabled" (server state
   hasn't changed) → second `update()` fires.
3. Same for cards C, D…
4. Network unblocks. All UPDATEs land. Realtime fires several
   `postgres_changes` events back-to-back. Multiple cards flip "at once".

### S3. `setTimeout(..., 900)` resolution race  *(medium)*
After the second card is revealed we wait 900ms, then write either the
matched board or swap the turn. If the *second tap* happens during another
player's pending 900ms window (or our own retried one), the state we read
from `room` is stale and we overwrite fresher data.

### S4. Supabase Realtime backpressure  *(medium)*
We subscribe to `postgres_changes` for `game_rooms`. If the row is updated
many times per second (because of S2), the client may batch / delay events,
producing the visible "burst". Worth checking the Realtime channel state
and event timestamps in the browser console.

### S5. Missing indexes on `waiting_players`  *(low–medium)*
The matchmaking query filters by `preferred_grid` and orders by
`created_at`. Without an index the scan worsens as the table grows
(abandoned rows accumulate). Check `EXPLAIN` on the prod DB.

### S6. Wake-from-pause cold start  *(low)*
The Cloud project was paused for inactivity recently. First requests after
a long idle can be slow. Not the full story but may amplify S1.

---

## What we've tried

_(none yet — this doc was created when the bug was first triaged. Add an
entry below each time you try something, even if it doesn't help.)_

### Template entry — copy this when adding a new attempt

```
### YYYY-MM-DD — <your name / handle>

**Hypothesis:** which suspect (S1–S6) or new theory.
**Change:** files touched, 1–2 sentence summary.
**Result:** measurable outcome. Time-to-match before/after. Repro steps
that still freeze. Console / network observations. Realtime event log.
**Next:** what to try if this didn't fix it; what to keep if it helped.
```

---

## Useful diagnostics

- **Server-fn logs:** use `stack_modern--server-function-logs` for
  `joinMatchmaking` to see queue scan timing.
- **DB query timing:**
  ```sql
  select id, created_at, preferred_grid
  from public.waiting_players
  order by created_at desc limit 50;
  ```
- **Realtime sanity:** in the browser console after entering a match,
  ```js
  supabase.getChannels().forEach(c => console.log(c.topic, c.state));
  ```
- **Tap burst evidence:** temporarily `console.log("flip", idx, performance.now())`
  at the top of `flip()` and `console.log("room update", payload.new)`
  in the channel handler. The time gap between the tap and the update is
  the freeze you're chasing.

---

## Guard-rails — don't regress these while fixing

- The invite flow (`?invite=<roomId>`) must still notify the host the moment
  the guest joins (toast + auto-transition to `playing`).
- Grid size choice must still be honored (random pick when both players
  prefer different sizes).
- `leaveMatchmaking` must run on unmount and on Cancel, otherwise stale
  `waiting_players` rows poison future queues.
- RLS / GRANTs on `game_rooms` and `waiting_players` must remain valid for
  the anon/authenticated roles the client uses today.

---

## Status

**Open.** Root cause unconfirmed. Symptoms reliably reproducible on mobile
Safari and desktop Chrome with throttled network.

### 2026-06-06 — Lovable agent

**Hypothesis:** S2 (every tap = independent round-trip with no UI lock) and S1
(2s polling matchmaking) account for both reported symptoms.

**Change:**
- `src/routes/online-match.tsx`
  - Added optimistic `localRevealed` + `flipPending` lock; the card button is
    now disabled the instant a tap fires, so a burst of taps during a freeze
    can no longer queue multiple writes.
  - `displayRevealed = server ∪ local` shows the flip immediately, with the
    server `revealed[]` reconciling once it arrives.
  - Matchmaking now subscribes to `postgres_changes` INSERTs on `game_rooms`
    (`queue:<playerId>` channel) and calls `tryJoin` the moment a room
    appears containing this player_id. The 2s `setInterval` was widened to
    2.5s as a fallback only.
- `src/lib/mp-log.ts` — new structured logger (ring buffer in localStorage +
  console mirror) with helpers `mpLog.info/warn/error/perf/time` and a
  `summarizeMpLog()` producing flip p50/p95/max, match-wait, realtime gap
  p95, and error/warning counts.
- `src/components/MpDiagnostics.tsx` — new expandable Settings section that
  renders the stats grid and last ~80 events; warns in red when flip p95
  > 1.5s, flip max > 3s, or realtime p95 > 2s. Includes Copy logs / Clear.
- `src/components/SettingsPanel.tsx` — mounts `<MpDiagnostics />` under a new
  "Multiplayer" section.

**Result:** Pending real-world beta numbers. Locally the burst-flip path is
no longer reachable (button disables synchronously). Need testers to open
Settings → Multiplayer Diagnostics after a few games and report:
- Flip p50 / p95 / max
- Realtime p95
- Any red "errors" or "warnings" entries
- The most recent ~20 log lines (Copy logs button)

**Next if still slow:**
- If realtime p95 stays high → suspect S4; investigate channel state and
  consider broadcasting (Realtime broadcast channel) instead of relying on
  `postgres_changes` for every flip.
- If `match` perf entry stays > 3s with realtime listener active → suspect
  S5; add an index on `waiting_players(joined_at)` and prune abandoned rows
  via a TTL job.
- If errors include `CHANNEL_ERROR` / `TIMED_OUT` → suspect Realtime
  back-pressure or Cloud project sleep; consider compute upgrade.
