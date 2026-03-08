import type {
  DocumentFeatures,
  ExtractedImage,
  ExtractedTable,
  ExtractedEquation,
  ReferenceInfo,
} from "../types";
import {
  safeTeX,
  renderSectionContent,
  renderAbstract,
  renderKeywords,
  renderBibliography,
  buildDocument,
  type LaTeXGenerator,
} from "./base";

const VANCOUVER_PREAMBLE = `\\documentclass[12pt]{article}

% --- Geometry & spacing ---
\\usepackage[margin=1in]{geometry}
\\usepackage{setspace}
\\doublespacing

% --- Fonts ---
\\usepackage{times}

% --- Graphics & math ---
\\usepackage{graphicx}
\\usepackage{amsmath}

% --- Headers & footers ---
\\usepackage{fancyhdr}
\\pagestyle{fancy}
\\fancyhf{}
\\rhead{\\thepage}
\\renewcommand{\\headrulewidth}{0pt}

% --- Misc ---
\\usepackage{indentfirst}
\\usepackage{url}

% --- Title styling ---
\\usepackage{titlesec}
\\titleformat{\\section}{\\normalfont\\bfseries\\large}{\\thesection.}{0.5em}{}
\\titleformat{\\subsection}{\\normalfont\\bfseries\\normalsize}{\\thesubsection.}{0.5em}{}`;

function buildTitlePage(features: DocumentFeatures): string {
  const lines: string[] = [];

  lines.push("\\begin{titlepage}");
  lines.push("\\centering");
  lines.push("\\vspace*{2cm}");
  lines.push("");
  lines.push(`{\\LARGE\\bfseries ${safeTeX(features.title)} \\par}`);
  lines.push("\\vspace{2cm}");

  if (features.authors.length > 0) {
    for (const author of features.authors) {
      lines.push(`{\\large ${safeTeX(author.name)}}`);
      if (author.affiliation) {
        lines.push(`\\\\{\\normalsize ${safeTeX(author.affiliation)}}`);
      }
      if (author.email) {
        lines.push(`\\\\{\\small \\url{${author.email}}}`);
      }
      lines.push("\\vspace{0.5cm}");
    }
  }

  lines.push("\\vfill");
  lines.push(`{\\large \\today}`);
  lines.push("\\end{titlepage}");
  lines.push("\\newpage");

  return lines.join("\n");
}

function buildAbstractPage(features: DocumentFeatures): string {
  const lines: string[] = [];

  lines.push("\\setcounter{page}{1}");
  lines.push("");

  if (features.abstract) {
    lines.push(renderAbstract(features.abstract));
    lines.push("");
  }

  if (features.keywords.length > 0) {
    lines.push(renderKeywords(features.keywords, "Keywords"));
    lines.push("");
  }

  lines.push("\\newpage");
  return lines.join("\n");
}

function formatVancouverRef(ref: ReferenceInfo, _index: number): string {
  const parts: string[] = [];

  if (ref.authors) {
    parts.push(safeTeX(ref.authors));
  }

  if (ref.title) {
    parts.push(safeTeX(ref.title));
  }

  if (ref.venue) {
    parts.push(`\\textit{${safeTeX(ref.venue)}}`);
  }

  const pubDetails: string[] = [];
  if (ref.year) pubDetails.push(safeTeX(ref.year));
  if (ref.volume) {
    let vol = safeTeX(ref.volume);
    if (ref.issue) vol += `(${safeTeX(ref.issue)})`;
    pubDetails.push(vol);
  }
  if (ref.pages) pubDetails.push(safeTeX(ref.pages));
  if (pubDetails.length > 0) {
    parts.push(pubDetails.join(";"));
  }

  if (ref.doi) {
    parts.push(`doi: ${safeTeX(ref.doi)}`);
  }

  return `\\bibitem{${ref.id}} ${parts.join(". ")}.`;
}

function renderSections(
  features: DocumentFeatures,
  images: ExtractedImage[],
  tables: ExtractedTable[],
  equations: ExtractedEquation[]
): string {
  const lines: string[] = [];

  for (const section of features.sections) {
    lines.push(renderSectionContent(section, images, tables, equations));
    lines.push("");
  }

  return lines.join("\n");
}

export class VancouverGenerator implements LaTeXGenerator {
  generate(
    features: DocumentFeatures,
    images: ExtractedImage[],
    tables: ExtractedTable[],
    equations: ExtractedEquation[]
  ): string {
    const bodyParts: string[] = [];

    bodyParts.push(buildTitlePage(features));
    bodyParts.push("");

    bodyParts.push(buildAbstractPage(features));
    bodyParts.push("");

    bodyParts.push(renderSections(features, images, tables, equations));

    if (features.references.length > 0) {
      bodyParts.push("");
      bodyParts.push(
        renderBibliography(features.references, formatVancouverRef)
      );
    }

    return buildDocument(VANCOUVER_PREAMBLE, bodyParts.join("\n"));
  }
}

export default VancouverGenerator;
