export const runtime = "edge";

import { NextRequest } from "next/server";

const TEXLIVE_URL = "https://texlive.net/cgi-bin/latexcgi";

export async function POST(req: NextRequest) {
  try {
    const { latex, engine } = (await req.json()) as {
      latex: string;
      engine?: string;
    };

    if (!latex) {
      return new Response(JSON.stringify({ error: "No LaTeX provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const texEngine = engine || "pdflatex";

    const formData = new FormData();
    formData.append("filecontents[]", latex);
    formData.append("filename[]", "document.tex");
    formData.append("engine", texEngine);
    formData.append("return", "pdf");

    const response = await fetch(TEXLIVE_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({
          error: "LaTeX compilation failed",
          log: errorText.slice(0, 5000),
        }),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/pdf")) {
      const pdfBuffer = await response.arrayBuffer();
      return new Response(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="output.pdf"',
        },
      });
    }

    const text = await response.text();

    if (text.startsWith("%PDF")) {
      const encoder = new TextEncoder();
      return new Response(encoder.encode(text), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="output.pdf"',
        },
      });
    }

    const errorMatch = text.match(/^!(.*?)$/gm);
    const errorSummary = errorMatch
      ? errorMatch.join("\n")
      : text.slice(-3000);

    return new Response(
      JSON.stringify({
        error: "Compilation produced errors",
        log: errorSummary.slice(0, 5000),
      }),
      {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[Pro Compile Error]", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Compilation failed",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
