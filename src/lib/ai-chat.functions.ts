import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const InputSchema = z.object({
  humanName: z.string().max(20).optional(),
  humanScore: z.number().int(),
  aiScore: z.number().int(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "ai"]),
        text: z.string().max(300),
      }),
    )
    .max(20),
  message: z.string().min(1).max(300),
});

export const aiChatReply = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);

    const transcript = data.history
      .map((m) => `${m.role === "user" ? data.humanName || "Player" : "AI"}: ${m.text}`)
      .join("\n");

    const prompt = `You are a witty, friendly cosmic AI opponent in a memory-card game.
Reply with ONE short sentence (max 18 words). Be playful, tease lightly, react to the score, never insult.
Avoid emojis unless they really land. Never use markdown.

Score — You(AI): ${data.aiScore}, ${data.humanName || "Player"}: ${data.humanScore}

Recent chat:
${transcript || "(empty)"}

${data.humanName || "Player"}: ${data.message}
AI:`;

    try {
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        prompt,
      });
      const reply = (text || "").trim().split("\n")[0].slice(0, 240);
      return { reply: reply || "..." };
    } catch (err) {
      console.error("aiChatReply error", err);
      return { reply: "My circuits glitched — your move 🌌" };
    }
  });
