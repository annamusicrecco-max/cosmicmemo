import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildBoard } from "./online";

const JoinSchema = z.object({
  player_id: z.string().min(4).max(64),
  player_name: z.string().min(1).max(20),
});

export const joinMatchmaking = createServerFn({ method: "POST" })
  .inputValidator((input) => JoinSchema.parse(input))
  .handler(async ({ data }) => {
    const { player_id, player_name } = data;

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
      .select("player_id, player_name")
      .neq("player_id", player_id)
      .order("joined_at", { ascending: true })
      .limit(1);

    if (others && others.length > 0) {
      const opponent = others[0];
      // Coin flip for who goes first
      const p1First = Math.random() < 0.5;
      const player_1_id = p1First ? player_id : opponent.player_id;
      const player_2_id = p1First ? opponent.player_id : player_id;
      const player_1_name = p1First ? player_name : opponent.player_name;
      const player_2_name = p1First ? opponent.player_name : player_name;

      const board = buildBoard();

      const { data: room, error: roomErr } = await supabaseAdmin
        .from("game_rooms")
        .insert({
          player_1_id,
          player_2_id,
          player_1_name,
          player_2_name,
          current_turn: player_1_id,
          board: board as unknown as object,
          status: "active",
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
        { player_id, player_name, joined_at: new Date().toISOString() },
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
