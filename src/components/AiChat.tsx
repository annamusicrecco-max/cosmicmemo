import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { aiChatReply } from "@/lib/ai-chat.functions";

type Msg = { id: string; role: "user" | "ai"; text: string };

const QUICK = ["Good luck!", "Nice move", "You got lucky", "GG", "I'll catch up"];

export function AiChat({
  humanName,
  humanScore,
  aiScore,
}: {
  humanName: string;
  humanScore: number;
  aiScore: number;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const reply = useServerFn(aiChatReply);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, thinking]);

  const send = async (textRaw: string) => {
    const text = textRaw.trim().slice(0, 240);
    if (!text || thinking) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text };
    const next = [...msgs, userMsg].slice(-30);
    setMsgs(next);
    setDraft("");
    setThinking(true);
    try {
      const res = await reply({
        data: {
          humanName,
          humanScore,
          aiScore,
          history: next.slice(-10).map((m) => ({ role: m.role, text: m.text })),
          message: text,
        },
      });
      setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "ai", text: res.reply }].slice(-30));
    } catch {
      setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "ai", text: "..." }].slice(-30));
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[min(92vw,640px)] px-3 pb-6">
      <div className="glass rounded-2xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-widest text-accent font-bold">💬 Talk to the AI</span>
          <span className="text-[10px] text-muted-foreground">Ephemeral · clears on exit</span>
        </div>
        <div
          ref={scrollRef}
          className="h-32 sm:h-36 overflow-y-auto rounded-xl px-2 py-2 mb-2 space-y-1.5 text-sm"
          style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {msgs.length === 0 && !thinking ? (
            <div className="text-[11px] text-muted-foreground text-center pt-2">Trash-talk or strategize — the AI replies short.</div>
          ) : (
            msgs.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[78%] rounded-2xl px-3 py-1.5 text-[13px] leading-snug break-words"
                  style={
                    m.role === "user"
                      ? { background: "linear-gradient(135deg,#a855f7,#ec4899)", color: "#fff" }
                      : { background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.12)" }
                  }
                >
                  {m.role === "ai" && <div className="text-[10px] opacity-70 mb-0.5">AI 🧠</div>}
                  {m.text}
                </div>
              </div>
            ))
          )}
          {thinking && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-3 py-1.5 text-[12px] italic opacity-70"
                style={{ background: "rgba(255,255,255,0.08)" }}>
                AI is typing…
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={thinking}
              className="text-[11px] px-2 py-1 rounded-full bg-white/8 hover:bg-white/15 border border-white/10 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(draft); }} className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 240))}
            placeholder="Say something to the AI…"
            disabled={thinking}
            className="flex-1 min-w-0 px-3 py-2 rounded-full bg-background/40 border border-white/15 focus:outline-none focus:border-accent text-sm"
            maxLength={240}
          />
          <button
            type="submit"
            disabled={thinking || !draft.trim()}
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
