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

// --------- Third-player invite flow ---------

function gen6DigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const RequestThirdSchema = z.object({
  room_id: z.string().uuid(),
  requester_id: z.string().min(4).max(64),
});

export const requestThirdInvite = createServerFn({ method: "POST" })
  .inputValidator((input) => RequestThirdSchema.parse(input))
  .handler(async ({ data }) => {
    const { room_id, requester_id } = data;
    const { data: room, error } = await supabaseAdmin
      .from("game_rooms")
      .select("id, player_1_id, player_2_id, player_3_id, status")
      .eq("id", room_id)
      .maybeSingle();
    if (error || !room) throw new Error("Room not found");
    if (room.status !== "active") throw new Error("Room is not active");
    if (room.player_3_id) throw new Error("Third player already joined");
    if (room.player_1_id !== requester_id && room.player_2_id !== requester_id) {
      throw new Error("You are not in this room");
    }
    await supabaseAdmin
      .from("game_rooms")
      .update({
        invite_third_requester: requester_id,
        invite_third_status: "pending",
        invite_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", room_id);
    return { ok: true };
  });

const RespondThirdSchema = z.object({
  room_id: z.string().uuid(),
  responder_id: z.string().min(4).max(64),
  accept: z.boolean(),
});

export const respondThirdInvite = createServerFn({ method: "POST" })
  .inputValidator((input) => RespondThirdSchema.parse(input))
  .handler(async ({ data }) => {
    const { room_id, responder_id, accept } = data;
    const { data: room, error } = await supabaseAdmin
      .from("game_rooms")
      .select("id, player_1_id, player_2_id, invite_third_requester, invite_third_status, player_3_id")
      .eq("id", room_id)
      .maybeSingle();
    if (error || !room) throw new Error("Room not found");
    if (room.player_3_id) throw new Error("Third player already joined");
    if (room.invite_third_status !== "pending") throw new Error("No pending invite");
    if (room.invite_third_requester === responder_id) throw new Error("Requester cannot respond");
    if (room.player_1_id !== responder_id && room.player_2_id !== responder_id) {
      throw new Error("You are not in this room");
    }
    if (!accept) {
      await supabaseAdmin
        .from("game_rooms")
        .update({
          invite_third_status: "denied",
          invite_third_requester: null,
          invite_code: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", room_id);
      return { ok: true, accepted: false as const };
    }
    // Generate a unique 6-digit code (retry a few times if collision).
    let code = gen6DigitCode();
    for (let i = 0; i < 5; i++) {
      const { data: clash } = await supabaseAdmin
        .from("game_rooms").select("id").eq("invite_code", code).maybeSingle();
      if (!clash) break;
      code = gen6DigitCode();
    }
    await supabaseAdmin
      .from("game_rooms")
      .update({
        invite_third_status: "accepted",
        invite_code: code,
        updated_at: new Date().toISOString(),
      })
      .eq("id", room_id);
    return { ok: true, accepted: true as const, code };
  });

const JoinByCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
  player_id: z.string().min(4).max(64),
  player_name: z.string().min(1).max(20),
});

export const joinRoomByCode = createServerFn({ method: "POST" })
  .inputValidator((input) => JoinByCodeSchema.parse(input))
  .handler(async ({ data }) => {
    const { code, player_id, player_name } = data;
    const { data: room, error } = await supabaseAdmin
      .from("game_rooms")
      .select("id, status, player_1_id, player_2_id, player_3_id, invite_third_status")
      .eq("invite_code", code)
      .maybeSingle();
    if (error || !room) throw new Error("Invalid or expired code");
    if (room.status !== "active") throw new Error("Game is no longer active");
    if (room.player_3_id) throw new Error("Third seat already taken");
    if (room.invite_third_status !== "accepted") throw new Error("Invite not accepted yet");
    if (room.player_1_id === player_id || room.player_2_id === player_id) {
      throw new Error("You are already in this room");
    }
    const { error: updErr } = await supabaseAdmin
      .from("game_rooms")
      .update({
        player_3_id: player_id,
        player_3_name: player_name,
        invite_third_status: "joined",
        invite_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", room.id)
      .is("player_3_id", null);
    if (updErr) throw new Error(updErr.message);
    return { game_room_id: room.id };
  });

// --------- AI as third-player flow ---------

const RequestAiSchema = z.object({
  room_id: z.string().uuid(),
  requester_id: z.string().min(4).max(64),
});

export const requestAiThird = createServerFn({ method: "POST" })
  .inputValidator((input) => RequestAiSchema.parse(input))
  .handler(async ({ data }) => {
    const { room_id, requester_id } = data;
    const { data: room, error } = await supabaseAdmin
      .from("game_rooms")
      .select("id, player_1_id, player_2_id, player_3_id, status")
      .eq("id", room_id)
      .maybeSingle();
    if (error || !room) throw new Error("Room not found");
    if (room.status !== "active") throw new Error("Room is not active");
    if (room.player_3_id) throw new Error("Third player already joined");
    if (room.player_1_id !== requester_id && room.player_2_id !== requester_id) {
      throw new Error("You are not in this room");
    }
    await supabaseAdmin
      .from("game_rooms")
      .update({
        invite_third_requester: requester_id,
        invite_third_status: "ai_pending",
        invite_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", room_id);
    return { ok: true };
  });

const RespondAiSchema = z.object({
  room_id: z.string().uuid(),
  responder_id: z.string().min(4).max(64),
  accept: z.boolean(),
});

export const respondAiThird = createServerFn({ method: "POST" })
  .inputValidator((input) => RespondAiSchema.parse(input))
  .handler(async ({ data }) => {
    const { room_id, responder_id, accept } = data;
    const { data: room, error } = await supabaseAdmin
      .from("game_rooms")
      .select("id, player_1_id, player_2_id, invite_third_requester, invite_third_status, player_3_id")
      .eq("id", room_id)
      .maybeSingle();
    if (error || !room) throw new Error("Room not found");
    if (room.player_3_id) throw new Error("Third player already joined");
    if (room.invite_third_status !== "ai_pending") throw new Error("No pending AI invite");
    if (room.invite_third_requester === responder_id) throw new Error("Requester cannot respond");
    if (room.player_1_id !== responder_id && room.player_2_id !== responder_id) {
      throw new Error("You are not in this room");
    }
    if (!accept) {
      await supabaseAdmin
        .from("game_rooms")
        .update({
          invite_third_status: "denied",
          invite_third_requester: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", room_id);
      return { ok: true, accepted: false as const };
    }
    const aiId = `ai:cosmo:${Math.random().toString(36).slice(2, 8)}`;
    await supabaseAdmin
      .from("game_rooms")
      .update({
        player_3_id: aiId,
        player_3_name: "🤖 Cosmo (AI)",
        invite_third_status: "joined",
        updated_at: new Date().toISOString(),
      })
      .eq("id", room_id);
    return { ok: true, accepted: true as const };
  });

