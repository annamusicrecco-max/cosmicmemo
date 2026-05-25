// Phase 1: Matchmaking Edge Function
// This function pairs waiting players, creates a game room, and initiates the game.
// Triggered via HTTP POST from the frontend when a player wants to join the queue.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Initialize Supabase client with service role (for admin operations)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Define card emoji deck (8 pairs for 4x4 grid)
const CARD_DECK = [
  "🐱", "🐱",
  "🐶", "🐶",
  "🦁", "🦁",
  "🐯", "🐯",
  "🐻", "🐻",
  "🐼", "🐼",
  "🐨", "🐨",
  "🐭", "🐭",
];

// Shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Create initial game board (4x4 grid)
function createGameBoard() {
  const shuffledCards = shuffleArray(CARD_DECK);
  return shuffledCards.map((card, id) => ({
    card,
    id,
    revealed: false,
    matched: false,
  }));
}

// Main handler
serve(async (req) => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Parse request body to get player_id
    const { player_id } = await req.json();

    if (!player_id) {
      return new Response(
        JSON.stringify({ error: "player_id is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if player is already waiting
    const { data: existingWait, error: checkError } = await supabaseAdmin
      .from("waiting_players")
      .select("id")
      .eq("player_id", player_id)
      .single();

    if (!checkError && existingWait) {
      return new Response(
        JSON.stringify({
          error: "Player is already in the queue",
          game_room_id: null,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Add player to waiting queue
    const { data: newWait, error: insertError } = await supabaseAdmin
      .from("waiting_players")
      .insert([{ player_id }])
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting into waiting_players:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to join queue" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if there's another player waiting (FIFO: earliest first, excluding current player)
    const { data: otherWaiters, error: queryError } = await supabaseAdmin
      .from("waiting_players")
      .select("player_id")
      .neq("player_id", player_id)
      .order("joined_at", { ascending: true })
      .limit(1);

    if (queryError) {
      console.error("Error querying waiting_players:", queryError);
      return new Response(
        JSON.stringify({ error: "Failed to find match" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // If no other player waiting, return waiting status
    if (!otherWaiters || otherWaiters.length === 0) {
      return new Response(
        JSON.stringify({
          status: "waiting",
          game_room_id: null,
          message: "Waiting for another player...",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Match found! Create game room
    const opponent_id = otherWaiters[0].player_id;
    const board = createGameBoard();

    // Randomly decide who goes first
    const player_1_id = Math.random() > 0.5 ? player_id : opponent_id;
    const player_2_id = player_1_id === player_id ? opponent_id : player_id;
    const current_turn = player_1_id; // Player 1 always starts

    const { data: gameRoom, error: createError } = await supabaseAdmin
      .from("game_rooms")
      .insert([
        {
          player_1_id,
          player_2_id,
          status: "active",
          current_turn,
          board,
          player_1_score: 0,
          player_2_score: 0,
          player_1_moves: 0,
          player_2_moves: 0,
        },
      ])
      .select()
      .single();

    if (createError) {
      console.error("Error creating game_room:", createError);
      return new Response(
        JSON.stringify({ error: "Failed to create game room" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Remove both players from waiting queue
    const { error: deleteError } = await supabaseAdmin
      .from("waiting_players")
      .delete()
      .in("player_id", [player_id, opponent_id]);

    if (deleteError) {
      console.error("Error removing players from queue:", deleteError);
      // Don't fail the request; game room is already created
    }

    // Return success with game room ID
    return new Response(
      JSON.stringify({
        status: "matched",
        game_room_id: gameRoom.id,
        player_number: player_1_id === player_id ? 1 : 2,
        current_turn: current_turn === player_id ? "your_turn" : "opponent_turn",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error in matchmake function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
