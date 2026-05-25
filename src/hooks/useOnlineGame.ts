import { useEffect, useState, useCallback, useRef } from "react";
import { supabase, getCurrentUser } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Types
export interface GameRoom {
  id: string;
  player_1_id: string;
  player_2_id: string;
  status: "active" | "completed" | "abandoned";
  current_turn: string;
  board: CardObject[];
  player_1_score: number;
  player_2_score: number;
  player_1_moves: number;
  player_2_moves: number;
  winner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CardObject {
  card: string;
  id: number;
  revealed: boolean;
  matched: boolean;
}

export interface MatchmakingState {
  status: "idle" | "waiting" | "matched" | "error";
  gameRoomId: string | null;
  playerNumber: 1 | 2 | null;
  currentTurn: "your_turn" | "opponent_turn" | null;
  error: string | null;
}

// ============================================================================
// Hook 1: useMatchmaking
// ============================================================================
// Joins the matchmaking queue and waits for an opponent
export function useMatchmaking() {
  const [state, setState] = useState<MatchmakingState>({
    status: "idle",
    gameRoomId: null,
    playerNumber: null,
    currentTurn: null,
    error: null,
  });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const userIdRef = useRef<string | null>(null);

  const joinQueue = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: "Failed to authenticate",
        }));
        return;
      }

      userIdRef.current = user.id;
      setState((prev) => ({ ...prev, status: "waiting", error: null }));

      // Call the matchmake Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/matchmake`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ player_id: user.id }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to join queue");
      }

      const data = await response.json();

      if (data.status === "matched") {
        setState({
          status: "matched",
          gameRoomId: data.game_room_id,
          playerNumber: data.player_number,
          currentTurn: data.current_turn,
          error: null,
        });
      } else if (data.status === "waiting") {
        // Start polling for match
        pollIntervalRef.current = setInterval(async () => {
          const user = await getCurrentUser();
          if (!user) return;

          const { data: rooms, error } = await supabase
            .from("game_rooms")
            .select("*")
            .or(
              `player_1_id.eq.${user.id},player_2_id.eq.${user.id}`
            )
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (error && error.code !== "PGRST116") {
            console.error("Error polling for match:", error);
            return;
          }

          if (rooms) {
            const playerNumber =
              rooms.player_1_id === user.id ? 1 : 2;
            const currentTurn =
              rooms.current_turn === user.id ? "your_turn" : "opponent_turn";

            setState({
              status: "matched",
              gameRoomId: rooms.id,
              playerNumber,
              currentTurn,
              error: null,
            });

            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
          }
        }, 1000); // Poll every second
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setState((prev) => ({
        ...prev,
        status: "error",
        error: message,
      }));
    }
  }, []);

  const cancelQueue = useCallback(async () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Remove from waiting queue
      await supabase
        .from("waiting_players")
        .delete()
        .eq("player_id", user.id);

      setState({
        status: "idle",
        gameRoomId: null,
        playerNumber: null,
        currentTurn: null,
        error: null,
      });
    } catch (err) {
      console.error("Error canceling queue:", err);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return { ...state, joinQueue, cancelQueue };
}

// ============================================================================
// Hook 2: useGameSync
// ============================================================================
// Subscribes to game room updates and syncs board state in real-time
export function useGameSync(gameRoomId: string | null) {
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!gameRoomId) {
      setLoading(false);
      return;
    }

    async function subscribe() {
      try {
        setLoading(true);
        setError(null);

        // Fetch initial game room state
        const { data, error: fetchError } = await supabase
          .from("game_rooms")
          .select("*")
          .eq("id", gameRoomId)
          .single();

        if (fetchError) throw fetchError;
        setGameRoom(data);

        // Subscribe to real-time updates
        const channel = supabase
          .channel(`game_room:${gameRoomId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "game_rooms",
              filter: `id=eq.${gameRoomId}`,
            },
            (payload) => {
              setGameRoom(payload.new as GameRoom);
            }
          )
          .subscribe();

        channelRef.current = channel;
        setLoading(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setLoading(false);
      }
    }

    subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [gameRoomId]);

  const updateGameRoom = useCallback(
    async (updates: Partial<GameRoom>) => {
      if (!gameRoomId) return;

      try {
        const { data, error: updateError } = await supabase
          .from("game_rooms")
          .update(updates)
          .eq("id", gameRoomId)
          .select()
          .single();

        if (updateError) throw updateError;
        setGameRoom(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
      }
    },
    [gameRoomId]
  );

  return { gameRoom, loading, error, updateGameRoom };
}

// ============================================================================
// Hook 3: usePlayerPresence
// ============================================================================
// Tracks player presence in a game (optional: for detecting disconnects)
export function usePlayerPresence(gameRoomId: string | null) {
  const [opponentOnline, setOpponentOnline] = useState(true);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!gameRoomId) return;

    async function setupPresence() {
      try {
        const user = await getCurrentUser();
        if (!user) return;

        const channel = supabase.channel(`presence:${gameRoomId}`, {
          config: {
            broadcast: { self: true },
            presence: { key: user.id },
          },
        });

        channel
          .on("presence", { event: "sync" }, () => {
            const state = channel.presenceState();
            // Check if opponent is present
            const hasOpponent =
              Object.keys(state).length > 1 ||
              (Object.keys(state).length === 1 &&
                !state[user.id]);
            setOpponentOnline(hasOpponent);
          })
          .on("presence", { event: "join" }, () => {
            setOpponentOnline(true);
          })
          .on("presence", { event: "leave" }, () => {
            setOpponentOnline(false);
          })
          .subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
              await channel.track({ user_id: user.id, online_at: new Date() });
            }
          });

        presenceChannelRef.current = channel;
      } catch (err) {
        console.error("Error setting up presence:", err);
      }
    }

    setupPresence();

    return () => {
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
    };
  }, [gameRoomId]);

  return { opponentOnline };
}
