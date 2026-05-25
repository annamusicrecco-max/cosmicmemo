# Phase 1: Online Multiplayer Database Schema – Setup Instructions

## Overview

This phase establishes the Supabase backend for online random matchmaking in Cosmic Memory. It includes:

1. **Database schema** (`supabase/migrations/20260525000000_init_multiplayer.sql`)
   - Two main tables: `waiting_players` (matchmaking queue) and `game_rooms` (active games)
   - Row Level Security (RLS) policies for data isolation
   - Realtime publication for live game updates

2. **Matchmaking Edge Function** (`supabase/functions/matchmake/index.ts`)
   - HTTP endpoint that pairs waiting players
   - Creates a game room with shuffled board and assigned turn order
   - Handles queue management (FIFO)

---

## How It Works Together

### Player Flow:

1. **Player joins queue**: Frontend calls the `matchmake` Edge Function with their `player_id`
2. **Function checks queue**: 
   - Inserts the player into `waiting_players` table
   - Looks for another waiting player (FIFO, earliest first)
3. **No match yet**: Function returns `{ status: "waiting" }` and the player waits
4. **Match found**: Function:
   - Creates a new `game_room` row with both players, a shuffled 4×4 board, and a random starting player
   - Removes both players from the queue
   - Returns `{ status: "matched", game_room_id, player_number, current_turn }`
5. **Game syncs via Realtime**: Both players subscribe to the `game_rooms` table via Realtime and see updates instantly when either player makes a move

### Data Structure:

**waiting_players table:**
```
id (UUID)
player_id (UUID) - unique
joined_at (timestamp) - for FIFO ordering
```

**game_rooms table:**
```
id (UUID)
player_1_id, player_2_id (UUIDs)
status ('active', 'completed', 'abandoned')
current_turn (UUID - either player_1_id or player_2_id)
board (JSONB array of card objects)
player_1_score, player_2_score (ints)
player_1_moves, player_2_moves (ints) - track number of turn taken
winner_id (UUID or null)
created_at, updated_at (timestamps)
```

**Board structure:**
```json
[
  { "card": "🐱", "id": 0, "revealed": false, "matched": false },
  { "card": "🐶", "id": 1, "revealed": false, "matched": false },
  ...
]
```

---

## RLS Policies

| Table | Operation | Policy |
|-------|-----------|--------|
| `waiting_players` | INSERT | Players can insert their own record |
| `waiting_players` | SELECT | Anyone can view all waiting players |
| `waiting_players` | DELETE | Players can delete their own record |
| `game_rooms` | INSERT | Anyone can insert (via Edge Function) |
| `game_rooms` | SELECT | Players can only view their own games |
| `game_rooms` | UPDATE | Players can only update their own games |

---

## What the Developer Must Do Next

### 1. **Ensure Supabase is linked to your GitHub repo**
   - If not already done, run: `npx supabase link --project-ref <your-project-id>`
   - This enables auto-migrations on push

### 2. **Push migrations**
   - The migration file will auto-apply to your Supabase project when you push to GitHub
   - If testing locally with Supabase CLI:
     ```bash
     npx supabase migration up
     ```

### 3. **Deploy the Edge Function**
   ```bash
   npx supabase functions deploy matchmake
   ```
   - This publishes the function to your Supabase project
   - You can test it via the Supabase dashboard or locally:
     ```bash
     npx supabase functions serve matchmake
     ```

### 4. **Verify tables and policies**
   - Go to your Supabase dashboard
   - Check **SQL Editor** → Run the migration to verify tables exist
   - Check **Authentication** → Policies to confirm RLS policies are in place
   - Check **Realtime** → Verify `game_rooms` is published

### 5. **Next phase: Environment & Client Setup**
   - Once Phase 1 is confirmed, move to Phase 2 (environment configuration and Supabase client setup)

---

## Testing the Edge Function (Optional)

You can test the matchmake function locally or via curl:

```bash
# Start the function locally
npx supabase functions serve matchmake

# In another terminal, call it:
curl -X POST http://localhost:54321/functions/v1/matchmake \
  -H "Content-Type: application/json" \
  -d '{"player_id": "your-uuid-here"}'
```

Expected responses:
- **Waiting**: `{ "status": "waiting", "game_room_id": null, "message": "Waiting for another player..." }`
- **Matched**: `{ "status": "matched", "game_room_id": "uuid", "player_number": 1 or 2, "current_turn": "your_turn" or "opponent_turn" }`

---

## Notes

- The board is **shuffled** each time a game is created (Fisher-Yates algorithm)
- **Player 1** is randomly assigned at game creation time
- The **starting turn** is Player 1
- All game state is stored in the `game_rooms.board` JSONB and synchronized via Realtime
- The Edge Function uses **service role** credentials for admin operations (creating/deleting rows)
- **RLS policies** prevent players from seeing other players' games or queue status (except to view queue size)

---

## Files Created

```
supabase/
├── migrations/
│   └── 20260525000000_init_multiplayer.sql
└── functions/
    └── matchmake/
        └── index.ts
```

Next phase: Phase 2 (Environment configuration and `@supabase/supabase-js` setup)
