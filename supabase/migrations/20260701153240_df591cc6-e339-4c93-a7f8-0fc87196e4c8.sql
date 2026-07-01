
ALTER TABLE public.game_rooms
  ADD COLUMN IF NOT EXISTS player_3_id text,
  ADD COLUMN IF NOT EXISTS player_3_name text,
  ADD COLUMN IF NOT EXISTS player_3_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invite_code text,
  ADD COLUMN IF NOT EXISTS invite_third_requester text,
  ADD COLUMN IF NOT EXISTS invite_third_status text;

CREATE UNIQUE INDEX IF NOT EXISTS game_rooms_invite_code_active_idx
  ON public.game_rooms (invite_code)
  WHERE invite_code IS NOT NULL;
