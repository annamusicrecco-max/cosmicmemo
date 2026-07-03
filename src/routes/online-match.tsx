import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Universe } from "@/components/Universe";
import { Confetti } from "@/components/Confetti";
import { GridSizeSelector, getStoredGrid } from "@/components/GridSizeSelector";
import { gridStyle, getGrid } from "@/lib/grid-sizes";
import { supabase } from "@/integrations/supabase/client";
import {
  getPlayerId, getPlayerName, setPlayerName,
  type BoardCard,
} from "@/lib/online";
import {
  joinMatchmaking, leaveMatchmaking,
  createInviteRoom, joinInviteRoom,
  requestThirdInvite, respondThirdInvite, joinRoomByCode,
  requestAiThird, respondAiThird,
} from "@/lib/matchmake.functions";
import { pickAiMove } from "@/lib/vs-ai.functions";

import { beep, vibrate } from "@/lib/game-state";
import { toast } from "sonner";
import { mpLog } from "@/lib/mp-log";
import { MatchChat } from "@/components/MatchChat";

export const Route = createFileRoute("/online-match")({
  component: OnlineMatchPage,
  head: () => ({
    meta: [
      { title: "Online Match — Cosmic Memory" },
      { name: "description", content: "Play Cosmic Memory online against a random opponent or a friend via invite." },
    ],
  }),
});

type GameRoom = {
  id: string;
  player_1_id: string;
  player_2_id: string;
  player_1_name: string;
  player_2_name: string;
  player_3_id: string | null;
  player_3_name: string | null;
  player_3_score: number;
  status: string;
  current_turn: string;
  board: BoardCard[];
  revealed: number[];
  player_1_score: number;
  player_2_score: number;
  winner_id: string | null;
  grid_size: string;
  invite_code: string | null;
  invite_third_requester: string | null;
  invite_third_status: string | null;
};

type Phase = "name" | "searching" | "inviting" | "playing";

