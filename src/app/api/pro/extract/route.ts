export const runtime = "edge";

import { NextRequest } from "next/server";
import { getTokenPool } from "@/lib/token-pool";
import {
  FEATURE_EXTRACTION_SYSTEM_PROMPT,
  buildExtractionPrompt,
} from "@/lib/pro/llm-prompts";
import type { DocumentFeatures } from "@/lib/pro/types";

function sendSSE(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  event: string,
  data: Record<string, unknown>
) {
  controller.enqueue(
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  );
}

function repairTruncatedJSON(raw: string): string {
  let s = raw.trim();

  const fenceStart = s.indexOf("```");
  if (fenceStart !== -1) {
    const afterFence = s.indexOf("\n", fenceStart);
    const fenceEnd = s.lastIndexOf("```");
    if (afterFence !== -1 && fenceEnd > afterFence) {
      s = s.slice(afterFence + 1, fenceEnd).trim();
    } else if (afterFence !== -1) {
      s = s.slice(afterFence + 1).trim();
    }
  }

  const firstBrace = s.indexOf("{");
  if (firstBrace > 0) s = s.slice(firstBrace);
  if (!s.startsWith("{")) s = "{" + s;

  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") openBraces++;
    if (ch === "}") openBraces--;
    if (ch === "[") openBrackets++;
    if (ch === "]") openBrackets--;
  }

  if (inString) s += '"';

  const lastGoodChar = s.slice(-1);
  if (lastGoodChar !== "}" && lastGoodChar !== "]" && lastGoodChar !== '"' &&
      lastGoodChar !== "," && !/\d/.test(lastGoodChar)) {
    const lastComma = Math.max(s.lastIndexOf(","), s.lastIndexOf('"'));
    if (lastComma > s.length * 0.5) {
      s = s.slice(0, lastComma + 1);
    }
  }

  if (s.endsWith(",")) {
    s = s.slice(0, -1);
  }

  while (openBrackets > 0) { s += "]"; openBrackets--; }
  while (openBraces > 0) { s += "}"; openBraces--; }

  return s;
}

function buildFallbackFeatures(text: string): DocumentFeatures {
  const lines = text.split(/\n/).filter(Boolean);

  let title = "Untitled Document";
  for (const line of lines.slice(0, 10)) {
    const trimmed = line.trim();
    if (trimmed.length > 10 && trimmed.length < 200 && !trimmed.startsWith("http")) {
      title = trimmed;
      break;
    }
  }

  const sections: DocumentFeatures["sections"] = [];
  const headingPattern = /^(?:\d+\.?\s+|[IVX]+\.\s+)?([A-Z][A-Za-z\s]+)/;
  let currentSection: DocumentFeatures["sections"][0] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const headingMatch = trimmed.match(headingPattern);
    if (headingMatch && trimmed.length < 80 && trimmed === trimmed.replace(/[.!?]$/, "")) {
      if (currentSection) sections.push(currentSection);
      currentSection = {
        level: 1,
        heading: headingMatch[1].trim(),
        content: "",
        figures: [],
        tables: [],
        equations: [],
      };
    } else if (currentSection) {
      if (!currentSection.content) {
        currentSection.content = trimmed.slice(0, 300);
      }
    }
  }
  if (currentSection) sections.push(currentSection);

  if (sections.length === 0) {
    sections.push({
      level: 1,
      heading: "Content",
      content: text.slice(0, 500),
      figures: [],
      tables: [],
      equations: [],
    });
  }

  return {
    title,
    authors: [],
    abstract: "",
    keywords: [],
    sections,
    references: [],
    metadata: { paperType: "research", field: "General" },
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { text, imageCount, tableCount, equationCount } = body as {
    text: string;
    imageCount: number;
    tableCount: number;
    equationCount: number;
  };

  if (!text) {
    return new Response(JSON.stringify({ error: "No text provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const pool = getTokenPool();

        sendSSE(controller, encoder, "status", {
          message: "Analyzing document structure with AI...",
          progress: 10,
        });

        const userPrompt = buildExtractionPrompt(
          text,
          imageCount || 0,
          tableCount || 0,
          equationCount || 0
        );

        sendSSE(controller, encoder, "status", {
          message: "Extracting features...",
          progress: 30,
        });

        const PRO_MODEL = {
          id: "Qwen/Qwen2.5-72B-Instruct",
          name: "Qwen 72B",
          maxNewTokens: 8192,
        };

        const result = await pool.callWithFallback(
          userPrompt,
          FEATURE_EXTRACTION_SYSTEM_PROMPT,
          PRO_MODEL
        );

        sendSSE(controller, encoder, "status", {
          message: "Parsing AI response...",
          progress: 70,
        });

        let features: DocumentFeatures;
        let usedFallback = false;

        try {
          const repaired = repairTruncatedJSON(result.text);
          features = JSON.parse(repaired) as DocumentFeatures;
        } catch {
          try {
            const jsonMatch = result.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const repaired = repairTruncatedJSON(jsonMatch[0]);
              features = JSON.parse(repaired) as DocumentFeatures;
            } else {
              throw new Error("No JSON found");
            }
          } catch {
            console.warn("[Pro Extract] JSON parse failed, using fallback extraction");
            features = buildFallbackFeatures(text);
            usedFallback = true;
          }
        }

        if (!features.title) features.title = "Untitled Document";
        if (!features.sections) features.sections = [];
        if (!features.authors) features.authors = [];
        if (!features.references) features.references = [];
        if (!features.keywords) features.keywords = [];
        if (!features.abstract) features.abstract = "";
        if (!features.metadata) features.metadata = { paperType: "research", field: "General" };

        sendSSE(controller, encoder, "status", {
          message: usedFallback
            ? "Feature extraction complete (used fallback parser)"
            : "Feature extraction complete",
          progress: 90,
        });

        sendSSE(controller, encoder, "complete", {
          features,
          model: usedFallback ? "Fallback Parser" : result.model,
          progress: 100,
        });

        controller.enqueue(encoder.encode("\n"));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        sendSSE(controller, encoder, "error", {
          message: `Feature extraction failed: ${message}`,
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
