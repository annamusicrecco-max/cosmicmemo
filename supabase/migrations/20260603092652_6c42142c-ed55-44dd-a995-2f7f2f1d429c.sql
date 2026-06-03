ALTER TABLE public.waiting_players ADD COLUMN IF NOT EXISTS preferred_grid text NOT NULL DEFAULT '4x4';
ALTER TABLE public.game_rooms ADD COLUMN IF NOT EXISTS grid_size text NOT NULL DEFAULT '4x4';
CREATE INDEX IF NOT EXISTS idx_waiting_players_preferred_grid ON public.waiting_players(preferred_grid);