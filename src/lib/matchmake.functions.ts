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

    const { data: others } = await supabaseAdmin
      .from("waiting_players")
      .select("player_id, player_name, preferred_grid")
      .neq("player_id", player_id)
      .order("joined_at", { ascending: true })
      .limit(1);

    if (others && others.length > 0) {
      const opponent = others[0] as { player_id: string; player_name: string; preferred_grid: string };
      const oppGrid = opponent.preferred_grid || "4x4";
      const grid_size =
        oppGrid === preferred_grid
          ? preferred_grid
          : Math.random() < 0.5 ? preferred_grid : oppGrid;

      const p1First = Math.random() < 0.5;
      const player_1_id = p1First ? player_id : opponent.player_id;
      const player_2_id = p1First ? opponent.player_id : player_id;
      const player_1_name = p1First ? player_name : opponent.player_name;
      const player_2_name = p1First ? opponent.player_name : player_name;

      const board = buildBoard(totalForLabel(grid_size));

      const { data: room, error: roomErr } = await supabaseAdmin
        .from("game_rooms")
        .insert({
          player_1_id, player_2_id, player_1_name, player_2_name,
          current_turn: player_1_id,
          board: board as never,
          status: "active",
          grid_size,
        })
        .select("id")
        .single();
      if (roomErr || !room) throw new Error(roomErr?.message ?? "Failed to create room");

      await supabaseAdmin
        .from("waiting_players")
        .delete()
        .in("player_id", [player_id, opponent.player_id]);

      return { status: "matched" as const, game_room_id: room.id };
    }

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

// --------- Invite link flow ---------

const CreateInviteSchema = z.object({
  player_id: z.string().min(4).max(64),
  player_name: z.string().min(1).max(20),
  preferred_grid: z.enum(GRID_LABELS).default("4x4"),
});

export const createInviteRoom = createServerFn({ method: "POST" })
  .inputValidator((input) => CreateInviteSchema.parse(input))
  .handler(async ({ data }) => {
    const { player_id, player_name, preferred_grid } = data;
    const board = buildBoard(totalForLabel(preferred_grid));
    const { data: room, error } = await supabaseAdmin
      .from("game_rooms")
      .insert({
        player_1_id: player_id,
        player_2_id: "__waiting__",
        player_1_name: player_name,
        player_2_name: "Waiting…",
        current_turn: player_id,
        board: board as never,
        status: "waiting",
        grid_size: preferred_grid,
      })
      .select("id")
      .single();
    if (error || !room) throw new Error(error?.message ?? "Failed to create invite room");
    return { game_room_id: room.id };
  });

const JoinInviteSchema = z.object({
  room_id: z.string().uuid(),
  player_id: z.string().min(4).max(64),
  player_name: z.string().min(1).max(20),
});

export const joinInviteRoom = createServerFn({ method: "POST" })
  .inputValidator((input) => JoinInviteSchema.parse(input))
  .handler(async ({ data }) => {
    const { room_id, player_id, player_name } = data;
    const { data: room, error: fetchErr } = await supabaseAdmin
      .from("game_rooms")
      .select("id, player_1_id, status")
      .eq("id", room_id)
      .maybeSingle();
    if (fetchErr || !room) throw new Error("Invite not found");
    // If player_1 reopens their own link, just bounce them back into the room
    if (room.player_1_id === player_id) {
      return { game_room_id: room.id, role: "host" as const };
    }
    if (room.status === "active") {
      // Someone else already joined
      throw new Error("This invite has already been used");
    }
    if (room.status !== "waiting") throw new Error("Invite no longer valid");

    const { error: updErr } = await supabaseAdmin
      .from("game_rooms")
      .update({
        player_2_id: player_id,
        player_2_name: player_name,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", room_id)
      .eq("status", "waiting");
    if (updErr) throw new Error(updErr.message);

    return { game_room_id: room.id, role: "guest" as const };
  });
