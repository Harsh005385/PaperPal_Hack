import type {
  DocumentFeatures,
  ExtractedImage,
  ExtractedTable,
  ExtractedEquation,
  ReferenceInfo,
  SectionInfo,
} from "../types";

export function escapeTeX(text: string): string {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\textbackslash ")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

export function safeTeX(text: string): string {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\textbackslash ")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/[^\x00-\x7F]/g, "");
}

export function renderTable(
  table: ExtractedTable,
  captionPrefix: string = "Table"
): string {
  if (!table.rows.length) return "";
  const maxCols = Math.max(...table.rows.map((r) => r.length));
  const colSpec = "l".repeat(maxCols);

  const lines: string[] = [];
  lines.push("\\begin{table}[htbp]");
  lines.push("\\centering");
  if (table.caption) {
    lines.push(`\\caption{${safeTeX(table.caption)}}`);
  } else {
    lines.push(`\\caption{${captionPrefix} ${table.id.replace("table-", "")}}`);
  }
  lines.push(`\\label{${table.id}}`);
  lines.push(`\\begin{tabular}{${colSpec}}`);
  lines.push("\\hline");

  table.rows.forEach((row, idx) => {
    const paddedRow = [...row];
    while (paddedRow.length < maxCols) paddedRow.push("");
    const cells = paddedRow.map((c) => safeTeX(c)).join(" & ");
    lines.push(`${cells} \\\\`);
    if (idx === 0) lines.push("\\hline");
  });

  lines.push("\\hline");
  lines.push("\\end{tabular}");
  lines.push("\\end{table}");
  return lines.join("\n");
}

export function renderImage(
  image: ExtractedImage,
  captionPrefix: string = "Figure"
): string {
  const lines: string[] = [];
  const figNum = image.id.replace("img-", "");
  const caption = image.caption
    ? safeTeX(image.caption)
    : `${captionPrefix} ${figNum}`;
  const hasImage = image.dataUrl && image.dataUrl.startsWith("data:");
  const ext = image.dataUrl?.includes("image/bmp") ? "bmp"
    : image.dataUrl?.includes("image/jpeg") ? "jpg" : "png";

  lines.push("\\begin{figure}[htbp]");
  lines.push("\\centering");
  if (hasImage) {
    lines.push(`\\includegraphics[width=0.75\\textwidth,keepaspectratio]{${image.id}.${ext}}`);
  } else {
    lines.push("\\fbox{\\parbox{0.7\\textwidth}{\\centering\\vspace{2em}");
    lines.push(`\\textit{[${caption}]}`);
    lines.push("\\vspace{2em}}}");
  }
  lines.push(`\\caption{${caption}}`);
  lines.push(`\\label{fig:${image.id}}`);
  lines.push("\\end{figure}");
  return lines.join("\n");
}

export function renderEquation(equation: ExtractedEquation): string {
  const content = equation.latex || equation.raw;
  if (!content) return "";
  const lines: string[] = [];
  lines.push("\\begin{equation}");
  lines.push(`\\label{${equation.id}}`);
  lines.push(content);
  lines.push("\\end{equation}");
  return lines.join("\n");
}

export function renderSectionContent(
  section: SectionInfo,
  images: ExtractedImage[],
  tables: ExtractedTable[],
  equations: ExtractedEquation[],
  sectionCommand: string = "\\section"
): string {
  const lines: string[] = [];
  const headingCmd =
    section.level === 1
      ? sectionCommand
      : section.level === 2
        ? "\\subsection"
        : "\\subsubsection";

  lines.push(`${headingCmd}{${safeTeX(section.heading)}}`);

  if (section.content) {
    let paragraphs = section.content.split(/\n\s*\n/).filter(Boolean);
    if (paragraphs.length <= 1 && section.content.length > 300) {
      paragraphs = section.content.split(/\n/).filter((p) => p.trim().length > 0);
    }
    if (paragraphs.length <= 1 && section.content.length > 500) {
      const text = section.content;
      const chunks: string[] = [];
      let pos = 0;
      while (pos < text.length) {
        const nextBreak = text.indexOf(". ", pos + 100);
        if (nextBreak === -1 || nextBreak - pos > 800) {
          chunks.push(text.slice(pos));
          break;
        }
        chunks.push(text.slice(pos, nextBreak + 1));
        pos = nextBreak + 2;
      }
      paragraphs = chunks.filter((c) => c.trim().length > 0);
    }
    for (const para of paragraphs) {
      lines.push("");
      lines.push(safeTeX(para.trim()));
    }
  }

  for (const figRef of section.figures) {
    const img = images.find((i) => i.id === figRef);
    if (img) {
      lines.push("");
      lines.push(renderImage(img));
    }
  }

  for (const tabRef of section.tables) {
    const tab = tables.find((t) => t.id === tabRef);
    if (tab) {
      lines.push("");
      lines.push(renderTable(tab));
    }
  }

  for (const eqRef of section.equations) {
    const eq = equations.find((e) => e.id === eqRef);
    if (eq) {
      lines.push("");
      lines.push(renderEquation(eq));
    }
  }

  return lines.join("\n");
}

export function renderAbstract(abstract: string): string {
  if (!abstract) return "";
  return `\\begin{abstract}\n${safeTeX(abstract)}\n\\end{abstract}`;
}

export function renderKeywords(keywords: string[], label: string = "Keywords"): string {
  if (!keywords.length) return "";
  return `\\noindent\\textbf{${label}:} ${keywords.map(safeTeX).join(", ")}\\\\[1em]`;
}

export interface RefFormatter {
  (ref: ReferenceInfo, index: number): string;
}

export function renderBibliography(
  references: ReferenceInfo[],
  formatter: RefFormatter
): string {
  if (!references.length) return "";
  const lines: string[] = [];
  lines.push(`\\begin{thebibliography}{${references.length}}`);
  lines.push("");
  references.forEach((ref, i) => {
    lines.push(formatter(ref, i));
    lines.push("");
  });
  lines.push("\\end{thebibliography}");
  return lines.join("\n");
}

export function defaultRefFormatter(ref: ReferenceInfo, _index: number): string {
  const parts: string[] = [];
  if (ref.authors) parts.push(safeTeX(ref.authors));
  if (ref.title) parts.push(`\\textit{${safeTeX(ref.title)}}`);
  if (ref.venue) parts.push(safeTeX(ref.venue));
  if (ref.volume) parts.push(`vol. ${safeTeX(ref.volume)}`);
  if (ref.issue) parts.push(`no. ${safeTeX(ref.issue)}`);
  if (ref.pages) parts.push(`pp. ${safeTeX(ref.pages)}`);
  if (ref.year) parts.push(safeTeX(ref.year));
  if (ref.doi) parts.push(`doi: ${safeTeX(ref.doi)}`);
  return `\\bibitem{${ref.id}} ${parts.join(", ")}.`;
}

export function corePackages(): string {
  return [
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
  ].join("\n");
}

export function buildDocument(
  preamble: string,
  body: string
): string {
  const docclassEnd = preamble.indexOf("\n");
  const withCore =
    docclassEnd !== -1
      ? preamble.slice(0, docclassEnd + 1) +
        corePackages() +
        "\n" +
        preamble.slice(docclassEnd + 1)
      : preamble + "\n" + corePackages();

  return `${withCore}\n\n\\begin{document}\n\n${body}\n\n\\end{document}\n`;
}

export interface LaTeXGenerator {
  generate(
    features: DocumentFeatures,
    images: ExtractedImage[],
    tables: ExtractedTable[],
    equations: ExtractedEquation[]
  ): string;
}
