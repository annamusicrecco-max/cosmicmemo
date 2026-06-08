import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Schema = z.object({
  humanName: z.string().max(20).optional(),
  message: z.string().min(1).max(120),
  history: z
    .array(z.object({ from: z.enum(["human", "ai"]), text: z.string().max(200) }))
    .max(10)
    .optional(),
  gameContext: z
    .object({ humanScore: z.number().int(), aiScore: z.number().int() })
    .optional(),
});

export const aiChatReply = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Schema.parse(i))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const sys = `You are a cheeky, friendly AI opponent in a Cosmic Memory card-matching game.
Reply to the human in ONE short conversational sentence (max 15 words). No emojis required, occasionally one is fine.
Stay playful, tease lightly about the score, never insult. Never write paragraphs.`;

    const historyText =
      (data.history || [])
        .slice(-6)
        .map((m) => `${m.from === "human" ? data.humanName || "Human" : "You (AI)"}: ${m.text}`)
        .join("\n") || "(start of chat)";

    const score = data.gameContext
      ? `Score — You(AI): ${data.gameContext.aiScore}, ${data.humanName || "Human"}: ${data.gameContext.humanScore}.`
      : "";

    try {
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system: sys,
        prompt: `${score}\nRecent chat:\n${historyText}\n\n${data.humanName || "Human"}: ${data.message}\nYou (AI):`,
      });
      const cleaned = text.trim().replace(/^["']|["']$/g, "").slice(0, 180);
      return { reply: cleaned || "🙂" };
    } catch (e) {
      console.error("aiChatReply error", e);
      return { reply: "Hm, my circuits glitched — your move!" };
    }
  });
