
CREATE TABLE public.waiting_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL UNIQUE,
  player_name TEXT NOT NULL DEFAULT 'Player',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_waiting_players_joined_at ON public.waiting_players(joined_at);

CREATE TABLE public.game_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_1_id TEXT NOT NULL,
  player_2_id TEXT NOT NULL,
  player_1_name TEXT NOT NULL DEFAULT 'Player 1',
  player_2_name TEXT NOT NULL DEFAULT 'Player 2',
  status TEXT NOT NULL DEFAULT 'active',
  current_turn TEXT NOT NULL,
  board JSONB NOT NULL,
  revealed JSONB NOT NULL DEFAULT '[]'::jsonb,
  player_1_score INT NOT NULL DEFAULT 0,
  player_2_score INT NOT NULL DEFAULT 0,
  winner_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_game_rooms_players ON public.game_rooms(player_1_id, player_2_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.waiting_players TO anon, authenticated;
GRANT ALL ON public.waiting_players TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_rooms TO anon, authenticated;
GRANT ALL ON public.game_rooms TO service_role;

ALTER TABLE public.waiting_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;

-- Permissive policies: players identified by client-side device ID; no sensitive data
CREATE POLICY "wp_all_select" ON public.waiting_players FOR SELECT USING (true);
CREATE POLICY "wp_all_insert" ON public.waiting_players FOR INSERT WITH CHECK (true);
CREATE POLICY "wp_all_update" ON public.waiting_players FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "wp_all_delete" ON public.waiting_players FOR DELETE USING (true);

CREATE POLICY "gr_all_select" ON public.game_rooms FOR SELECT USING (true);
CREATE POLICY "gr_all_insert" ON public.game_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "gr_all_update" ON public.game_rooms FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "gr_all_delete" ON public.game_rooms FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms;
ALTER TABLE public.game_rooms REPLICA IDENTITY FULL;
