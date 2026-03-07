export const runtime = "edge";

import { NextRequest } from "next/server";
import { getTokenPool } from "@/lib/token-pool";
import {
  getFormatPromptConfig,
  buildPreamblePrompt,
  buildSectionPrompt,
  formatReferencesAsTeX,
} from "@/lib/models";

interface ConvertRequest {
  text: string;
  sections: {
    title: string;
    abstract: string;
    body: string[];
    references: string;
  };
  formatId: string;
  isTeX: boolean;
}

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

export async function POST(req: NextRequest) {
  const body: ConvertRequest = await req.json();
  const { text, sections, formatId, isTeX } = body;

  if (isTeX) {
    return new Response(
      JSON.stringify({ latex: text, model: "passthrough", chunks: 0 }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const formatConfig = getFormatPromptConfig(formatId);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const pool = getTokenPool();
        const totalChunks = sections.body.length;
        const totalSteps = totalChunks + 1; // preamble + sections (closing is code-based now)
        let completedSteps = 0;

        sendSSE(controller, encoder, "status", {
          message: "Generating document preamble...",
          progress: 0,
          step: "preamble",
        });

        // Step 1: Generate preamble via LLM
        const preamblePrompt = buildPreamblePrompt(formatConfig);
        const preambleContent = [
          `Title: ${sections.title}`,
          sections.abstract ? `Abstract: ${sections.abstract}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        const preambleResult = await pool.callWithFallback(
          preambleContent,
          preamblePrompt
        );
        let preambleTeX = cleanLLMOutput(preambleResult.text);

        if (!preambleTeX.includes("\\begin{document}")) {
          preambleTeX += "\n\\begin{document}\n";
        }
        if (!preambleTeX.includes("\\maketitle")) {
          preambleTeX += "\\maketitle\n";
        }

        completedSteps++;
        sendSSE(controller, encoder, "chunk", {
          index: -1,
          latex: preambleTeX,
          model: preambleResult.model,
          progress: Math.round((completedSteps / totalSteps) * 100),
        });

        // Step 2: Process body sections in parallel batches
        const BATCH_SIZE = 5;
        const sectionResults: string[] = new Array(totalChunks).fill("");

        for (let batchStart = 0; batchStart < totalChunks; batchStart += BATCH_SIZE) {
          const batchEnd = Math.min(batchStart + BATCH_SIZE, totalChunks);
          const batchPromises: Promise<void>[] = [];

          for (let i = batchStart; i < batchEnd; i++) {
            const chunkText = sections.body[i];
            const systemPrompt = buildSectionPrompt(
              formatConfig,
              i,
              totalChunks
            );

            sendSSE(controller, encoder, "status", {
              message: `Converting section ${i + 1} of ${totalChunks}...`,
              progress: Math.round((completedSteps / totalSteps) * 100),
              step: "section",
              chunkIndex: i,
            });

            const promise = pool
              .callWithFallback(chunkText, systemPrompt)
              .then((result) => {
                sectionResults[i] = cleanLLMOutput(result.text);
                completedSteps++;

                sendSSE(controller, encoder, "chunk", {
                  index: i,
                  latex: sectionResults[i],
                  model: result.model,
                  progress: Math.round((completedSteps / totalSteps) * 100),
                });
              });

            batchPromises.push(promise);
          }

          await Promise.all(batchPromises);
        }

        // Step 3: References + closing — done in CODE, no LLM
        sendSSE(controller, encoder, "status", {
          message: "Formatting references...",
          progress: 95,
          step: "closing",
        });

        const closingTeX = formatReferencesAsTeX(sections.references);

        // Assemble final document
        const fullLatex = [
          preambleTeX,
          ...sectionResults,
          closingTeX,
        ].join("\n\n");

        sendSSE(controller, encoder, "complete", {
          latex: fullLatex,
          progress: 100,
          totalChunks,
          tokenStatus: pool.getStatus(),
        });

        controller.enqueue(encoder.encode("\n"));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        try {
          sendSSE(controller, encoder, "error", {
            message: `Conversion failed: ${message}`,
          });
          controller.enqueue(encoder.encode("\n"));
        } catch {
          // controller may already be closed
        }
        try {
          controller.close();
        } catch {
          // already closed
        }
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

function cleanLLMOutput(text: string): string {
  let cleaned = text.trim();
  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:latex|tex)?\s*\n?/i, "");
  cleaned = cleaned.replace(/\n?```\s*$/i, "");
  // Strip any trailing \end{document} that the LLM might add to section chunks
  cleaned = cleaned.replace(/\\end\{document\}\s*$/i, "");
  // Strip any leading preamble the LLM might re-add in section chunks
  cleaned = cleaned.replace(/^\\documentclass[\s\S]*?\\begin\{document\}/i, "");
  return cleaned.trim();
}
