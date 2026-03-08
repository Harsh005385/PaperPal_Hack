"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Download,
  Eye,
  Code,
  Columns2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  Copy,
  Check,
  AlertCircle,
  Cpu,
  Loader2,
  Crown,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { FORMAT_OPTIONS } from "@/lib/constants";
import { generateLaTeX } from "@/lib/pro/latex-generators";
import type {
  DocumentFeatures,
  ExtractedPDF,
  FormatId,
} from "@/lib/pro/types";

function findHeadingInText(text: string, heading: string, fromIndex: number = 0): number {
  const variants = [
    heading,
    heading.toUpperCase(),
    heading.toLowerCase(),
    heading.replace(/\s+/g, " ").trim(),
    heading.toUpperCase().replace(/\s+/g, " ").trim(),
  ];

  for (const v of variants) {
    const idx = text.indexOf(v, fromIndex);
    if (idx !== -1) return idx;
  }

  const numberPrefixed = [
    new RegExp(`\\d+\\.?\\s*${escapeRegex(heading)}`, "i"),
    new RegExp(`[IVX]+\\.\\s*${escapeRegex(heading)}`, "i"),
  ];
  for (const rx of numberPrefixed) {
    const m = rx.exec(text.slice(fromIndex));
    if (m) return fromIndex + m.index;
  }

  return -1;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function enrichSectionsWithFullText(
  features: DocumentFeatures,
  extracted: ExtractedPDF
): DocumentFeatures {
  if (!features.sections || features.sections.length === 0) return features;

  const fullText = extracted.text || extracted.pages?.map((p) => p.text).join("\n\n") || "";
  if (!fullText || fullText.length < 50) return features;

  const enriched = { ...features, sections: [...features.sections] };

  const headingPositions: { idx: number; sectionIndex: number }[] = [];
  let searchFrom = 0;
  for (let i = 0; i < enriched.sections.length; i++) {
    const heading = enriched.sections[i].heading;
    if (!heading) continue;
    const pos = findHeadingInText(fullText, heading, searchFrom);
    if (pos !== -1) {
      headingPositions.push({ idx: pos, sectionIndex: i });
      searchFrom = pos + heading.length;
    }
  }

  for (let h = 0; h < headingPositions.length; h++) {
    const { idx: headingStart, sectionIndex } = headingPositions[h];
    const heading = enriched.sections[sectionIndex].heading;

    const contentStart = headingStart + heading.length;

    let contentEnd = fullText.length;
    if (h + 1 < headingPositions.length) {
      contentEnd = headingPositions[h + 1].idx;
    }

    const refStart = fullText.toLowerCase().indexOf("references", contentStart);
    const bibStart = fullText.toLowerCase().indexOf("bibliography", contentStart);
    const stopPoints = [refStart, bibStart].filter((x) => x !== -1 && x < contentEnd);
    if (stopPoints.length > 0) {
      contentEnd = Math.min(contentEnd, ...stopPoints);
    }

    let extractedContent = fullText.slice(contentStart, contentEnd).trim();

    extractedContent = extractedContent
      .replace(/^\s*[.:]\s*/, "")
      .trim();

    if (extractedContent.length > 20) {
      enriched.sections[sectionIndex] = {
        ...enriched.sections[sectionIndex],
        content: extractedContent,
      };
    }
  }

  if (enriched.abstract.length < 100) {
    const absStart = findHeadingInText(fullText, "Abstract");
    if (absStart !== -1) {
      const absContentStart = absStart + "Abstract".length;
      let absEnd = fullText.length;

      const firstSectionPos = headingPositions.length > 0 ? headingPositions[0].idx : fullText.length;
      const introPos = findHeadingInText(fullText, "Introduction");
      const kwPos = findHeadingInText(fullText, "Keywords");
      const candidates = [firstSectionPos, introPos, kwPos].filter((x) => x > absContentStart);
      if (candidates.length > 0) absEnd = Math.min(...candidates);

      const absText = fullText.slice(absContentStart, absEnd).replace(/^\s*[.:]\s*/, "").trim();
      if (absText.length > enriched.abstract.length) {
        enriched.abstract = absText;
      }
    }
  }

  return enriched;
}

export default function ProEditorPage() {
  const searchParams = useSearchParams();
  const formatId = (searchParams.get("format") || "ieee") as FormatId;
  const format =
    FORMAT_OPTIONS.find((f) => f.id === formatId) || FORMAT_OPTIONS[5];

  const [viewMode, setViewMode] = useState<"split" | "code" | "preview">(
    "split"
  );
  const [zoom, setZoom] = useState(100);
  const [texCode, setTexCode] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [extractedImages, setExtractedImages] = useState<
    { id: string; dataUrl: string }[]
  >([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("paperpal_pro");
    if (!raw) {
      setIsGenerating(false);
      setError(
        "No document data found. Please go back and upload a PDF."
      );
      return;
    }

    try {
      const { features, extracted } = JSON.parse(raw) as {
        features: DocumentFeatures;
        extracted: ExtractedPDF;
        format: string;
      };

      setProgress("Enriching sections with full text...");
      setActiveModel("Rule-Based Generator");

      const enrichedFeatures = enrichSectionsWithFullText(features, extracted);

      const imgs = (extracted.images || []).filter(
        (img) => img.dataUrl && img.dataUrl.startsWith("data:")
      );
      setExtractedImages(
        imgs.map((img) => ({ id: img.id, dataUrl: img.dataUrl }))
      );

      setProgress("Generating LaTeX with rule-based engine...");

      const latex = generateLaTeX(
        formatId,
        enrichedFeatures,
        extracted.images || [],
        extracted.tables || [],
        extracted.equations || []
      );

      setTexCode(latex);
      setIsGenerating(false);
      setProgress("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate LaTeX"
      );
      setIsGenerating(false);
    }
  }, [formatId]);

  const handleCompile = useCallback(async () => {
    if (!texCode) return;
    setIsCompiling(true);
    setCompileError(null);

    try {
      const compileTex = texCode.replace(
        /\\includegraphics\[([^\]]*)\]\{([^}]+)\}/g,
        (_match, _opts, filename) => {
          const label = filename.replace(/\.\w+$/, "").replace(/-/g, " ");
          return `\\fbox{\\parbox{0.7\\textwidth}{\\centering\\vspace{1.5em}\\textit{[Image: ${label}]}\\vspace{1.5em}}}`;
        }
      );

      const res = await fetch("/api/pro/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex: compileTex }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.log || err.error || "Compilation failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(url);
    } catch (err) {
      setCompileError(
        err instanceof Error ? err.message : "Compilation failed"
      );
    } finally {
      setIsCompiling(false);
    }
  }, [texCode, pdfUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(texCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTeX = () => {
    if (!texCode) return;
    const blob = new Blob([texCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "paper.tex";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = "paper.pdf";
    a.click();
  };

  return (
    <main className="h-screen flex flex-col bg-paper-50 overflow-hidden">
      <Navbar />

      {/* Toolbar */}
      <div className="flex-shrink-0 mt-16 border-b border-paper-200/60 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <Link
              href="/pro/upload"
              className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-600 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </Link>

            <div className="h-4 w-px bg-paper-200" />

            <div className="flex items-center gap-2">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold"
                style={{
                  backgroundColor: `${format.color}15`,
                  color: format.color,
                }}
              >
                {format.name.charAt(0)}
              </div>
              <span className="text-sm font-medium text-ink-700">
                {format.name}
              </span>
              <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[8px] font-bold text-white uppercase">
                Pro
              </span>
            </div>

            <div className="h-4 w-px bg-paper-200" />

            {!isGenerating && !error && texCode && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                Generated
              </span>
            )}

            {activeModel && !isGenerating && (
              <>
                <div className="h-4 w-px bg-paper-200" />
                <span className="flex items-center gap-1.5 text-xs text-ink-400">
                  <Cpu className="h-3 w-3" />
                  {activeModel}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-paper-100 p-0.5">
              {[
                {
                  mode: "code" as const,
                  icon: <Code className="h-3.5 w-3.5" />,
                  label: "Code",
                },
                {
                  mode: "split" as const,
                  icon: <Columns2 className="h-3.5 w-3.5" />,
                  label: "Split",
                },
                {
                  mode: "preview" as const,
                  icon: <Eye className="h-3.5 w-3.5" />,
                  label: "Preview",
                },
              ].map((v) => (
                <button
                  key={v.mode}
                  onClick={() => setViewMode(v.mode)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    viewMode === v.mode
                      ? "bg-white text-ink-800 shadow-sm"
                      : "text-ink-400 hover:text-ink-600"
                  }`}
                >
                  {v.icon}
                  <span className="hidden sm:inline">{v.label}</span>
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-paper-200" />

            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoom(Math.max(50, zoom - 10))}
                className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-paper-100"
              >
                <ZoomOut className="h-3.5 w-3.5 text-ink-400" />
              </button>
              <span className="text-xs text-ink-500 w-8 text-center tabular-nums">
                {zoom}%
              </span>
              <button
                onClick={() => setZoom(Math.min(200, zoom + 10))}
                className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-paper-100"
              >
                <ZoomIn className="h-3.5 w-3.5 text-ink-400" />
              </button>
            </div>

            <div className="h-4 w-px bg-paper-200" />

            <button
              onClick={handleCompile}
              disabled={!texCode || isCompiling}
              className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-medium text-white transition-all hover:shadow-lg active:scale-[0.97] disabled:opacity-50"
            >
              {isCompiling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {isCompiling ? "Compiling..." : "Compile PDF"}
            </button>

            {pdfUrl && (
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-xs font-medium text-white hover:bg-ink-800 hover:shadow-lg active:scale-[0.97]"
              >
                <Download className="h-3.5 w-3.5" />
                PDF
              </button>
            )}

            <button
              onClick={handleDownloadTeX}
              disabled={!texCode}
              className="flex items-center gap-2 rounded-full border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 hover:bg-paper-50 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              .tex
            </button>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Loading overlay */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 flex items-center justify-center bg-paper-50/90 backdrop-blur-sm mt-[105px]"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="flex flex-col items-center gap-6 rounded-3xl border border-paper-200/60 bg-white p-12 shadow-xl max-w-md w-full mx-4"
              >
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20">
                    <Crown className="h-7 w-7 text-amber-600" />
                  </div>
                  <motion.div
                    className="absolute -inset-2 rounded-2xl border-2 border-amber-400/20"
                    animate={{
                      scale: [1, 1.15, 1],
                      opacity: [0.5, 0, 0.5],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                <div className="text-center">
                  <h3 className="font-display text-xl text-ink-900 mb-1">
                    Generating LaTeX
                  </h3>
                  <p className="text-sm text-ink-400">{progress}</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error overlay */}
        <AnimatePresence>
          {error && !isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 flex items-center justify-center bg-paper-50/90 backdrop-blur-sm mt-[105px]"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center gap-6 rounded-3xl border border-red-200/60 bg-white p-12 shadow-xl max-w-md w-full mx-4"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
                  <AlertCircle className="h-7 w-7 text-red-500" />
                </div>
                <div className="text-center">
                  <h3 className="font-display text-xl text-ink-900 mb-2">
                    Generation failed
                  </h3>
                  <p className="text-sm text-ink-400">{error}</p>
                </div>
                <Link
                  href="/pro/upload"
                  className="flex items-center gap-2 rounded-full bg-ink-900 px-6 py-3 text-sm font-medium text-white hover:bg-ink-800"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Try again
                </Link>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Code Panel */}
        {(viewMode === "code" || viewMode === "split") && (
          <div
            className={`flex flex-col border-r border-paper-200/60 bg-white ${
              viewMode === "split" ? "w-1/2" : "w-full"
            }`}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-paper-100 bg-paper-50/50">
              <div className="flex items-center gap-2">
                <Code className="h-3.5 w-3.5 text-ink-400" />
                <span className="text-xs font-medium text-ink-600">
                  output.tex
                </span>
              </div>
              <button
                onClick={handleCopy}
                disabled={!texCode}
                className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-600 disabled:opacity-50"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span className="text-emerald-500">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="flex-1 overflow-auto custom-scroll">
              <div className="flex">
                <div className="flex-shrink-0 py-4 px-3 text-right select-none border-r border-paper-100">
                  {(texCode || "\n").split("\n").map((_, i) => (
                    <div
                      key={i}
                      className="text-[11px] leading-[1.7] font-mono text-ink-300"
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
                <textarea
                  ref={textareaRef}
                  value={texCode}
                  onChange={(e) => setTexCode(e.target.value)}
                  spellCheck={false}
                  className="flex-1 resize-none border-0 bg-transparent p-4 font-mono text-[12px] leading-[1.7] text-ink-700 outline-none"
                  style={{ minHeight: "100%", tabSize: 2 }}
                  placeholder={
                    isGenerating
                      ? "Generating LaTeX..."
                      : "No LaTeX code generated yet"
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* Preview Panel */}
        {(viewMode === "preview" || viewMode === "split") && (
          <div
            className={`flex flex-col bg-ink-100 ${
              viewMode === "split" ? "w-1/2" : "w-full"
            }`}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-paper-200/60 bg-white/50 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 text-ink-400" />
                <span className="text-xs font-medium text-ink-600">
                  {pdfUrl ? "Compiled PDF" : "Preview"}
                </span>
              </div>
              <button
                onClick={() => setZoom(100)}
                className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-600"
              >
                <RotateCcw className="h-3 w-3" />
                Reset zoom
              </button>
            </div>
            <div className="flex-1 overflow-auto custom-scroll p-8 flex justify-center items-start">
              {pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  className="bg-white rounded-sm shadow-2xl shadow-ink-900/10"
                  style={{
                    width: "8.5in",
                    height: "11in",
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: "top center",
                  }}
                  title="Compiled PDF Preview"
                />
              ) : compileError ? (
                <div className="max-w-md text-center">
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
                    <AlertCircle className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="font-display text-lg text-ink-900 mb-2">
                    Compilation Error
                  </h3>
                  <pre className="text-xs text-left text-red-600 bg-red-50 rounded-xl p-4 max-h-80 overflow-auto whitespace-pre-wrap">
                    {compileError}
                  </pre>
                  <button
                    onClick={handleCompile}
                    className="mt-4 rounded-full bg-ink-900 px-5 py-2 text-xs font-medium text-white hover:bg-ink-800"
                  >
                    Retry Compilation
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-20">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-paper-200/50">
                    <FileText className="h-7 w-7 text-ink-300" />
                  </div>
                  <h3 className="font-display text-lg text-ink-500 mb-2">
                    No PDF yet
                  </h3>
                  <p className="text-sm text-ink-300 mb-6 max-w-xs">
                    Click &quot;Compile PDF&quot; in the toolbar to compile
                    your LaTeX into a PDF document.
                  </p>
                  {texCode && (
                    <button
                      onClick={handleCompile}
                      disabled={isCompiling}
                      className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-medium text-white hover:shadow-lg"
                    >
                      <Sparkles className="h-4 w-4" />
                      Compile PDF
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
