import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Universe } from "@/components/Universe";
import { Confetti } from "@/components/Confetti";
import { GridSizeSelector, getStoredGrid } from "@/components/GridSizeSelector";
import { gridStyle, getGrid } from "@/lib/grid-sizes";
import { supabase } from "@/integrations/supabase/client";
import {
  getPlayerId,
  getPlayerName,
  setPlayerName,
  type BoardCard,
} from "@/lib/online";
import { joinMatchmaking, leaveMatchmaking } from "@/lib/matchmake.functions";
import { beep, vibrate } from "@/lib/game-state";
import { toast } from "sonner";

export const Route = createFileRoute("/online-match")({
  component: OnlineMatchPage,
  head: () => ({
    meta: [
      { title: "Online Match — Cosmic Memory" },
      { name: "description", content: "Play Cosmic Memory online against a random opponent." },
    ],
  }),
});

type GameRoom = {
  id: string;
  player_1_id: string;
  player_2_id: string;
  player_1_name: string;
  player_2_name: string;
  status: string;
  current_turn: string;
  board: BoardCard[];
  revealed: number[];
  player_1_score: number;
  player_2_score: number;
  winner_id: string | null;
  grid_size: string;
};

type Phase = "name" | "searching" | "playing";

function OnlineMatchPage() {
  const navigate = useNavigate();
  const join = useServerFn(joinMatchmaking);
  const leave = useServerFn(leaveMatchmaking);

  const [playerId] = useState(() => getPlayerId());
  const [name, setName] = useState(() => getPlayerName());
  const [grid, setGrid] = useState<string>(() => getStoredGrid());
  const [phase, setPhase] = useState<Phase>("name");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [announcedGrid, setAnnouncedGrid] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const clearPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const tryJoin = async (gridLabel: string) => {
    const res = await join({
      data: {
        player_id: playerId,
        player_name: name.trim() || "Player",
        preferred_grid: gridLabel as "2x2" | "2x3" | "3x4" | "4x4" | "4x5" | "5x6" | "6x6",
      },
    });
    if (res.status === "matched" && "game_room_id" in res) {
      clearPolling();
      setRoomId(res.game_room_id);
      setPhase("playing");
    }
  };

  // Start searching
  const startSearch = async () => {
    if (!name.trim()) { toast("Please enter your name"); return; }
    setPlayerName(name.trim());
    setAnnouncedGrid(false);
    setPhase("searching");
    await tryJoin(grid);
    pollRef.current = setInterval(() => tryJoin(grid), 2000);
  };

  const cancelSearch = async () => {
    clearPolling();
    await leave({ data: { player_id: playerId } });
    setPhase("name");
  };

  // Subscribe to room updates
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle();
      if (!cancelled && data && !error) setRoom(data as unknown as GameRoom);
    })();

    const ch = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${roomId}` },
        (payload) => setRoom(payload.new as unknown as GameRoom),
      )
      .subscribe();
    channelRef.current = ch;

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [roomId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { clearPolling(); leave({ data: { player_id: playerId } }).catch(() => {}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Win confetti
  useEffect(() => {
    if (room?.status === "completed" && room.winner_id === playerId && !confetti) {
      setConfetti(true);
      beep("win");
      setTimeout(() => setConfetti(false), 2400);
    }
  }, [room?.status, room?.winner_id, playerId, confetti]);

  const isMyTurn = room && room.current_turn === playerId && room.status === "active";
  const iAmP1 = room && room.player_1_id === playerId;
  const myScore = room ? (iAmP1 ? room.player_1_score : room.player_2_score) : 0;
  const oppScore = room ? (iAmP1 ? room.player_2_score : room.player_1_score) : 0;
  const myName = room ? (iAmP1 ? room.player_1_name : room.player_2_name) : name;
  const oppName = room ? (iAmP1 ? room.player_2_name : room.player_1_name) : "Opponent";

  const flip = async (idx: number) => {
    if (!room || !isMyTurn) return;
    const board = room.board;
    const card = board[idx];
    if (!card || card.matched) return;
    const revealed = Array.isArray(room.revealed) ? room.revealed : [];
    if (revealed.includes(idx)) return;
    if (revealed.length >= 2) return;

    beep("click");
    const newRevealed = [...revealed, idx];

    if (newRevealed.length === 1) {
      await supabase.from("game_rooms").update({
        revealed: newRevealed as never,
        updated_at: new Date().toISOString(),
      }).eq("id", room.id);
      return;
    }

    // Second flip — resolve match/miss
    const [a, b] = newRevealed;
    const isMatch = board[a].emoji === board[b].emoji;

    // Show both for a moment
    await supabase.from("game_rooms").update({
      revealed: newRevealed as never,
      updated_at: new Date().toISOString(),
    }).eq("id", room.id);

    setTimeout(async () => {
      if (isMatch) {
        const newBoard = board.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c));
        const allMatched = newBoard.every((c) => c.matched);
        const newMy = (iAmP1 ? room.player_1_score : room.player_2_score) + 1;
        const updates: Record<string, unknown> = {
          board: newBoard,
          revealed: [],
          [iAmP1 ? "player_1_score" : "player_2_score"]: newMy,
          updated_at: new Date().toISOString(),
        };
        if (allMatched) {
          const p1Final = iAmP1 ? newMy : room.player_1_score;
          const p2Final = iAmP1 ? room.player_2_score : newMy;
          updates.status = "completed";
          updates.winner_id =
            p1Final === p2Final ? null : p1Final > p2Final ? room.player_1_id : room.player_2_id;
        }
        beep("match");
        await supabase.from("game_rooms").update(updates as never).eq("id", room.id);
      } else {
        beep("miss"); vibrate(50);
        await supabase.from("game_rooms").update({
          revealed: [],
          current_turn: iAmP1 ? room.player_2_id : room.player_1_id,
          updated_at: new Date().toISOString(),
        }).eq("id", room.id);
      }
    }, 900);
  };

  const exit = async () => {
    if (room && room.status === "active") {
      await supabase.from("game_rooms").update({
        status: "abandoned",
        winner_id: iAmP1 ? room.player_2_id : room.player_1_id,
      }).eq("id", room.id);
    }
    navigate({ to: "/levels" });
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <Universe parallax={0.2} />
      <Confetti active={confetti} />

      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 pt-3 mt-3">
        <Link to="/levels" className="glass rounded-full px-4 py-2 text-sm font-semibold">← Map</Link>
        <h1 className="text-lg sm:text-2xl font-black text-glow">Online Match</h1>
        <div className="w-16" />
      </header>

      {phase === "name" && (
        <div className="flex items-center justify-center p-6">
          <div className="glass rounded-3xl p-6 w-full max-w-md pop-in">
            <h2 className="text-xl font-black mb-1 text-center">Find an Opponent</h2>
            <p className="text-xs text-muted-foreground text-center mb-5">
              Choose a name, then we'll match you with a random player.
            </p>
            <label className="text-xs uppercase tracking-widest text-accent">Your Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 20))}
              className="w-full mt-1 mb-5 px-4 py-3 rounded-xl bg-background/40 border border-white/15 focus:outline-none focus:border-accent text-sm"
              placeholder="Cosmic Player"
              autoFocus
            />
            <button onClick={startSearch} className="btn-cosmic w-full !py-3 text-base">
              🔭 Find Match
            </button>
          </div>
        </div>
      )}

      {phase === "searching" && (
        <div className="flex items-center justify-center p-6">
          <div className="glass rounded-3xl p-8 w-full max-w-md pop-in text-center">
            <div className="text-5xl mb-3 animate-pulse">🛰️</div>
            <h2 className="text-xl font-black mb-1">Searching the cosmos…</h2>
            <p className="text-xs text-muted-foreground mb-5">Waiting for another explorer to join.</p>
            <button onClick={cancelSearch} className="glass rounded-full px-5 py-2.5 text-sm font-semibold">
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === "playing" && room && (
        <>
          <div className="flex items-center justify-center gap-2 px-4 mt-3 flex-wrap">
            <PlayerBadge name={`${myName} (You)`} score={myScore} active={!!isMyTurn} />
            <span className="text-xs text-muted-foreground">vs</span>
            <PlayerBadge name={oppName} score={oppScore} active={!isMyTurn && room.status === "active"} />
          </div>

          <div className="text-center mt-2 text-sm font-semibold text-accent">
            {room.status === "completed"
              ? room.winner_id === playerId
                ? "🏆 You win!"
                : room.winner_id === null
                  ? "It's a tie!"
                  : `${oppName} wins`
              : room.status === "abandoned"
                ? "Opponent left — you win"
                : isMyTurn
                  ? "Your turn"
                  : `${oppName}'s turn`}
          </div>

          <div className="flex items-center justify-center p-4">
            <div className="grid grid-cols-4 gap-2 sm:gap-3 w-full max-w-[min(90vw,90vh)]">
              {room.board.map((c, i) => {
                const revealed = (Array.isArray(room.revealed) ? room.revealed : []).includes(i);
                const showFront = revealed || c.matched;
                return (
                  <button
                    key={i}
                    onClick={() => flip(i)}
                    disabled={!isMyTurn || c.matched || revealed}
                    className="relative aspect-square w-full rounded-2xl"
                    style={{ perspective: "800px" }}
                  >
                    <div className={`absolute inset-0 card-3d rounded-2xl ${showFront ? "flipped" : ""} ${c.matched ? "matched-glow" : ""}`}>
                      <div className="card-face absolute inset-0 rounded-2xl overflow-hidden flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg, oklch(0.55 0.18 290), oklch(0.45 0.18 240))", border: "1px solid oklch(1 0 0 / 0.18)" }}>
                        <span className="text-glow text-2xl">✦</span>
                      </div>
                      <div className="card-face card-back absolute inset-0 rounded-2xl overflow-hidden flex items-center justify-center text-4xl sm:text-5xl"
                        style={{ background: "linear-gradient(135deg, oklch(0.97 0.04 90), oklch(0.92 0.08 320))", color: "oklch(0.15 0 0)", border: "1px solid oklch(1 0 0 / 0.3)" }}>
                        <span>{c.emoji}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-center gap-2 pb-6">
            {room.status !== "active" ? (
              <>
                <button
                  className="btn-cosmic !px-5 !py-2.5 text-sm"
                  onClick={() => { setRoom(null); setRoomId(null); setPhase("name"); }}
                >
                  Play Again
                </button>
                <Link to="/levels" className="glass rounded-full px-5 py-2.5 text-sm font-semibold">Back to Map</Link>
              </>
            ) : (
              <button onClick={exit} className="glass rounded-full px-5 py-2.5 text-sm font-semibold">
                Leave Match
              </button>
            )}
          </div>
        </>
      )}
    </main>
  );
}

function PlayerBadge({ name, score, active }: { name: string; score: number; active: boolean }) {
  return (
    <div
      className={`rounded-full px-4 py-2 text-sm font-bold transition ${active ? "scale-105" : "opacity-60"}`}
      style={active ? {
        background: "linear-gradient(135deg,#a855f7,#ec4899)",
        boxShadow: "0 0 22px rgba(236,72,153,0.55)",
        color: "#fff",
      } : { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
    >
      {name}: {score}
    </div>
  );
}
