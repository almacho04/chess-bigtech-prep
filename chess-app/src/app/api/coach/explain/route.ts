import { NextResponse, type NextRequest } from "next/server";

/**
 * POST /api/coach/explain
 * Body: { fenBefore, san, evalDropCp, severity, color, bestMoveSan? }
 * Returns: { explanation, source: "gemini" | "placeholder", reason?: string }
 *
 * Calls Google Gemini 2.5 Flash via REST. Falls back to a deterministic
 * placeholder if anything goes wrong — and surfaces the reason so the UI can
 * show "rate-limited, try again" vs "key missing" vs "unknown error".
 */

type ExplainInput = {
  fenBefore?: string;
  san?: string;
  evalDropCp?: number;
  severity?: "inaccuracy" | "mistake" | "blunder";
  color?: "w" | "b";
  bestMoveSan?: string | null;
};

type PlaceholderReason =
  | "missing_key"
  | "rate_limit"
  | "upstream_error"
  | "empty_response"
  | "fetch_failed";

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
  if (!apiKey) return placeholder(body, "missing_key");

  const userText = formatUserMessage(body);

  let res: Response;
  try {
    res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 600,
          // Disable Gemini 2.5 Flash's default chain-of-thought "thinking" —
          // it eats the output budget and truncates short answers.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
  } catch (err) {
    console.error("[/api/coach/explain] fetch threw", err);
    return placeholder(body, "fetch_failed");
  }

  if (res.status === 429) {
    return placeholder(body, "rate_limit");
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(
      "[/api/coach/explain] Gemini HTTP",
      res.status,
      errText.slice(0, 300),
    );
    return placeholder(body, "upstream_error");
  }

  let data: GeminiResponse;
  try {
    data = (await res.json()) as GeminiResponse;
  } catch {
    return placeholder(body, "upstream_error");
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();

  if (!text) {
    console.warn(
      "[/api/coach/explain] empty Gemini response, finishReason=",
      data.candidates?.[0]?.finishReason,
    );
    return placeholder(body, "empty_response");
  }

  return NextResponse.json({
    explanation: text,
    source: "gemini" as const,
  });
}

type GeminiResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
};

function placeholder(b: ExplainInput, reason: PlaceholderReason) {
  return NextResponse.json({
    explanation: placeholderExplanation(b, reason),
    source: "placeholder" as const,
    reason,
  });
}

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

function placeholderExplanation(
  b: ExplainInput,
  reason: PlaceholderReason,
): string {
  const side = b.color === "b" ? "Black" : "White";
  const severity = b.severity ?? "mistake";
  const numericDrop = ((b.evalDropCp ?? 0) / 100).toFixed(1);
  const head = `${side}'s ${b.san} is a ${severity} (eval drop ≈ ${numericDrop}).`;

  switch (reason) {
    case "missing_key":
      return `${head} (Coach unavailable — server-side GEMINI_API_KEY is not configured.)`;
    case "rate_limit":
      return `${head} (Coach rate-limited by Gemini's free tier — wait ~30 s and click Retry.)`;
    case "upstream_error":
      return `${head} (Coach upstream returned an error — click Retry.)`;
    case "empty_response":
      return `${head} (Coach returned no text for this position — click Retry, sometimes a re-roll helps.)`;
    case "fetch_failed":
      return `${head} (Coach request failed to reach the server — check your network and Retry.)`;
  }
}
