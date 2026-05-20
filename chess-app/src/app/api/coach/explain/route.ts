import { NextResponse, type NextRequest } from "next/server";

/**
 * POST /api/coach/explain
 * Body: { fenBefore, san, evalDropCp, severity, color, bestMoveSan? }
 * Returns: { explanation: string }
 *
 * Phase B: returns a deterministic placeholder so the UI can ship end-to-end
 * without an LLM key. Phase C replaces this with a real Gemini call.
 */

type ExplainInput = {
  fenBefore?: string;
  san?: string;
  evalDropCp?: number;
  severity?: "inaccuracy" | "mistake" | "blunder";
  color?: "w" | "b";
  bestMoveSan?: string | null;
};

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

  const severity = body.severity ?? "inaccuracy";
  const side = body.color === "b" ? "Black" : "White";
  const cp = Math.round(body.evalDropCp);
  const cpStr = cp >= 100 ? `${(cp / 100).toFixed(1)} pawns` : `${cp} cp`;

  const headline =
    severity === "blunder"
      ? `${side}'s ${body.san} is a blunder — eval drops by ${cpStr}.`
      : severity === "mistake"
        ? `${side}'s ${body.san} is a mistake — eval drops by ${cpStr}.`
        : `${side}'s ${body.san} is an inaccuracy — eval drops by ${cpStr}.`;

  // Deterministic placeholder; replaced by Gemini in Phase C.
  const explanation =
    `${headline} ` +
    `Coach (placeholder): the better move would have preserved material or kept ` +
    `the attacking line alive. Once we wire up the LLM, this line becomes a real, ` +
    `interview-prep-flavoured explanation.`;

  return NextResponse.json({ explanation });
}
