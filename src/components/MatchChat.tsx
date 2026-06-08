import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ChatMsg = { id: string; from: string; text: string; mine: boolean; at: number };

const QUICK = ["GG!", "Nice!", "Oof 😅", "Watch this", "Good luck", "👋"];

export function MatchChat({
  roomId,
  playerId,
  playerName,
  opponentName,
  disabled,
}: {
  roomId: string;
  playerId: string;
  playerName: string;
  opponentName: string;
  disabled?: boolean;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!roomId) return;
    const ch = supabase
      .channel(`chat:${roomId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "msg" }, (payload) => {
        const p = payload.payload as { from_id: string; from_name: string; text: string; at: number; id: string };
        if (p.from_id === playerId) return;
        setMsgs((m) =>
          [...m, { id: p.id, from: p.from_name || opponentName, text: p.text, mine: false, at: p.at }].slice(-50),
        );
      })
      .subscribe();
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [roomId, playerId, opponentName]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const send = async (textRaw: string) => {
    const text = textRaw.trim().slice(0, 160);
    if (!text || !channelRef.current) return;
    const msg = { id: crypto.randomUUID(), from: playerName, text, mine: true, at: Date.now() };
    setMsgs((m) => [...m, msg].slice(-50));
    setDraft("");
    try {
      await channelRef.current.send({
        type: "broadcast",
        event: "msg",
        payload: { id: msg.id, from_id: playerId, from_name: playerName, text, at: msg.at },
      });
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mx-auto w-full max-w-[min(92vw,640px)] px-3 pb-6">
      <div className="glass rounded-2xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-widest text-accent font-bold">💬 Chat</span>
          <span className="text-[10px] text-muted-foreground">Ephemeral · clears when you leave</span>
        </div>
        <div
          ref={scrollRef}
          className="h-32 sm:h-36 overflow-y-auto rounded-xl px-2 py-2 mb-2 space-y-1.5 text-sm"
          style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {msgs.length === 0 ? (
            <div className="text-[11px] text-muted-foreground text-center pt-2">Say hi to {opponentName}!</div>
          ) : (
            msgs.map((m) => (
              <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[78%] rounded-2xl px-3 py-1.5 text-[13px] leading-snug break-words"
                  style={
                    m.mine
                      ? { background: "linear-gradient(135deg,#a855f7,#ec4899)", color: "#fff" }
                      : { background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.12)" }
                  }
                >
                  {!m.mine && <div className="text-[10px] opacity-70 mb-0.5">{m.from}</div>}
                  {m.text}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={disabled}
              className="text-[11px] px-2 py-1 rounded-full bg-white/8 hover:bg-white/15 border border-white/10 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); send(draft); }}
          className="flex gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 160))}
            placeholder="Type a short message…"
            disabled={disabled}
            className="flex-1 min-w-0 px-3 py-2 rounded-full bg-background/40 border border-white/15 focus:outline-none focus:border-accent text-sm"
            maxLength={160}
          />
          <button
            type="submit"
            disabled={disabled || !draft.trim()}
            className="px-4 py-2 rounded-full font-bold text-sm text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#22d3ee,#a855f7)" }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
