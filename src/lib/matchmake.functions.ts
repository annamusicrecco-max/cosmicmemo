import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildBoard } from "./online";

const GRID_LABELS = ["2x2", "2x3", "3x4", "4x4", "4x5", "5x6", "6x6"] as const;

const JoinSchema = z.object({
  player_id: z.string().min(4).max(64),
  player_name: z.string().min(1).max(20),
  preferred_grid: z.enum(GRID_LABELS).default("4x4"),
});

function totalForLabel(label: string): number {
  const [r, c] = label.split("x").map((n) => parseInt(n, 10));
  return (r || 4) * (c || 4);
}

export const joinMatchmaking = createServerFn({ method: "POST" })
  .inputValidator((input) => JoinSchema.parse(input))
  .handler(async ({ data }) => {
    const { player_id, player_name, preferred_grid } = data;

    // 1. If this player is already in an active game, return that room
    const { data: existingRoom } = await supabaseAdmin
      .from("game_rooms")
      .select("id")
      .eq("status", "active")
      .or(`player_1_id.eq.${player_id},player_2_id.eq.${player_id}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingRoom) {
      return { status: "matched" as const, game_room_id: existingRoom.id };
    }

    // 2. Look for another waiting player (not this one)
    const { data: others } = await supabaseAdmin
      .from("waiting_players")
      .select("player_id, player_name, preferred_grid")
      .neq("player_id", player_id)
      .order("joined_at", { ascending: true })
      .limit(1);

    if (others && others.length > 0) {
      const opponent = others[0] as { player_id: string; player_name: string; preferred_grid: string };
      const oppGrid = opponent.preferred_grid || "4x4";
      // Choose grid: same → that; different → random pick of the two
      const grid_size =
        oppGrid === preferred_grid
          ? preferred_grid
          : Math.random() < 0.5
            ? preferred_grid
            : oppGrid;

      // Coin flip for who goes first
      const p1First = Math.random() < 0.5;
      const player_1_id = p1First ? player_id : opponent.player_id;
      const player_2_id = p1First ? opponent.player_id : player_id;
      const player_1_name = p1First ? player_name : opponent.player_name;
      const player_2_name = p1First ? opponent.player_name : player_name;

      const board = buildBoard(totalForLabel(grid_size));

      const { data: room, error: roomErr } = await supabaseAdmin
        .from("game_rooms")
        .insert({
          player_1_id,
          player_2_id,
          player_1_name,
          player_2_name,
          current_turn: player_1_id,
          board: board as never,
          status: "active",
          grid_size,
        })
        .select("id")
        .single();
      if (roomErr || !room) throw new Error(roomErr?.message ?? "Failed to create room");

      // Remove both from queue
      await supabaseAdmin
        .from("waiting_players")
        .delete()
        .in("player_id", [player_id, opponent.player_id]);

      return { status: "matched" as const, game_room_id: room.id };
    }

    // 3. No opponent yet — upsert self into queue
    await supabaseAdmin
      .from("waiting_players")
      .upsert(
        { player_id, player_name, preferred_grid, joined_at: new Date().toISOString() },
        { onConflict: "player_id" }
      );

    return { status: "waiting" as const };
  });

const LeaveSchema = z.object({ player_id: z.string().min(4).max(64) });

export const leaveMatchmaking = createServerFn({ method: "POST" })
  .inputValidator((input) => LeaveSchema.parse(input))
  .handler(async ({ data }) => {
    await supabaseAdmin.from("waiting_players").delete().eq("player_id", data.player_id);
    return { ok: true };
  });