function OnlineMatchPage() {
  const navigate = useNavigate();
  const join = useServerFn(joinMatchmaking);
  const leave = useServerFn(leaveMatchmaking);
  const createInvite = useServerFn(createInviteRoom);
  const joinInvite = useServerFn(joinInviteRoom);
  const reqThird = useServerFn(requestThirdInvite);
  const respThird = useServerFn(respondThirdInvite);
  const joinByCode = useServerFn(joinRoomByCode);
  const reqAi = useServerFn(requestAiThird);
  const respAi = useServerFn(respondAiThird);
  const pickAi = useServerFn(pickAiMove);


  const inviteIdFromUrl = useMemo(() => {
    if (typeof window === "undefined") return null;
    const u = new URL(window.location.href);
    return u.searchParams.get("invite");
  }, []);

  const [playerId] = useState(() => getPlayerId());
  const [name, setName] = useState(() => getPlayerName());
  const [grid, setGrid] = useState<string>(() => getStoredGrid());
  const [phase, setPhase] = useState<Phase>("name");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [announcedGrid, setAnnouncedGrid] = useState(false);
  const [inviteLink, setInviteLink] = useState<string>("");
  const [opponentJoinedToasted, setOpponentJoinedToasted] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [thirdRespondedFor, setThirdRespondedFor] = useState<string | null>(null);
  const [thirdJoinedToasted, setThirdJoinedToasted] = useState(false);

  // --- Optimistic flip state (fixes "burst flips" + tap-while-frozen) ---
  // localRevealed always reflects what we've optimistically shown to *this* user.
  // It is reset whenever the server-confirmed revealed[] catches up or resets.
  const [localRevealed, setLocalRevealed] = useState<number[]>([]);
  const [flipPending, setFlipPending] = useState(false);
  const localRevealedRef = useRef<number[]>([]);
  useEffect(() => { localRevealedRef.current = localRevealed; }, [localRevealed]);

  // --- Matchmaking infra ---
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const queueChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const searchStartRef = useRef<number>(0);
  const lastUpdateAtRef = useRef<number>(0);

  const clearPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };
  const clearQueueChannel = () => {
    if (queueChannelRef.current) {
      supabase.removeChannel(queueChannelRef.current);
      queueChannelRef.current = null;
    }
  };

  const tryJoin = useCallback(async (gridLabel: string, reason: string) => {
    try {
      const start = performance.now();
      const res = await join({
        data: {
          player_id: playerId,
          player_name: name.trim() || "Player",
          preferred_grid: gridLabel as "2x2" | "2x3" | "3x4" | "4x4" | "4x5" | "5x6" | "6x6",
        },
      });
      const ms = performance.now() - start;
      if (ms > 1500) mpLog.warn("match", `joinMatchmaking slow (${reason})`, { ms: Math.round(ms) });
      if (res.status === "matched" && "game_room_id" in res) {
        const wait = searchStartRef.current ? performance.now() - searchStartRef.current : 0;
        mpLog.perf("match", `matched via ${reason}`, wait, { roomId: res.game_room_id });
        clearPolling();
        clearQueueChannel();
        setRoomId(res.game_room_id);
        setPhase("playing");
      }
    } catch (e) {
      mpLog.error("match", `tryJoin error (${reason})`, { error: (e as Error).message });
    }
  }, [join, playerId, name]);

  const startSearch = async () => {
    if (!name.trim()) { toast("Please enter your name"); return; }
    setPlayerName(name.trim());
    setAnnouncedGrid(false);
    setPhase("searching");
    searchStartRef.current = performance.now();
    mpLog.info("match", "search started", { grid });

    // Realtime: react instantly when ANY game room is created/updated involving us.
    clearQueueChannel();
    const ch = supabase
      .channel(`queue:${playerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_rooms" },
        (payload) => {
          const r = payload.new as { player_1_id?: string; player_2_id?: string };
          if (r.player_1_id === playerId || r.player_2_id === playerId) {
            mpLog.info("match", "realtime room insert hit", {});
            tryJoin(grid, "realtime-insert");
          }
        },
      )
      .subscribe();
    queueChannelRef.current = ch;

    // Initial attempt + low-frequency fallback poll (in case realtime is delayed).
    await tryJoin(grid, "initial");
    pollRef.current = setInterval(() => tryJoin(grid, "poll"), 2500);
  };

  const cancelSearch = async () => {
    clearPolling();
    clearQueueChannel();
    mpLog.info("match", "search cancelled");
    await leave({ data: { player_id: playerId } });
    setPhase("name");
  };

  const startInvite = async () => {
    if (!name.trim()) { toast("Please enter your name"); return; }
    setPlayerName(name.trim());
    setAnnouncedGrid(false);
    try {
      const res = await mpLog.time("match", "createInviteRoom", () => createInvite({
        data: {
          player_id: playerId,
          player_name: name.trim(),
          preferred_grid: grid as "2x2" | "2x3" | "3x4" | "4x4" | "4x5" | "5x6" | "6x6",
        },
      }));
      const link = `${window.location.origin}/online-match?invite=${res.game_room_id}`;
      setInviteLink(link);
      setRoomId(res.game_room_id);
      setOpponentJoinedToasted(false);
      setPhase("inviting");
    } catch (e) {
      toast(`Failed to create invite: ${(e as Error).message}`);
    }
  };

  const acceptInvite = async (inviteId: string) => {
    if (!name.trim()) { toast("Please enter your name"); return; }
    setPlayerName(name.trim());
    try {
      const res = await mpLog.time("match", "joinInviteRoom", () =>
        joinInvite({ data: { room_id: inviteId, player_id: playerId, player_name: name.trim() } })
      );
      setRoomId(res.game_room_id);
      setAnnouncedGrid(false);
      setPhase("playing");
    } catch (e) {
      mpLog.error("match", `acceptInvite failed: ${(e as Error).message}`);
      toast(`${(e as Error).message}`);
    }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(inviteLink); toast("Invite link copied!"); }
    catch { toast(inviteLink); }
  };
  const shareLink = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try { await navigator.share({ title: "Cosmic Memory", text: "Join me for a Cosmic Memory match!", url: inviteLink }); return; }
      catch { /* fallthrough */ }
    }
    copyLink();
  };

  // Subscribe to room updates
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    (async () => {
      const start = performance.now();
      const { data, error } = await supabase
        .from("game_rooms").select("*").eq("id", roomId).maybeSingle();
      mpLog.perf("rt", "initial room fetch", performance.now() - start, { ok: !error });
      if (!cancelled && data && !error) {
        setRoom(data as unknown as GameRoom);
        lastUpdateAtRef.current = performance.now();
      }
    })();

    const ch = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const now = performance.now();
          if (lastUpdateAtRef.current) {
            mpLog.perf("rt", "room update gap", now - lastUpdateAtRef.current);
          }
          lastUpdateAtRef.current = now;
          setRoom(payload.new as unknown as GameRoom);
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          mpLog.warn("rt", `channel status: ${status}`);
        }
      });
    channelRef.current = ch;

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [roomId]);

  // Reset optimistic state when server-confirmed revealed[] catches up or resets.
  useEffect(() => {
    if (!room) return;
    const serverRevealed = Array.isArray(room.revealed) ? room.revealed : [];
    const local = localRevealedRef.current;
    // Server caught up to or surpassed our optimism, or board cleared a pair.
    if (serverRevealed.length === 0 || serverRevealed.length >= local.length) {
      if (local.length > 0) setLocalRevealed([]);
      if (flipPending && serverRevealed.length !== 1) setFlipPending(false);
    }
  }, [room, flipPending]);

  // Inviter notification when guest joins
  useEffect(() => {
    if (phase === "inviting" && room && room.status === "active" && !opponentJoinedToasted) {
      setOpponentJoinedToasted(true);
      mpLog.info("match", "invite accepted by guest");
      beep("match"); vibrate(80);
      toast(`🎉 ${room.player_2_name} joined! Game starting…`);
      setTimeout(() => setPhase("playing"), 600);
    }
  }, [phase, room, opponentJoinedToasted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPolling();
      clearQueueChannel();
      leave({ data: { player_id: playerId } }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Win confetti
  useEffect(() => {
    if (room?.status === "completed" && room.winner_id === playerId && !confetti) {
      setConfetti(true); beep("win");
      setTimeout(() => setConfetti(false), 2400);
    }
  }, [room?.status, room?.winner_id, playerId, confetti]);

  const playerOrder = useMemo(() => {
    if (!room) return [] as { id: string; name: string; score: number }[];
    const arr = [
      { id: room.player_1_id, name: room.player_1_name, score: room.player_1_score },
      { id: room.player_2_id, name: room.player_2_name, score: room.player_2_score },
    ];
    if (room.player_3_id) {
      arr.push({ id: room.player_3_id, name: room.player_3_name || "Player 3", score: room.player_3_score });
    }
    return arr.filter((p) => p.id && p.id !== "__waiting__");
  }, [room]);
  const nextPlayerId = (currentId: string): string => {
    if (playerOrder.length === 0) return currentId;
    const i = playerOrder.findIndex((p) => p.id === currentId);
    return playerOrder[(i + 1 + playerOrder.length) % playerOrder.length].id;
  };
  const isMyTurn = room && room.current_turn === playerId && room.status === "active";
  const iAmP1 = room && room.player_1_id === playerId;
  const iAmP2 = room && room.player_2_id === playerId;
  const iAmP3 = room && room.player_3_id === playerId;
  const myScore = room ? (iAmP1 ? room.player_1_score : iAmP2 ? room.player_2_score : room.player_3_score) : 0;
  const myName = room ? (iAmP1 ? room.player_1_name : iAmP2 ? room.player_2_name : room.player_3_name || name) : name;
  const activeName = room ? (playerOrder.find((p) => p.id === room.current_turn)?.name ?? "Opponent") : "Opponent";
  const roomGridLabel = room?.grid_size || "4x4";
  const roomGrid = getGrid(roomGridLabel);
  const scoreKey = iAmP1 ? "player_1_score" : iAmP2 ? "player_2_score" : "player_3_score";
  // Third-invite UX state
  const thirdRequestPending = !!(room && room.invite_third_status === "pending" && room.invite_third_requester);
  const iAmRequester = !!(room && room.invite_third_requester === playerId);
  const iAmResponder = !!(
    room && thirdRequestPending && !iAmRequester &&
    (room.player_1_id === playerId || room.player_2_id === playerId)
  );
  const thirdAcceptedCode = room && room.invite_third_status === "accepted" ? room.invite_code : null;
  const aiRequestPending = !!(room && room.invite_third_status === "ai_pending" && room.invite_third_requester);
  const iAmAiRequester = !!(room && aiRequestPending && room.invite_third_requester === playerId);
  const iAmAiResponder = !!(
    room && aiRequestPending && !iAmAiRequester &&
    (room.player_1_id === playerId || room.player_2_id === playerId)
  );
  const isAiPlayer3 = !!(room && room.player_3_id && room.player_3_id.startsWith("ai:"));
  const isHost = !!(room && room.player_1_id === playerId);


  useEffect(() => {
    if (phase === "playing" && room && !announcedGrid) {
      toast(`Grid: ${roomGridLabel} — Good luck!`);
      mpLog.info("match", `game started on ${roomGridLabel}`);
      setAnnouncedGrid(true);
    }
  }, [phase, room, announcedGrid, roomGridLabel]);

  // Computed view of what's revealed = server ∪ our optimistic taps.
  const displayRevealed: number[] = useMemo(() => {
    if (!room) return [];
    const server = Array.isArray(room.revealed) ? room.revealed : [];
    if (localRevealed.length > server.length) return localRevealed;
    return server;
  }, [room, localRevealed]);

  // --- AI-as-3rd-player: memory + turn runner (host client only) ---
  const aiMemoryRef = useRef<Record<number, string>>({});
  useEffect(() => {
    if (!room) return;
    const rev = Array.isArray(room.revealed) ? room.revealed : [];
    for (const i of rev) {
      const c = room.board[i];
      if (c && c.emoji) aiMemoryRef.current[i] = c.emoji;
    }
    room.board.forEach((c, i) => { if (c.matched && c.emoji) aiMemoryRef.current[i] = c.emoji; });
  }, [room]);

  const aiRunningRef = useRef(false);
  useEffect(() => {
    if (!isHost || !room || room.status !== "active") return;
    if (!isAiPlayer3 || room.current_turn !== room.player_3_id) return;
    if (aiRunningRef.current) return;
    aiRunningRef.current = true;
    const roomSnapshot = room;
    (async () => {
      try {
        await new Promise((r) => setTimeout(r, 900));
        const known = aiMemoryRef.current;
        const boardForAi = roomSnapshot.board.map((c, pos) => ({
          pos,
          emoji: c.matched || known[pos] ? c.emoji : null,
          matched: c.matched,
        }));
        const { first, second } = await pickAi({
          data: {
            board: boardForAi,
            humanScore: Math.max(roomSnapshot.player_1_score, roomSnapshot.player_2_score),
            aiScore: roomSnapshot.player_3_score,
            humanName: "Players",
            turnHistory: [],
          },
        });
        const rid = roomSnapshot.id;
        await supabase.from("game_rooms").update({
          revealed: [first] as never, updated_at: new Date().toISOString(),
        }).eq("id", rid);
        await new Promise((r) => setTimeout(r, 800));
        await supabase.from("game_rooms").update({
          revealed: [first, second] as never, updated_at: new Date().toISOString(),
        }).eq("id", rid);
        await new Promise((r) => setTimeout(r, 950));
        const isMatch = roomSnapshot.board[first]?.emoji === roomSnapshot.board[second]?.emoji;
        if (isMatch) {
          const newBoard = roomSnapshot.board.map((c, i) =>
            (i === first || i === second) ? { ...c, matched: true } : c
          );
          const allMatched = newBoard.every((c) => c.matched);
          const newAiScore = roomSnapshot.player_3_score + 1;
          const updates: Record<string, unknown> = {
            board: newBoard, revealed: [],
            player_3_score: newAiScore,
            updated_at: new Date().toISOString(),
          };
          if (allMatched) {
            const finals = [
              { id: roomSnapshot.player_1_id, score: roomSnapshot.player_1_score },
              { id: roomSnapshot.player_2_id, score: roomSnapshot.player_2_score },
              { id: roomSnapshot.player_3_id!, score: newAiScore },
            ];
            const top = Math.max(...finals.map((f) => f.score));
            const winners = finals.filter((f) => f.score === top);
            updates.status = "completed";
            updates.winner_id = winners.length === 1 ? winners[0].id : null;
          }
          await supabase.from("game_rooms").update(updates as never).eq("id", rid);
        } else {
          await supabase.from("game_rooms").update({
            revealed: [],
            current_turn: nextPlayerId(roomSnapshot.player_3_id!),
            updated_at: new Date().toISOString(),
          }).eq("id", rid);
        }
      } catch (e) {
        mpLog.error("flip", `AI turn failed: ${(e as Error).message}`);
      } finally {
        aiRunningRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.current_turn, room?.status, room?.player_3_id, isHost, isAiPlayer3]);



  const flip = async (idx: number) => {
    if (!room || !isMyTurn) return;
    if (flipPending) return; // hard lock — kills the "burst tap" backlog
    const board = room.board;
    const card = board[idx];
    if (!card || card.matched) return;
    if (displayRevealed.includes(idx)) return;
    if (displayRevealed.length >= 2) return;

    const flipStart = performance.now();
    beep("click");

    // 1) Optimistic reveal — instant UI, lock further taps until server confirms.
    const newLocal = [...displayRevealed, idx];
    setLocalRevealed(newLocal);
    setFlipPending(true);

    try {
      if (newLocal.length === 1) {
        await supabase.from("game_rooms").update({
          revealed: newLocal as never, updated_at: new Date().toISOString(),
        }).eq("id", room.id);
        mpLog.perf("flip", "first card write", performance.now() - flipStart);
        setFlipPending(false); // ready for second tap
        return;
      }

      // Second card: write reveal, evaluate after 900ms.
      const [a, b] = newLocal;
      const isMatch = board[a].emoji === board[b].emoji;
      await supabase.from("game_rooms").update({
        revealed: newLocal as never, updated_at: new Date().toISOString(),
      }).eq("id", room.id);
      mpLog.perf("flip", "second card write", performance.now() - flipStart, { match: isMatch });

      setTimeout(async () => {
        try {
          if (isMatch) {
            const newBoard = board.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c));
            const allMatched = newBoard.every((c) => c.matched);
            const newMy = myScore + 1;
            const updates: Record<string, unknown> = {
              board: newBoard,
              revealed: [],
              [scoreKey]: newMy,
              updated_at: new Date().toISOString(),
            };
            if (allMatched) {
              const finals = playerOrder.map((p) => ({
                id: p.id,
                score: p.id === playerId ? newMy : p.score,
              }));
              const top = Math.max(...finals.map((f) => f.score));
              const winners = finals.filter((f) => f.score === top);
              updates.status = "completed";
              updates.winner_id = winners.length === 1 ? winners[0].id : null;
              mpLog.info("match", "game completed", { finals });
            }
            beep("match");
            await supabase.from("game_rooms").update(updates as never).eq("id", room.id);
          } else {
            beep("miss"); vibrate(50);
            await supabase.from("game_rooms").update({
              revealed: [],
              current_turn: nextPlayerId(playerId),
              updated_at: new Date().toISOString(),
            }).eq("id", room.id);
          }
        } catch (e) {
          mpLog.error("flip", `resolve failed: ${(e as Error).message}`);
        } finally {
          setLocalRevealed([]);
          setFlipPending(false);
        }
      }, 900);
    } catch (e) {
      mpLog.error("flip", `write failed: ${(e as Error).message}`);
      setLocalRevealed([]);
      setFlipPending(false);
    }
  };

  const exit = async () => {
    if (room && room.status === "active") {
      // Winner among remaining players = leader by score (nulled if tie)
      const remaining = playerOrder.filter((p) => p.id !== playerId);
      const top = remaining.reduce((m, p) => Math.max(m, p.score), -1);
      const winners = remaining.filter((p) => p.score === top);
      await supabase.from("game_rooms").update({
        status: "abandoned",
        winner_id: winners.length === 1 ? winners[0].id : null,
      }).eq("id", room.id);
    }
    if (room && room.status === "waiting") {
      await supabase.from("game_rooms").update({ status: "abandoned" }).eq("id", room.id);
    }
    navigate({ to: "/levels" });
  };

  // --- Third player invite actions ---
  const requestThird = async () => {
    if (!room) return;
    try {
      await reqThird({ data: { room_id: room.id, requester_id: playerId } });
      toast("Invite request sent — waiting for approval.");
    } catch (e) { toast((e as Error).message); }
  };
  const requestAi = async () => {
    if (!room) return;
    try {
      await reqAi({ data: { room_id: room.id, requester_id: playerId } });
      toast("Asked opponent to add AI as 3rd player…");
    } catch (e) { toast((e as Error).message); }
  };
  const respondAi = async (accept: boolean) => {
    if (!room) return;
    setThirdRespondedFor(room.id);
    try {
      await respAi({ data: { room_id: room.id, responder_id: playerId, accept } });
      toast(accept ? "🤖 AI joined the match!" : "Declined");
    } catch (e) { toast((e as Error).message); setThirdRespondedFor(null); }
  };



  const respondThird = async (accept: boolean) => {
    if (!room) return;
    setThirdRespondedFor(room.id);
    try {
      const res = await respThird({ data: { room_id: room.id, responder_id: playerId, accept } });
      toast(accept && "code" in res ? `Code generated: ${res.code}` : accept ? "Accepted" : "Declined");
    } catch (e) { toast((e as Error).message); setThirdRespondedFor(null); }
  };
  const copyThirdCode = async () => {
    if (!thirdAcceptedCode) return;
    try { await navigator.clipboard.writeText(thirdAcceptedCode); toast("Code copied!"); }
    catch { toast(thirdAcceptedCode); }
  };
  const submitJoinCode = async () => {
    if (!name.trim()) { toast("Please enter your name"); return; }
    if (!/^\d{6}$/.test(joinCode.trim())) { toast("Enter a 6-digit code"); return; }
    setPlayerName(name.trim());
    try {
      const res = await joinByCode({
        data: { code: joinCode.trim(), player_id: playerId, player_name: name.trim() },
      });
      setRoomId(res.game_room_id);
      setAnnouncedGrid(false);
      setPhase("playing");
    } catch (e) { toast((e as Error).message); }
  };

  // Reset third-response guard when status changes
  useEffect(() => {
    if (room && room.invite_third_status !== "pending") setThirdRespondedFor(null);
  }, [room?.invite_third_status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toast host when 3rd player actually joins
  useEffect(() => {
    if (room && room.player_3_id && !thirdJoinedToasted) {
      setThirdJoinedToasted(true);
      toast(`🎉 ${room.player_3_name || "Player 3"} joined the match!`);
      beep("match");
    }
  }, [room?.player_3_id, room?.player_3_name, thirdJoinedToasted]);

  const cancelInvite = async () => {
    if (room) await supabase.from("game_rooms").update({ status: "abandoned" }).eq("id", room.id);
    setRoomId(null); setRoom(null); setInviteLink(""); setPhase("name");
    if (inviteIdFromUrl) window.history.replaceState(null, "", "/online-match");
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
            <h2 className="text-xl font-black mb-1 text-center">
              {inviteIdFromUrl ? "Join Friend's Match" : "Find an Opponent"}
            </h2>
            <p className="text-xs text-muted-foreground text-center mb-5">
              {inviteIdFromUrl
                ? "You've been invited! Enter your name to join."
                : "Match with a random player or invite a friend."}
            </p>
            <label className="text-xs uppercase tracking-widest text-accent">Your Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 20))}
              className="w-full mt-1 mb-4 px-4 py-3 rounded-xl bg-background/40 border border-white/15 focus:outline-none focus:border-accent text-sm"
              placeholder="Cosmic Player"
              autoFocus
            />
            {!inviteIdFromUrl && (
              <>
                <GridSizeSelector value={grid} onChange={setGrid} className="mb-5" />
                <p className="text-[11px] text-muted-foreground mb-4">
                  Random match: if opponent picks a different size, one is chosen at random. Invite: your size is used.
                </p>
              </>
            )}

            {inviteIdFromUrl ? (
              <button onClick={() => acceptInvite(inviteIdFromUrl)} className="btn-cosmic w-full !py-3 text-base">
                🚀 Join Match
              </button>
            ) : (
              <div className="space-y-2">
                <button onClick={startSearch} className="btn-cosmic w-full !py-3 text-base">
                  🔭 Find Random Match
                </button>
                <button
                  onClick={startInvite}
                  className="w-full py-3 rounded-full font-black text-white text-sm"
                  style={{
                    background: "linear-gradient(135deg,#22d3ee,#a855f7)",
                    boxShadow: "0 8px 24px rgba(168,85,247,0.45), inset 0 1px 0 rgba(255,255,255,0.35)",
                  }}
                >
                  🔗 Invite a Friend
                </button>

                <div className="pt-3 mt-2 border-t border-white/10">
                  <label className="text-xs uppercase tracking-widest text-accent">Join with 6-digit code</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      inputMode="numeric"
                      className="flex-1 px-4 py-3 rounded-xl bg-background/40 border border-white/15 focus:outline-none focus:border-accent text-sm font-mono tracking-widest text-center"
                      placeholder="000000"
                    />
                    <button
                      onClick={submitJoinCode}
                      className="btn-cosmic !px-4 !py-3 text-sm"
                    >
                      Join
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Enter a code shared by the host to join as the 3rd player.
                  </p>
                </div>
              </div>
            )}
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

      {phase === "inviting" && (
        <div className="flex items-center justify-center p-6">
          <div className="glass rounded-3xl p-6 w-full max-w-md pop-in text-center">
            <div className="text-5xl mb-2 animate-pulse">🔗</div>
            <h2 className="text-xl font-black mb-1">Invite Sent</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Share this link with your friend. The game starts the moment they join — you'll get a notification right here.
            </p>
            <div className="rounded-xl p-3 text-xs break-all border border-white/15 mb-3"
              style={{ background: "rgba(0,0,0,0.35)" }}>
              {inviteLink}
            </div>
            <div className="flex gap-2 mb-4">
              <button onClick={copyLink} className="flex-1 glass rounded-full py-2.5 text-sm font-semibold">📋 Copy</button>
              <button onClick={shareLink} className="flex-1 btn-cosmic !py-2.5 text-sm">📤 Share</button>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">Grid: {grid} · Waiting for opponent…</p>
            <button onClick={cancelInvite} className="text-xs text-muted-foreground underline">Cancel invite</button>
          </div>
        </div>
      )}

      {phase === "playing" && room && (
        <>
          <div className="flex items-center justify-center gap-2 px-4 mt-3 flex-wrap">
            {playerOrder.map((p) => (
              <PlayerBadge
                key={p.id}
                name={p.id === playerId ? `${p.name} (You)` : p.name}
                score={p.score}
                active={room.current_turn === p.id && room.status === "active"}
              />
            ))}
          </div>

          <div className="text-center mt-2 text-sm font-semibold text-accent">
            {room.status === "completed"
              ? room.winner_id === playerId ? "🏆 You win!"
                : room.winner_id === null ? "It's a tie!"
                : `${playerOrder.find((p) => p.id === room.winner_id)?.name ?? "Opponent"} wins`
              : room.status === "abandoned" ? "Match ended"
              : isMyTurn ? "Your turn" : `${activeName}'s turn`}
            <span className="ml-2 text-[11px] text-muted-foreground">· Grid {roomGridLabel}</span>
          </div>

          {/* Third player controls */}
          {room.status === "active" && !room.player_3_id && (
            <div className="flex items-center justify-center gap-2 mt-3 px-4 flex-wrap">
              {!thirdRequestPending && !thirdAcceptedCode && (
                <button
                  onClick={requestThird}
                  className="glass rounded-full px-4 py-2 text-xs font-semibold"
                  title="Invite a third player"
                >
                  ➕ Invite 3rd Player
                </button>
              )}
              {thirdAcceptedCode && (
                <div className="glass rounded-full px-4 py-2 text-xs font-semibold flex items-center gap-2">
                  <span>Code:</span>
                  <span className="font-mono text-accent tracking-widest">{thirdAcceptedCode}</span>
                  <button onClick={copyThirdCode} className="underline">Copy</button>
                </div>
              )}
              {thirdRequestPending && iAmRequester && !thirdAcceptedCode && (
                <span className="text-xs text-muted-foreground">Waiting for approval…</span>
              )}
            </div>
          )}

          {/* Responder modal */}
          {iAmResponder && thirdRespondedFor !== room.id && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm">
              <div className="glass rounded-3xl p-6 max-w-sm w-full text-center pop-in">
                <div className="text-4xl mb-2">➕</div>
                <h3 className="text-lg font-black mb-1">Invite 3rd Player?</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  {playerOrder.find((p) => p.id === room.invite_third_requester)?.name || "Your opponent"} wants to invite a third player to this match.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => respondThird(false)} className="flex-1 glass rounded-full py-2.5 text-sm font-semibold">Deny</button>
                  <button onClick={() => respondThird(true)} className="flex-1 btn-cosmic !py-2.5 text-sm">Accept</button>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center p-4">
            <div className="grid gap-2 sm:gap-3 w-full max-w-[min(92vw,90vh)]" style={gridStyle(roomGrid.cols)}>
              {room.board.map((c, i) => {
                const revealed = displayRevealed.includes(i);
                const showFront = revealed || c.matched;
                const disabled = !isMyTurn || c.matched || revealed || flipPending || displayRevealed.length >= 2;
                return (
                  <button
                    key={i}
                    onClick={() => flip(i)}
                    disabled={disabled}
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


          <MatchChat
            roomId={room.id}
            playerId={playerId}
            playerName={myName}
            opponentName={playerOrder.filter((p) => p.id !== playerId).map((p) => p.name).join(" & ") || "Opponents"}
            disabled={room.status !== "active"}
          />




          <div className="flex justify-center gap-2 pb-6">
            {room.status !== "active" ? (
              <>
                <button
                  className="btn-cosmic !px-5 !py-2.5 text-sm"
                  onClick={() => {
                    setRoom(null); setRoomId(null); setPhase("name");
                    if (inviteIdFromUrl) window.history.replaceState(null, "", "/online-match");
                  }}
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
