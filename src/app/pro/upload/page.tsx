"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FolderUp,
  Zap,
  Crown,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { FORMAT_OPTIONS } from "@/lib/constants";

interface UploadedPDF {
  file: File;
  name: string;
  size: number;
}

export default function ProUploadPage() {
  const router = useRouter();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [selectedFormat, setSelectedFormat] = useState("");
  const [pdf, setPdf] = useState<UploadedPDF | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseProgress, setParseProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const proFormats = FORMAT_OPTIONS.filter((f) => f.id !== "custom");

  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) return;
    setPdf({ file, name: file.name, size: file.size });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleConvert = async () => {
    if (!pdf || !selectedFormat) return;

    setIsParsing(true);
    setParseError(null);
    setParseProgress("Uploading PDF...");

    try {
      const formData = new FormData();
      formData.append("file", pdf.file);

      setParseProgress("Extracting content from PDF...");
      const parseRes = await fetch("/api/pro/parse", {
        method: "POST",
        body: formData,
      });

      if (!parseRes.ok) {
        const err = await parseRes.json();
        throw new Error(err.error || "Failed to parse PDF");
      }

      const parseData = await parseRes.json();
      const extracted = parseData.data;

      setParseProgress("Analyzing document structure with AI...");

      const extractRes = await fetch("/api/pro/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: extracted.text,
          imageCount: extracted.images?.length || 0,
          tableCount: extracted.tables?.length || 0,
          equationCount: extracted.equations?.length || 0,
        }),
      });

      if (!extractRes.ok) throw new Error("Feature extraction failed");

      const reader = extractRes.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let features = null;

      const processEvent = (block: string) => {
        let eventName = "";
        let dataLine = "";

        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) {
            eventName = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            dataLine = line.slice(6);
          }
        }

        if (!dataLine) return;

        try {
          const data = JSON.parse(dataLine);

          if (eventName === "error") {
            throw new Error(data.message || "Extraction failed");
          }

          if (eventName === "complete" && data.features) {
            features = data.features;
          }

          if (data.message) {
            setParseProgress(data.message);
          }
        } catch (e) {
          if (e instanceof SyntaxError) {
            console.warn("[Pro] Failed to parse SSE data:", dataLine.slice(0, 200));
            return;
          }
          throw e;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            for (const block of buffer.split("\n\n")) {
              if (block.trim()) processEvent(block);
            }
          }
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const block of parts) {
          if (block.trim()) processEvent(block);
        }
      }

      if (!features) throw new Error("No features extracted from document");

      sessionStorage.setItem(
        "paperpal_pro",
        JSON.stringify({
          features,
          extracted,
          format: selectedFormat,
        })
      );

      router.push(`/pro/editor?format=${selectedFormat}`);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "Failed to process PDF"
      );
      setIsParsing(false);
    }
  };

  if (!authLoading && !isLoggedIn) {
    return (
      <main className="min-h-screen bg-paper-50">
        <Navbar />
        <div className="pt-28 pb-20 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full mx-6 rounded-3xl border border-paper-200/60 bg-white p-10 shadow-sm text-center"
          >
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20">
              <Crown className="h-7 w-7 text-amber-600" />
            </div>
            <h2 className="font-display text-2xl text-ink-900 mb-2">
              Pro Pipeline Access
            </h2>
            <p className="text-sm text-ink-400 mb-8">
              Sign in to access the state-of-the-art PDF conversion pipeline
              with layout-aware extraction and rule-based LaTeX generation.
            </p>
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-ink-800 hover:shadow-lg"
            >
              Sign In to Continue
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper-50">
      <Navbar />

      <div className="pt-28 pb-20">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-ink-400 hover:text-ink-600 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to home
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-display text-3xl md:text-4xl tracking-tight text-ink-900">
                Pro Pipeline
              </h1>
              <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                Advanced
              </span>
            </div>
            <p className="text-ink-400 max-w-lg">
              Upload a PDF research paper. Our AI extracts the structure, then
              rule-based generators produce perfect LaTeX — zero hallucination.
            </p>
          </motion.div>

          {/* Steps */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-10"
          >
            <div className="flex items-center gap-3 mb-6">
              {[
                { n: 1, label: "Choose Format" },
                { n: 2, label: "Upload PDF" },
                { n: 3, label: "Process" },
              ].map((s, i) => (
                <div key={s.n} className="flex items-center gap-3">
                  {i > 0 && (
                    <div
                      className={`h-px w-8 transition-colors duration-300 ${step >= s.n ? "bg-amber-500" : "bg-paper-200"}`}
                    />
                  )}
                  <button
                    onClick={() => {
                      if (s.n === 1) setStep(1);
                      if (s.n === 2 && selectedFormat) setStep(2);
                      if (s.n === 3 && pdf && selectedFormat) setStep(3);
                    }}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-300 ${
                      step === s.n
                        ? "bg-ink-900 text-white shadow-md"
                        : step > s.n
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-paper-100 text-ink-400"
                    }`}
                  >
                    {step > s.n ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <span>{s.n}</span>
                    )}
                    {s.label}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="font-display text-2xl text-ink-900 mb-2">
                  Choose your target format
                </h2>
                <p className="text-ink-400 mb-8 text-sm">
                  Select the citation and formatting style for your converted
                  paper.
                </p>

                <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-3 gap-3">
                  {proFormats.map((fmt) => (
                    <button
                      key={fmt.id}
                      onClick={() => {
                        setSelectedFormat(fmt.id);
                        setStep(2);
                      }}
                      className={`group relative flex flex-col items-center rounded-2xl border p-5 text-center transition-all duration-300 ${
                        selectedFormat === fmt.id
                          ? "border-transparent shadow-lg -translate-y-0.5"
                          : "border-paper-200/60 bg-white/60 hover:border-paper-300 hover:bg-white hover:shadow-md"
                      }`}
                      style={
                        selectedFormat === fmt.id
                          ? {
                              backgroundColor: `${fmt.color}08`,
                              borderColor: `${fmt.color}30`,
                            }
                          : undefined
                      }
                    >
                      <div
                        className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold"
                        style={{
                          backgroundColor: `${fmt.color}12`,
                          color: fmt.color,
                        }}
                      >
                        {fmt.name.charAt(0)}
                      </div>
                      <h3 className="text-sm font-semibold text-ink-800">
                        {fmt.name}
                      </h3>
                      <p className="mt-0.5 text-[10px] text-ink-400">
                        {fmt.description}
                      </p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="font-display text-2xl text-ink-900 mb-2">
                  Upload your PDF
                </h2>
                <p className="text-ink-400 mb-8 text-sm">
                  Drop your source research paper in PDF format.
                </p>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative rounded-3xl border-2 border-dashed p-12 text-center transition-all duration-300 ${
                    isDragging
                      ? "border-amber-500 bg-amber-50/50 scale-[1.01]"
                      : "border-paper-300 bg-white/40 hover:border-paper-400"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <motion.div
                      animate={
                        isDragging
                          ? { scale: 1.1, y: -5 }
                          : { scale: 1, y: 0 }
                      }
                      className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-paper-100"
                    >
                      <FolderUp
                        className={`h-7 w-7 transition-colors ${isDragging ? "text-amber-500" : "text-ink-300"}`}
                      />
                    </motion.div>
                    <p className="text-sm font-medium text-ink-600 mb-1">
                      Drag and drop your PDF here
                    </p>
                    <p className="text-xs text-ink-400 mb-5">
                      Supports .pdf files only
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-full bg-ink-900 px-5 py-2.5 text-xs font-medium text-white transition-all hover:bg-ink-800 hover:shadow-lg active:scale-[0.97]"
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5" />
                        Choose PDF
                      </span>
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                      e.target.value = "";
                    }}
                  />
                </div>

                {pdf && (
                  <div className="mt-6">
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="flex items-center gap-3 rounded-xl border border-paper-200/60 bg-white/80 px-4 py-3"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                        <FileText className="h-4 w-4 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink-700 truncate">
                          {pdf.name}
                        </p>
                        <p className="text-[11px] text-ink-400">
                          {(pdf.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        onClick={() => setPdf(null)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-paper-100"
                      >
                        <X className="h-3.5 w-3.5 text-ink-400" />
                      </button>
                    </motion.div>
                  </div>
                )}

                <div className="mt-8 flex items-center justify-between">
                  <button
                    onClick={() => setStep(1)}
                    className="flex items-center gap-2 text-sm text-ink-500 hover:text-ink-700"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Change format
                  </button>
                  <button
                    onClick={() => pdf && setStep(3)}
                    disabled={!pdf}
                    className={`group flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-all ${
                      pdf
                        ? "bg-ink-900 text-white hover:bg-ink-800 hover:shadow-lg active:scale-[0.97]"
                        : "bg-paper-200 text-ink-400 cursor-not-allowed"
                    }`}
                  >
                    Continue
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="font-display text-2xl text-ink-900 mb-2">
                  Ready to process
                </h2>
                <p className="text-ink-400 mb-8 text-sm">
                  Review your selection and start the AI extraction pipeline.
                </p>

                <div className="rounded-3xl border border-paper-200/60 bg-white p-8 shadow-sm">
                  <div className="space-y-5">
                    <div className="flex items-center justify-between pb-5 border-b border-paper-100">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-400">
                          Target Format
                        </p>
                        <p className="mt-1 font-display text-xl text-ink-900">
                          {proFormats.find((f) => f.id === selectedFormat)
                            ?.name || "—"}
                        </p>
                      </div>
                      <button
                        onClick={() => setStep(1)}
                        className="text-xs text-amber-600 hover:text-amber-700"
                      >
                        Change
                      </button>
                    </div>

                    <div className="flex items-center justify-between pb-5 border-b border-paper-100">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-400">
                          PDF File
                        </p>
                        <p className="mt-1 text-sm text-ink-700">
                          {pdf?.name || "—"}
                        </p>
                      </div>
                      <button
                        onClick={() => setStep(2)}
                        className="text-xs text-amber-600 hover:text-amber-700"
                      >
                        Change
                      </button>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-100 p-4">
                      <Zap className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">
                          Pro Pipeline
                        </p>
                        <p className="text-xs text-amber-600 mt-0.5">
                          PDF layout extraction + AI structure analysis +
                          rule-based LaTeX generation (zero hallucination)
                        </p>
                      </div>
                    </div>
                  </div>

                  {parseError && (
                    <div className="mt-4 flex items-start gap-3 rounded-xl bg-red-50 border border-red-100 p-4">
                      <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-800">
                          Processing failed
                        </p>
                        <p className="text-xs text-red-600 mt-0.5">
                          {parseError}
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleConvert}
                    disabled={isParsing}
                    className={`group mt-8 w-full flex items-center justify-center gap-3 rounded-full py-4 text-sm font-semibold text-white transition-all active:scale-[0.98] ${
                      isParsing
                        ? "bg-ink-600 cursor-wait"
                        : "bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-2xl hover:shadow-amber-500/25"
                    }`}
                  >
                    {isParsing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {parseProgress}
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Start Pro Conversion
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>

                <button
                  onClick={() => setStep(2)}
                  className="mt-4 flex items-center gap-2 text-sm text-ink-500 hover:text-ink-700"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to upload
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
