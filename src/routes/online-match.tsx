import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMatchmaking, useGameSync, usePlayerPresence } from "@/hooks/useOnlineGame";
import { getCurrentUser } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function OnlineMatchRoute() {
  const navigate = useNavigate();
  const { status, gameRoomId, playerNumber, currentTurn, error, joinQueue, cancelQueue } = useMatchmaking();
  const { gameRoom, loading: gameLoading, updateGameRoom } = useGameSync(gameRoomId);
  const { opponentOnline } = usePlayerPresence(gameRoomId);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [revealedCards, setRevealedCards] = useState<Set<number>>(new Set());
  const [matchedCards, setMatchedCards] = useState<Set<number>>(new Set());

  // Initialize user and fetch auth
  useEffect(() => {
    async function initUser() {
      const user = await getCurrentUser();
      if (user) {
        setUserId(user.id);
      }
    }
    initUser();
  }, []);

  // Join matchmaking queue on mount
  useEffect(() => {
    if (userId && status === "idle") {
      joinQueue();
    }
  }, [userId, status, joinQueue]);

  // Handle card reveal
  const handleCardClick = (cardIndex: number) => {
    if (!gameRoom || !userId) return;
    if (currentTurn !== "your_turn") return;
    if (matchedCards.has(cardIndex) || revealedCards.has(cardIndex)) return;

    const newSelected = [...selectedCards, cardIndex];
    setSelectedCards(newSelected);
    setRevealedCards((prev) => new Set(prev).add(cardIndex));

    // If two cards selected, check for match
    if (newSelected.length === 2) {
      const [card1Index, card2Index] = newSelected;
      const card1 = gameRoom.board[card1Index];
      const card2 = gameRoom.board[card2Index];

      if (card1.card === card2.card) {
        // Match found!
        setMatchedCards((prev) => new Set(prev).add(card1Index).add(card2Index));
        
        const isPlayer1 = playerNumber === 1;
        const newScore = isPlayer1
          ? gameRoom.player_1_score + 1
          : gameRoom.player_2_score + 1;

        // Update score and switch turn
        updateGameRoom({
          board: gameRoom.board.map((c, idx) =>
            matchedCards.has(idx) || newSelected.includes(idx)
              ? { ...c, matched: true }
              : c
          ),
          [isPlayer1 ? "player_1_score" : "player_2_score"]: newScore,
          [isPlayer1 ? "player_1_moves" : "player_2_moves"]:
            (isPlayer1 ? gameRoom.player_1_moves : gameRoom.player_2_moves) + 1,
          current_turn: isPlayer1 ? gameRoom.player_2_id : gameRoom.player_1_id,
        });
      } else {
        // No match, flip back after delay
        setTimeout(() => {
          setRevealedCards((prev) => {
            const next = new Set(prev);
            next.delete(card1Index);
            next.delete(card2Index);
            return next;
          });

          // Switch turn
          const isPlayer1 = playerNumber === 1;
          updateGameRoom({
            [isPlayer1 ? "player_1_moves" : "player_2_moves"]:
              (isPlayer1 ? gameRoom.player_1_moves : gameRoom.player_2_moves) + 1,
            current_turn: isPlayer1 ? gameRoom.player_2_id : gameRoom.player_1_id,
          });
        }, 1000);
      }

      setSelectedCards([]);
    }
  };

  // Check for game completion
  useEffect(() => {
    if (gameRoom && matchedCards.size === gameRoom.board.length) {
      const player1Total = gameRoom.player_1_score;
      const player2Total = gameRoom.player_2_score;
      const winnerId = player1Total > player2Total ? gameRoom.player_1_id : gameRoom.player_2_id;

      updateGameRoom({
        status: "completed",
        winner_id: winnerId,
      });
    }
  }, [gameRoom, matchedCards.size, updateGameRoom]);

  // Waiting for match
  if (status === "waiting") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500">
        <Card className="w-full max-w-md p-8 text-center shadow-2xl">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-600" />
          <h1 className="text-2xl font-bold mb-2">Waiting for opponent...</h1>
          <p className="text-gray-600 mb-6">Finding a match for you</p>
          <Button variant="destructive" onClick={cancelQueue} className="w-full">
            Cancel
          </Button>
        </Card>
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500">
        <Card className="w-full max-w-md p-8 text-center shadow-2xl">
          <h1 className="text-2xl font-bold mb-2 text-red-600">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => navigate({ to: "/" })} className="w-full">
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  // Game in progress
  if (status === "matched" && gameRoom && userId) {
    const isPlayer1 = playerNumber === 1;
    const currentScore = isPlayer1 ? gameRoom.player_1_score : gameRoom.player_2_score;
    const opponentScore = isPlayer1 ? gameRoom.player_2_score : gameRoom.player_1_score;
    const isYourTurn = currentTurn === "your_turn";

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Cosmic Memory Online</h1>
            <p className={`text-lg ${opponentOnline ? "text-green-300" : "text-red-300"}`}>
              Opponent {opponentOnline ? "Online" : "Offline"}
            </p>
          </div>

          {/* Score & Turn Info */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <Card className={`p-4 text-center ${isPlayer1 ? "bg-blue-100 border-blue-400" : ""}`}>
              <p className="text-sm text-gray-600">You</p>
              <p className="text-3xl font-bold text-blue-600">{currentScore}</p>
            </Card>
            <Card className={`p-4 text-center ${!isPlayer1 ? "bg-pink-100 border-pink-400" : ""}`}>
              <p className="text-sm text-gray-600">Opponent</p>
              <p className="text-3xl font-bold text-pink-600">{opponentScore}</p>
            </Card>
          </div>

          {/* Turn Indicator */}
          <div className="mb-8">
            <p className={`text-center font-bold text-lg ${isYourTurn ? "text-green-300" : "text-yellow-300"}`}>
              {isYourTurn ? "Your Turn" : "Opponent's Turn"}
            </p>
          </div>

          {/* Game Board */}
          <div className="grid grid-cols-4 gap-3 mb-8 bg-white/10 p-6 rounded-lg backdrop-blur">
            {gameRoom.board.map((card, index) => (
              <button
                key={index}
                onClick={() => handleCardClick(index)}
                disabled={!isYourTurn || gameRoom.status === "completed"}
                className={`aspect-square rounded-lg font-bold text-2xl transition-all transform ${
                  matchedCards.has(index)
                    ? "bg-green-500 text-white scale-95"
                    : revealedCards.has(index)
                    ? "bg-yellow-400 text-white scale-110"
                    : "bg-gradient-to-br from-purple-400 to-pink-400 hover:scale-105 cursor-pointer"
                } ${!isYourTurn || gameRoom.status === "completed" ? "opacity-75" : ""}`}
              >
                {matchedCards.has(index) || revealedCards.has(index) ? card.card : "?"}
              </button>
            ))}
          </div>

          {/* Game Over */}
          {gameRoom.status === "completed" && (
            <Card className="p-6 text-center bg-white shadow-xl">
              <h2 className="text-2xl font-bold mb-4">
                {gameRoom.winner_id === userId ? "🎉 You Won!" : "😔 You Lost"}
              </h2>
              <p className="text-gray-600 mb-6">
                Final Score - You: {currentScore}, Opponent: {opponentScore}
              </p>
              <Button onClick={() => navigate({ to: "/" })} className="w-full">
                Back to Home
              </Button>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return null;
}
