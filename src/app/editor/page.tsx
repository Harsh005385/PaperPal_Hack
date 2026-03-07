"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Download,
  Eye,
  EyeOff,
  Code,
  Columns2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Copy,
  Check,
  AlertCircle,
  Cpu,
  Mail,
  ArrowRight,
  Loader2,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { FORMAT_OPTIONS } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";

interface ConversionStatus {
  message: string;
  progress: number;
  step: string;
  chunkIndex?: number;
  model?: string;
}

interface ParsedDocument {
  text: string;
  sections: {
    title: string;
    abstract: string;
    body: string[];
    references: string;
  };
  fileName: string;
  fileSize: number;
  isTeX: boolean;
}

export default function EditorPage() {
  const searchParams = useSearchParams();
  const formatId = searchParams.get("format") || "ieee";
  const format =
    FORMAT_OPTIONS.find((f) => f.id === formatId) || FORMAT_OPTIONS[5];

  const [viewMode, setViewMode] = useState<"split" | "code" | "preview">(
    "split"
  );
  const [zoom, setZoom] = useState(100);
  const [isConverting, setIsConverting] = useState(true);
  const [conversionStatus, setConversionStatus] =
    useState<ConversionStatus | null>(null);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [texCode, setTexCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isLoggedIn, signin, signup } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authFirstName, setAuthFirstName] = useState("");
  const [authLastName, setAuthLastName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    const raw = sessionStorage.getItem("paperpal_parsed");
    if (!raw) {
      setIsConverting(false);
      setConversionError(
        "No document data found. Please go back and upload a file."
      );
      return;
    }

    const parsed: ParsedDocument = JSON.parse(raw);

    if (parsed.isTeX) {
      setTexCode(parsed.text);
      setIsConverting(false);
      setConversionProgress(100);
      return;
    }

    startConversion(parsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startConversion = async (parsed: ParsedDocument) => {
    setIsConverting(true);
    setConversionProgress(0);
    setConversionError(null);

    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: parsed.text,
          sections: parsed.sections,
          formatId,
          isTeX: parsed.isTeX,
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      let receivedComplete = false;

      const wrappedProcessLines = (text: string) => {
        let currentEvent = "";
        for (const line of text.split("\n")) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === "complete" || currentEvent === "error") {
                receivedComplete = true;
              }
              handleSSEEvent(currentEvent, data);
            } catch {
              // ignore malformed JSON
            }
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) wrappedProcessLines(buffer);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lastDoubleNewline = buffer.lastIndexOf("\n\n");
        if (lastDoubleNewline !== -1) {
          wrappedProcessLines(buffer.slice(0, lastDoubleNewline));
          buffer = buffer.slice(lastDoubleNewline + 2);
        }
      }

      if (!receivedComplete) {
        setConversionError("Connection closed before conversion completed. Please try again.");
        setIsConverting(false);
      }
    } catch (err) {
      setConversionError(
        err instanceof Error ? err.message : "Conversion failed"
      );
      setIsConverting(false);
    }
  };

  const handleSSEEvent = useCallback(
    (event: string, data: Record<string, unknown>) => {
      switch (event) {
        case "status":
          setConversionStatus(data as unknown as ConversionStatus);
          setConversionProgress(data.progress as number);
          break;
        case "chunk":
          setConversionProgress(data.progress as number);
          if (data.model) setActiveModel(data.model as string);
          break;
        case "complete":
          setTexCode(data.latex as string);
          setConversionProgress(100);
          setIsConverting(false);
          setConversionStatus(null);
          break;
        case "error":
          setConversionError(data.message as string);
          setIsConverting(false);
          break;
      }
    },
    []
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(texCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }
    downloadPDF();
  };

  const downloadPDF = () => {
    if (!texCode) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const parsed = parseTeXForPreview(texCode);
    const htmlContent = buildPrintableHTML(parsed, format.name);

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    let result: { success: boolean; error?: string };

    if (authMode === "signup") {
      if (!authFirstName || !authLastName) {
        setAuthError("First name and last name are required");
        setAuthLoading(false);
        return;
      }
      result = await signup(authFirstName, authLastName, authEmail, authPassword);
    } else {
      result = await signin(authEmail, authPassword);
    }

    setAuthLoading(false);

    if (result.success) {
      setShowAuthModal(false);
      setAuthEmail("");
      setAuthPassword("");
      setAuthFirstName("");
      setAuthLastName("");
      downloadPDF();
    } else {
      setAuthError(result.error || "Something went wrong");
    }
  };

  return (
    <main className="h-screen flex flex-col bg-paper-50 overflow-hidden">
      <Navbar />

      {/* Editor Toolbar */}
      <div className="flex-shrink-0 mt-16 border-b border-paper-200/60 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <Link
              href="/upload"
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
                {format.name} Format
              </span>
            </div>

            <div className="h-4 w-px bg-paper-200" />

            {!isConverting && !conversionError && texCode && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                Converted
              </span>
            )}

            {activeModel && !isConverting && (
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
                { mode: "code" as const, icon: <Code className="h-3.5 w-3.5" />, label: "Code" },
                { mode: "split" as const, icon: <Columns2 className="h-3.5 w-3.5" />, label: "Split" },
                { mode: "preview" as const, icon: <Eye className="h-3.5 w-3.5" />, label: "Preview" },
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
                className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-paper-100 transition-colors"
              >
                <ZoomOut className="h-3.5 w-3.5 text-ink-400" />
              </button>
              <span className="text-xs text-ink-500 w-8 text-center tabular-nums">
                {zoom}%
              </span>
              <button
                onClick={() => setZoom(Math.min(200, zoom + 10))}
                className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-paper-100 transition-colors"
              >
                <ZoomIn className="h-3.5 w-3.5 text-ink-400" />
              </button>
            </div>

            <div className="h-4 w-px bg-paper-200" />

            <button
              onClick={handleDownload}
              disabled={!texCode}
              className="group flex items-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-ink-800 hover:shadow-lg active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        <AnimatePresence>
          {isConverting && (
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
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
                    <Sparkles className="h-7 w-7 text-accent" />
                  </div>
                  <motion.div
                    className="absolute -inset-2 rounded-2xl border-2 border-accent/20"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                <div className="text-center">
                  <h3 className="font-display text-xl text-ink-900 mb-1">
                    Converting your paper
                  </h3>
                  <p className="text-sm text-ink-400">
                    {conversionStatus?.message ||
                      `AI is reformatting to ${format.name} style...`}
                  </p>
                  {activeModel && (
                    <p className="text-xs text-ink-300 mt-2 flex items-center justify-center gap-1.5">
                      <Cpu className="h-3 w-3" />
                      Using {activeModel}
                    </p>
                  )}
                </div>
                <div className="w-64">
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-ink-400">Progress</span>
                    <span className="text-xs font-mono text-ink-500">
                      {conversionProgress}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-paper-200 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${conversionProgress}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {conversionError && !isConverting && (
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
                    Conversion failed
                  </h3>
                  <p className="text-sm text-ink-400">{conversionError}</p>
                </div>
                <Link
                  href="/upload"
                  className="flex items-center gap-2 rounded-full bg-ink-900 px-6 py-3 text-sm font-medium text-white transition-all hover:bg-ink-800"
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
                className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-600 transition-colors disabled:opacity-50"
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
                    isConverting
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
                  Preview
                </span>
              </div>
              <button
                onClick={() => setZoom(100)}
                className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-600 transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Reset zoom
              </button>
            </div>
            <div className="flex-1 overflow-auto custom-scroll p-8 flex justify-center items-start">
              <div
                className="bg-white rounded-sm shadow-2xl shadow-ink-900/10 transition-transform origin-top flex-shrink-0"
                style={{
                  transform: `scale(${zoom / 100})`,
                  width: "8.5in",
                  minHeight: "11in",
                  padding: "0.75in 0.85in",
                  marginBottom: "2rem",
                }}
              >
                <LaTeXPreview texCode={texCode} formatName={format.name} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4"
            onClick={() => setShowAuthModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center mb-6">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
                  <Lock className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-display text-2xl text-ink-900 mb-1">
                  Sign in to download
                </h3>
                <p className="text-sm text-ink-400">
                  Log in to download your paper as a PDF.
                </p>
              </div>

              <div className="flex rounded-xl bg-paper-100 p-1 mb-5">
                {(["signin", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setAuthMode(m);
                      setAuthError(null);
                    }}
                    className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
                      authMode === m
                        ? "bg-white text-ink-900 shadow-sm"
                        : "text-ink-400 hover:text-ink-600"
                    }`}
                  >
                    {m === "signin" ? "Sign In" : "Sign Up"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleAuth} className="space-y-3">
                {authMode === "signup" && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={authFirstName}
                      onChange={(e) => setAuthFirstName(e.target.value)}
                      placeholder="First name"
                      className="w-full rounded-xl border border-paper-200 bg-white py-3 pl-4 pr-4 text-sm text-ink-800 placeholder:text-ink-300 outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                    />
                    <input
                      type="text"
                      value={authLastName}
                      onChange={(e) => setAuthLastName(e.target.value)}
                      placeholder="Last name"
                      className="w-full rounded-xl border border-paper-200 bg-white py-3 pl-4 pr-4 text-sm text-ink-800 placeholder:text-ink-300 outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                    />
                  </div>
                )}
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-300" />
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="Email address"
                    required
                    className="w-full rounded-xl border border-paper-200 bg-white py-3 pl-10 pr-4 text-sm text-ink-800 placeholder:text-ink-300 outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-300" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Password"
                    required
                    minLength={6}
                    className="w-full rounded-xl border border-paper-200 bg-white py-3 pl-10 pr-10 text-sm text-ink-800 placeholder:text-ink-300 outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-500"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {authError && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                    <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <p className="text-xs text-red-600">{authError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-full bg-ink-900 py-3.5 text-sm font-semibold text-white transition-all hover:bg-ink-800 active:scale-[0.97] disabled:opacity-60"
                >
                  {authLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {authMode === "signin" ? "Sign In" : "Create Account"}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <button
                onClick={() => setShowAuthModal(false)}
                className="mt-4 w-full text-center text-xs text-ink-400 hover:text-ink-600 transition-colors"
              >
                Maybe later
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

/* ─── Preview Rendering ─── */

function LaTeXPreview({
  texCode,
  formatName,
}: {
  texCode: string;
  formatName: string;
}) {
  if (!texCode) {
    return (
      <div className="flex items-center justify-center h-full text-ink-300 text-sm">
        Preview will appear once conversion is complete
      </div>
    );
  }

  const parsed = parseTeXForPreview(texCode);
  const isIEEE = formatName === "IEEE";

  return (
    <div style={{ fontFamily: "'Times New Roman', 'CMU Serif', Georgia, serif", fontSize: "10pt", lineHeight: 1.4, color: "#1a1a1a" }}>
      {/* Title Block */}
      {parsed.title && (
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <h1 style={{ fontSize: "17px", fontWeight: 700, lineHeight: 1.2, marginBottom: "10px" }}>
            {parsed.title}
          </h1>
          {parsed.authors.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", gap: "32px", flexWrap: "wrap" }}>
              {parsed.authors.map((author, i) => (
                <div key={i} style={{ textAlign: "center", fontSize: "9px" }}>
                  <p style={{ fontWeight: 600, marginBottom: "2px" }}>{author.name}</p>
                  {author.affiliation && (
                    <p style={{ color: "#555", whiteSpace: "pre-line" }}>
                      {author.affiliation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Abstract */}
      {parsed.abstract && (
        <div style={{ marginBottom: "14px", fontSize: "9px", textAlign: "justify" }}>
          <span style={{ fontWeight: 700, fontStyle: "italic" }}>Abstract&mdash;</span>
          <span>{parsed.abstract}</span>
        </div>
      )}

      {/* Keywords */}
      {parsed.keywords && (
        <div style={{ marginBottom: "14px", fontSize: "9px" }}>
          <span style={{ fontWeight: 700, fontStyle: "italic" }}>Index Terms&mdash;</span>
          <span style={{ fontStyle: "italic" }}>{parsed.keywords}</span>
        </div>
      )}

      {/* Body - two-column for IEEE, single column for others */}
      <div
        style={{
          columnCount: isIEEE ? 2 : 1,
          columnGap: "20px",
          fontSize: "9px",
          lineHeight: 1.5,
          textAlign: "justify",
        }}
      >
        {parsed.sections.map((section, i) => (
          <div key={i} style={{ breakInside: "avoid-column", marginBottom: "12px" }}>
            <h2
              style={{
                fontSize: isIEEE ? "10px" : "11px",
                fontWeight: 700,
                textAlign: "center",
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.3px",
              }}
            >
              {isIEEE ? `${toRoman(i + 1)}. ` : ""}
              {section.heading}
            </h2>
            {section.subsections.map((sub, si) => (
              <div key={si} style={{ marginBottom: "8px" }}>
                {sub.heading && (
                  <h3
                    style={{
                      fontSize: "9px",
                      fontWeight: 700,
                      fontStyle: "italic",
                      marginBottom: "3px",
                    }}
                  >
                    {isIEEE ? `${String.fromCharCode(65 + si)}. ` : ""}
                    {sub.heading}
                  </h3>
                )}
                {sub.paragraphs.map((para, pi) => (
                  <p key={pi} style={{ textIndent: "1.5em", marginBottom: "4px" }}>
                    {para}
                  </p>
                ))}
              </div>
            ))}
            {section.paragraphs.map((para, pi) => (
              <p key={pi} style={{ textIndent: "1.5em", marginBottom: "4px" }}>
                {para}
              </p>
            ))}
          </div>
        ))}
      </div>

      {/* References */}
      {parsed.references.length > 0 && (
        <div style={{ marginTop: "16px", fontSize: "8px", lineHeight: 1.4 }}>
          <h2
            style={{
              fontSize: "10px",
              fontWeight: 700,
              textAlign: "center",
              marginBottom: "6px",
              textTransform: "uppercase",
            }}
          >
            References
          </h2>
          {parsed.references.map((ref, i) => (
            <p key={i} style={{ marginBottom: "2px", paddingLeft: "1.5em", textIndent: "-1.5em" }}>
              [{i + 1}] {ref}
            </p>
          ))}
        </div>
      )}

      {/* Fallback for unparseable content */}
      {parsed.rawFallback && parsed.sections.length === 0 && (
        <pre style={{ fontSize: "9px", whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.5 }}>
          {parsed.rawFallback}
        </pre>
      )}
    </div>
  );
}

/* ─── TeX Parser ─── */

interface SubSection {
  heading: string;
  paragraphs: string[];
}

interface Section {
  heading: string;
  paragraphs: string[];
  subsections: SubSection[];
}

interface ParsedTeX {
  title: string;
  authors: { name: string; affiliation: string }[];
  abstract: string;
  keywords: string;
  sections: Section[];
  references: string[];
  rawFallback: string;
}

function parseTeXForPreview(tex: string): ParsedTeX {
  const result: ParsedTeX = {
    title: "",
    authors: [],
    abstract: "",
    keywords: "",
    sections: [],
    references: [],
    rawFallback: "",
  };

  try {
    // Title
    const titleMatch = tex.match(/\\title\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/);
    if (titleMatch) result.title = cleanTeX(titleMatch[1]);

    // Authors - multiple patterns
    const ieeeAuthorRe = /\\IEEEauthorblockN\{([^}]*)\}/g;
    const ieeeAffRe = /\\IEEEauthorblockA\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
    let m;
    const names: string[] = [];
    const affs: string[] = [];
    while ((m = ieeeAuthorRe.exec(tex)) !== null) names.push(cleanTeX(m[1]));
    while ((m = ieeeAffRe.exec(tex)) !== null) affs.push(cleanTeX(m[1]));

    if (names.length > 0) {
      for (let i = 0; i < names.length; i++) {
        result.authors.push({ name: names[i], affiliation: affs[i] || "" });
      }
    } else {
      const authorMatch = tex.match(/\\author\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/);
      if (authorMatch) {
        const authorText = cleanTeX(authorMatch[1]);
        if (authorText) {
          result.authors.push({ name: authorText, affiliation: "" });
        }
      }
    }

    // Abstract
    const abstractMatch = tex.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);
    if (abstractMatch) result.abstract = cleanTeX(abstractMatch[1]);

    // Keywords
    const kwMatch = tex.match(/\\begin\{IEEEkeywords\}([\s\S]*?)\\end\{IEEEkeywords\}/);
    if (kwMatch) result.keywords = cleanTeX(kwMatch[1]);
    if (!result.keywords) {
      const kwMatch2 = tex.match(/\\keywords\{([^}]*)\}/);
      if (kwMatch2) result.keywords = cleanTeX(kwMatch2[1]);
    }

    // Sections and subsections
    const sectionRe = /\\section\{([^}]*)\}/g;
    const sectionPositions: { heading: string; start: number; matchLen: number }[] = [];
    while ((m = sectionRe.exec(tex)) !== null) {
      sectionPositions.push({
        heading: cleanTeX(m[1]),
        start: m.index + m[0].length,
        matchLen: m[0].length,
      });
    }

    for (let i = 0; i < sectionPositions.length; i++) {
      const start = sectionPositions[i].start;
      const nextSecStart = i + 1 < sectionPositions.length
        ? sectionPositions[i + 1].start - sectionPositions[i + 1].matchLen
        : tex.indexOf("\\end{document}", start);
      const end = nextSecStart > start ? nextSecStart : tex.length;
      const sectionContent = tex.slice(start, end);

      const subsectionRe = /\\subsection\{([^}]*)\}/g;
      const subPositions: { heading: string; start: number; len: number }[] = [];
      let sm;
      while ((sm = subsectionRe.exec(sectionContent)) !== null) {
        subPositions.push({ heading: cleanTeX(sm[1]), start: sm.index + sm[0].length, len: sm[0].length });
      }

      const section: Section = {
        heading: sectionPositions[i].heading,
        paragraphs: [],
        subsections: [],
      };

      if (subPositions.length > 0) {
        const beforeSubs = sectionContent.slice(0, subPositions[0].start - subPositions[0].len);
        section.paragraphs = splitParagraphs(beforeSubs);

        for (let si = 0; si < subPositions.length; si++) {
          const subStart = subPositions[si].start;
          const subEnd = si + 1 < subPositions.length
            ? subPositions[si + 1].start - subPositions[si + 1].len
            : sectionContent.length;
          const subContent = sectionContent.slice(subStart, subEnd);
          section.subsections.push({
            heading: subPositions[si].heading,
            paragraphs: splitParagraphs(subContent),
          });
        }
      } else {
        section.paragraphs = splitParagraphs(sectionContent);
      }

      result.sections.push(section);
    }

    // References via bibitem
    const bibRe = /\\bibitem\{[^}]*\}\s*([\s\S]*?)(?=\\bibitem|\\end\{thebibliography\})/g;
    while ((m = bibRe.exec(tex)) !== null) {
      const ref = cleanTeX(m[1]);
      if (ref) result.references.push(ref);
    }

    // Fallback
    if (!result.title && result.sections.length === 0) {
      const bodyMatch = tex.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
      result.rawFallback = bodyMatch ? cleanTeX(bodyMatch[1]) : cleanTeX(tex);
    }
  } catch {
    result.rawFallback = tex;
  }

  return result;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => cleanTeX(p))
    .filter((p) => p.length > 3);
}

function cleanTeX(input: string): string {
  return input
    .replace(/\\\\(?:\s*\n|\s)/g, " ")
    .replace(/\\textbf\{([^}]*)\}/g, "$1")
    .replace(/\\textit\{([^}]*)\}/g, "$1")
    .replace(/\\emph\{([^}]*)\}/g, "$1")
    .replace(/\\underline\{([^}]*)\}/g, "$1")
    .replace(/\\cite\{([^}]*)\}/g, "[$1]")
    .replace(/\\label\{[^}]*\}/g, "")
    .replace(/\\ref\{[^}]*\}/g, "[ref]")
    .replace(/\\url\{([^}]*)\}/g, "$1")
    .replace(/\\href\{[^}]*\}\{([^}]*)\}/g, "$1")
    .replace(/\\begin\{(?:itemize|enumerate)\}/g, "")
    .replace(/\\end\{(?:itemize|enumerate)\}/g, "")
    .replace(/\\item\s*/g, "- ")
    .replace(/\\begin\{(?:equation|align|gather|multline)\*?\}[\s\S]*?\\end\{(?:equation|align|gather|multline)\*?\}/g, "[equation]")
    .replace(/\\begin\{(?:table|figure)\*?\}[\s\S]*?\\end\{(?:table|figure)\*?\}/g, "")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/\\(?:section|subsection|subsubsection|paragraph)\{[^}]*\}/g, "")
    .replace(/\\(?:maketitle|newpage|clearpage|pagebreak|noindent|centering|raggedright|raggedleft)/g, "")
    .replace(/\\(?:vspace|hspace|vskip|hskip|smallskip|medskip|bigskip)\{?[^}]*\}?/g, "")
    .replace(/\\(?:footnote)\{([^}]*)\}/g, "")
    .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, "$1")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[{}]/g, "")
    .replace(/~+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toRoman(num: number): string {
  const vals = [10, 9, 5, 4, 1];
  const syms = ["X", "IX", "V", "IV", "I"];
  let result = "";
  for (let i = 0; i < vals.length; i++) {
    while (num >= vals[i]) {
      result += syms[i];
      num -= vals[i];
    }
  }
  return result;
}

/* ─── Printable HTML for PDF Download ─── */

function buildPrintableHTML(parsed: ParsedTeX, formatName: string): string {
  const isIEEE = formatName === "IEEE";

  const authorHTML = parsed.authors
    .map(
      (a) =>
        `<div style="text-align:center;font-size:9px"><p style="font-weight:600;margin:0">${a.name}</p>${a.affiliation ? `<p style="color:#555;margin:2px 0 0 0;white-space:pre-line">${a.affiliation}</p>` : ""}</div>`
    )
    .join("");

  const sectionsHTML = parsed.sections
    .map((sec, i) => {
      const heading = isIEEE ? `${toRoman(i + 1)}. ${sec.heading}` : sec.heading;
      const subsHTML = sec.subsections
        .map(
          (sub, si) =>
            `<div style="margin-bottom:8px">${sub.heading ? `<h3 style="font-size:9px;font-weight:700;font-style:italic;margin:0 0 3px 0">${isIEEE ? `${String.fromCharCode(65 + si)}. ` : ""}${sub.heading}</h3>` : ""}${sub.paragraphs.map((p) => `<p style="text-indent:1.5em;margin:0 0 4px 0;text-align:justify">${p}</p>`).join("")}</div>`
        )
        .join("");
      const parasHTML = sec.paragraphs
        .map((p) => `<p style="text-indent:1.5em;margin:0 0 4px 0;text-align:justify">${p}</p>`)
        .join("");
      return `<div style="break-inside:avoid-column;margin-bottom:12px"><h2 style="font-size:${isIEEE ? "10px" : "11px"};font-weight:700;text-align:center;margin:0 0 6px 0;text-transform:uppercase;letter-spacing:0.3px">${heading}</h2>${parasHTML}${subsHTML}</div>`;
    })
    .join("");

  const refsHTML =
    parsed.references.length > 0
      ? `<div style="margin-top:16px;font-size:8px;line-height:1.4"><h2 style="font-size:10px;font-weight:700;text-align:center;margin:0 0 6px 0;text-transform:uppercase">References</h2>${parsed.references.map((r, i) => `<p style="margin:0 0 2px 0;padding-left:1.5em;text-indent:-1.5em">[${i + 1}] ${r}</p>`).join("")}</div>`
      : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${parsed.title || "Paper"}</title>
<style>
  @page { size: letter; margin: 0.75in 0.85in; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  body { font-family: 'Times New Roman', Georgia, serif; font-size: 10pt; line-height: 1.4; color: #1a1a1a; margin: 0; padding: 0.75in 0.85in; }
</style>
</head>
<body>
${parsed.title ? `<div style="text-align:center;margin-bottom:16px"><h1 style="font-size:17px;font-weight:700;line-height:1.2;margin:0 0 10px 0">${parsed.title}</h1>${authorHTML ? `<div style="display:flex;justify-content:center;gap:32px;flex-wrap:wrap">${authorHTML}</div>` : ""}</div>` : ""}
${parsed.abstract ? `<div style="margin-bottom:14px;font-size:9px;text-align:justify"><span style="font-weight:700;font-style:italic">Abstract&mdash;</span>${parsed.abstract}</div>` : ""}
${parsed.keywords ? `<div style="margin-bottom:14px;font-size:9px"><span style="font-weight:700;font-style:italic">Index Terms&mdash;</span><span style="font-style:italic">${parsed.keywords}</span></div>` : ""}
<div style="column-count:${isIEEE ? 2 : 1};column-gap:20px;font-size:9px;line-height:1.5;text-align:justify">${sectionsHTML}</div>
${refsHTML}
${parsed.rawFallback && parsed.sections.length === 0 ? `<pre style="font-size:9px;white-space:pre-wrap;font-family:inherit;line-height:1.5">${parsed.rawFallback}</pre>` : ""}
</body>
</html>`;
}
