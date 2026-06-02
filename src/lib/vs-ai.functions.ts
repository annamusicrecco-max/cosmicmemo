import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

// Card representation shared with the client.
// emoji is null when the card is currently face-down AND has never been seen.
// emoji is set when the card was previously revealed (memory) or is currently face-up.
export type AIBoardCard = {
  pos: number;
  emoji: string | null; // null = unknown to the AI
  matched: boolean;
};

const InputSchema = z.object({
  board: z.array(
    z.object({
      pos: z.number().int(),
      emoji: z.string().nullable(),
      matched: z.boolean(),
    }),
  ),
  humanScore: z.number().int(),
  aiScore: z.number().int(),
  humanName: z.string().max(20).optional(),
  turnHistory: z
    .array(
      z.object({
        actor: z.enum(["human", "ai"]),
        a: z.number().int(),
        b: z.number().int(),
        emojiA: z.string(),
        emojiB: z.string(),
        match: z.boolean(),
      }),
    )
    .max(60),
});

export const pickAiMove = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const available = data.board.filter((c) => !c.matched).map((c) => c.pos);
    if (available.length < 2) {
      return { first: available[0] ?? 0, second: available[1] ?? 0, reasoning: "fallback" };
    }

    const knownPairs: Record<string, number[]> = {};
    for (const c of data.board) {
      if (!c.matched && c.emoji) {
        (knownPairs[c.emoji] ||= []).push(c.pos);
      }
    }

    const gateway = createLovableAiGatewayProvider(key);

    const boardDescription = data.board
      .map((c) => `pos ${c.pos}: ${c.matched ? "MATCHED" : c.emoji ? `known=${c.emoji}` : "unknown"}`)
      .join("\n");

    const historyDescription =
      data.turnHistory.length === 0
        ? "(no turns yet)"
        : data.turnHistory
            .slice(-20)
            .map(
              (t, i) =>
                `${i + 1}. ${t.actor} flipped pos ${t.a} (${t.emojiA}) & pos ${t.b} (${t.emojiB}) — ${t.match ? "MATCH" : "miss"}`,
            )
            .join("\n");

    const knownDescription = Object.entries(knownPairs)
      .map(([e, ps]) => `${e}: positions [${ps.join(", ")}]`)
      .join("\n") || "(none revealed yet)";

    const prompt = `You are playing a memory card matching game against a human (${data.humanName || "Opponent"}). It is YOUR turn.
You must pick TWO different face-down, unmatched card positions to flip.
If you remember a guaranteed pair from history, ALWAYS take it.
Otherwise, prefer flipping cards whose emojis are still unknown (to gather new information) rather than re-flipping known singletons that have no known match yet.
Avoid picking two unrelated known cards if no pair is guaranteed — exploration is better than wasted turns.

Score — You: ${data.aiScore}, ${data.humanName || "Human"}: ${data.humanScore}

Board state (16 cards):
${boardDescription}

Already-revealed cards (your memory, deduced from all turns so far):
${knownDescription}

Recent turn history:
${historyDescription}

Available unmatched positions: [${available.join(", ")}]

Respond with two distinct positions from the available list and a brief reasoning.`;

    try {
      const { experimental_output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        prompt,
        experimental_output: Output.object({
          schema: z.object({
            first: z.number().int(),
            second: z.number().int(),
            reasoning: z.string().max(200),
          }),
        }),
      });

      let { first, second, reasoning } = experimental_output;
      const valid = new Set(available);
      if (!valid.has(first) || !valid.has(second) || first === second) {
        // Fallback: smart local choice
        const pair = Object.values(knownPairs).find((ps) => ps.length >= 2);
        if (pair) {
          first = pair[0];
          second = pair[1];
          reasoning = "fallback: known pair";
        } else {
          const shuffled = [...available].sort(() => Math.random() - 0.5);
          first = shuffled[0];
          second = shuffled[1];
          reasoning = "fallback: random";
        }
      }
      return { first, second, reasoning };
    } catch (err) {
      console.error("pickAiMove error", err);
      const pair = Object.values(knownPairs).find((ps) => ps.length >= 2);
      if (pair) return { first: pair[0], second: pair[1], reasoning: "error fallback: known pair" };
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      return { first: shuffled[0], second: shuffled[1], reasoning: "error fallback: random" };
    }
  });
