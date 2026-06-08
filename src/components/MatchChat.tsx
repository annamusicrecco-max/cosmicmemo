import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { aiChatReply } from "@/lib/chat-ai.functions";
import { loadState } from "@/lib/game-state";
import { Link } from "@tanstack/react-router";

type Msg = { id: string; from: "me" | "them"; name: string; text: string; at: number };

type Props =
  | {
      mode: "online";
      roomId: string;
      playerId: string;
      playerName: string;
      opponentName: string;
    }
  | {
      mode: "ai";
      playerName: string;
      gameContext?: { humanScore: number; aiScore: number };
    };

const MAX_LEN = 80;
const SEND_COOLDOWN_MS = 1200;

export function MatchChat(props: Props) {
  const [premium, setPremium] = useState(false);
  useEffect(() => { setPremium(loadState().premium); }, []);

  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const lastSentRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const callAi = useServerFn(aiChatReply);

  // Online: subscribe to broadcast channel (ephemeral, no DB).
  useEffect(() => {
    if (props.mode !== "online" || !premium) return;
    const ch = supabase.channel(`chat:${props.roomId}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "msg" }, (payload) => {
      const p = payload.payload as { from_id: string; name: string; text: string };
      if (p.from_id === props.playerId) return;
      const m: Msg = {
        id: `${Date.now()}_${Math.random()}`,
        from: "them",
        name: p.name?.slice(0, 20) || "Opponent",
        text: String(p.text || "").slice(0, MAX_LEN),
        at: Date.now(),
      };
      setMsgs((prev) => [...prev.slice(-49), m]);
      if (!open) setUnread((u) => u + 1);
    });
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [props, premium, open]);

  useEffect(() => {
    if (open) setUnread(0);
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [open, msgs]);

  const presets = useMemo(
    () => ["GG!", "Nice match 👏", "Oh that hurt 😅", "My turn!", "Lucky!", "Watch this…"],
    [],
  );

  const channelSend = async (text: string) => {
    if (props.mode !== "online") return;
    const ch = supabase.channel(`chat:${props.roomId}`);
    // Re-use a transient channel to send (simpler than tracking ref).
    await ch.subscribe();
    await ch.send({
      type: "broadcast",
      event: "msg",
      payload: { from_id: props.playerId, name: props.playerName, text },
    });
    supabase.removeChannel(ch);
  };

  const send = async (raw: string) => {
    const text = raw.trim().slice(0, MAX_LEN);
    if (!text) return;
    const now = Date.now();
    if (now - lastSentRef.current < SEND_COOLDOWN_MS) return;
    lastSentRef.current = now;

    const myMsg: Msg = {
      id: `${now}_me`,
      from: "me",
      name: props.playerName,
      text,
      at: now,
    };
    setMsgs((prev) => [...prev.slice(-49), myMsg]);
    setInput("");

    if (props.mode === "online") {
      try { await channelSend(text); } catch { /* silent */ }
      return;
    }

    // AI mode
    setSending(true);
    try {
      const history = msgs.slice(-6).map((m) => ({
        from: (m.from === "me" ? "human" : "ai") as "human" | "ai",
        text: m.text,
      }));
      const res = await callAi({
        data: {
          humanName: props.playerName,
          message: text,
          history,
          gameContext: props.gameContext,
        },
      });
      const reply: Msg = {
        id: `${Date.now()}_ai`,
        from: "them",
        name: "AI 🧠",
        text: res.reply.slice(0, 180),
        at: Date.now(),
      };
      setMsgs((prev) => [...prev.slice(-49), reply]);
      if (!open) setUnread((u) => u + 1);
    } catch {
      /* silent */
    } finally {
      setSending(false);
    }
  };

  if (!premium) {
    return (
      <Link
        to="/premium"
        className="fixed bottom-4 right-4 z-30 rounded-full px-3 py-2 text-xs font-bold glass shadow-lg"
        title="Premium feature"
      >
        💬 Chat ✨
      </Link>
    );
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-30 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-lg"
          style={{
            background: "linear-gradient(135deg,#a855f7,#ec4899)",
            boxShadow: "0 8px 24px rgba(236,72,153,0.45)",
          }}
          aria-label="Open chat"
        >
          💬 Chat{unread > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-white text-pink-600 text-[11px]">
              {unread}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-80 z-40 glass rounded-2xl overflow-hidden border border-white/15 flex flex-col pop-in"
          style={{ maxHeight: "60vh", background: "rgba(20,12,40,0.85)", backdropFilter: "blur(14px)" }}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <div className="text-xs font-bold">
              💬 {props.mode === "ai" ? "Chat with AI 🧠" : `Chat · ${(props as { opponentName?: string }).opponentName || "Opponent"}`}
            </div>
            <button onClick={() => setOpen(false)} className="text-xs opacity-70 hover:opacity-100">✕</button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 text-sm" style={{ minHeight: 140 }}>
            {msgs.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-4">
                Say hi! Messages disappear when the match ends.
              </p>
            )}
            {msgs.map((m) => (
              <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                <div
                  className="rounded-2xl px-3 py-1.5 max-w-[80%] text-[13px] leading-snug"
                  style={
                    m.from === "me"
                      ? { background: "linear-gradient(135deg,#a855f7,#ec4899)", color: "#fff" }
                      : { background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.12)" }
                  }
                >
                  <div className="text-[10px] opacity-70 mb-0.5">{m.name}</div>
                  {m.text}
                </div>
              </div>
            ))}
            {sending && props.mode === "ai" && (
              <div className="text-[11px] text-muted-foreground italic">AI is typing…</div>
            )}
          </div>

          <div className="px-2 pt-1 pb-2 border-t border-white/10">
            <div className="flex gap-1 overflow-x-auto pb-1.5 no-scrollbar">
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/10"
                >
                  {p}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex gap-1.5"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, MAX_LEN))}
                placeholder="Short message…"
                maxLength={MAX_LEN}
                className="flex-1 px-3 py-2 rounded-full bg-background/40 border border-white/15 focus:outline-none focus:border-accent text-sm"
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="rounded-full px-4 text-sm font-bold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#a855f7,#ec4899)" }}
              >
                ➤
              </button>
            </form>
            <p className="text-[10px] text-muted-foreground text-center mt-1">
              {input.length}/{MAX_LEN} · Ephemeral — not stored
            </p>
          </div>
        </div>
      )}
    </>
  );
}
