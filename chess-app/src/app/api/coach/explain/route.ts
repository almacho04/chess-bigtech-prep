import { NextResponse, type NextRequest } from "next/server";

/**
 * POST /api/coach/explain
 * Body: { fenBefore, san, evalDropCp, severity, color, bestMoveSan? }
 * Returns: { explanation: string, source: "gemini" | "placeholder" }
 *
 * Calls Google Gemini 2.5 Flash via REST. Falls back to a deterministic
 * placeholder if the API key is missing or the upstream call fails — so the
 * coach panel always renders something.
 */

type ExplainInput = {
  fenBefore?: string;
  san?: string;
  evalDropCp?: number;
  severity?: "inaccuracy" | "mistake" | "blunder";
  color?: "w" | "b";
  bestMoveSan?: string | null;
};

const SYSTEM_PROMPT = `You are a chess coach for engineers preparing for BigTech interviews.

You receive: a FEN, the move played (in SAN), how many centipawns the eval dropped, and the severity label.

Respond in 2–3 short sentences, total under 60 words. Cover:
(a) what was wrong with the move played — be concrete about the tactical or positional cost;
(b) the principle the player missed (a recurring chess pattern, e.g. "unprotected piece on an open file", "back-rank weakness");
(c) one tight analogy to a coding-interview habit (e.g. "missing a side effect in recursion", "off-by-one in a sliding window", "not pruning an obviously-dead branch").

Tone: direct, peer-to-peer, never condescending. No emojis. No headings or bullet points — flowing prose only. Do not reveal you are an AI.`;

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export async function POST(request: NextRequest) {
  let body: ExplainInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!body.san || typeof body.evalDropCp !== "number") {
    return NextResponse.json(
      { error: "missing required fields: san, evalDropCp" },
      { status: 400 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      explanation: placeholderExplanation(body),
      source: "placeholder" as const,
    });
  }

  const userText = formatUserMessage(body);

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 600,
          // Gemini 2.5 Flash defaults to dynamic "thinking" which eats the
          // output budget. We want a short flat explanation, not chain-of-
          // thought reasoning — set thinkingBudget=0 to disable it.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[/api/coach/explain] Gemini HTTP", res.status, errText);
      return NextResponse.json({
        explanation: placeholderExplanation(body),
        source: "placeholder" as const,
        upstreamStatus: res.status,
      });
    }

    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();

    if (!text) {
      return NextResponse.json({
        explanation: placeholderExplanation(body),
        source: "placeholder" as const,
      });
    }

    return NextResponse.json({
      explanation: text,
      source: "gemini" as const,
    });
  } catch (err) {
    console.error("[/api/coach/explain] fetch failed", err);
    return NextResponse.json({
      explanation: placeholderExplanation(body),
      source: "placeholder" as const,
    });
  }
}

type GeminiResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
  }[];
};

function formatUserMessage(b: ExplainInput): string {
  const side = b.color === "b" ? "Black" : "White";
  const cp = Math.round(b.evalDropCp ?? 0);
  const bestLine = b.bestMoveSan
    ? `Best move was ${b.bestMoveSan}.`
    : "(Best move not provided — infer it from the position.)";
  return [
    `Position FEN: ${b.fenBefore ?? "(unknown)"}`,
    `${side} played ${b.san}, classified as a ${b.severity ?? "mistake"}.`,
    `Eval dropped by ${cp} centipawns from ${side}'s perspective.`,
    bestLine,
  ].join("\n");
}

function placeholderExplanation(b: ExplainInput): string {
  const side = b.color === "b" ? "Black" : "White";
  const cp = Math.round(b.evalDropCp ?? 0);
  const cpStr = cp >= 100 ? `${(cp / 100).toFixed(1)} pawns` : `${cp} cp`;
  const severity = b.severity ?? "mistake";
  return (
    `${side}'s ${b.san} is a ${severity} — eval dropped by ${cpStr}. ` +
    `(Coach unavailable; set GEMINI_API_KEY to get a natural-language ` +
    `explanation here.)`
  );
}
