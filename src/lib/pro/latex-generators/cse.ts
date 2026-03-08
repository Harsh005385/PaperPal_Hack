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

type CSECitationSystem = "name-year" | "citation-sequence";

const CSE_PREAMBLE = `\\documentclass[12pt]{article}

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

% --- Section styling ---
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

/**
 * CSE Name-Year format:
 * Surname Initials. Year. Title. Journal Name. volume(issue):pages.
 */
function formatCSENameYear(ref: ReferenceInfo, _index: number): string {
  const parts: string[] = [];

  if (ref.authors) {
    parts.push(safeTeX(ref.authors));
  }

  if (ref.year) {
    parts.push(safeTeX(ref.year));
  }

  if (ref.title) {
    parts.push(safeTeX(ref.title));
  }

  if (ref.venue) {
    let venue = `\\textit{${safeTeX(ref.venue)}}`;
    const locator: string[] = [];
    if (ref.volume) {
      let vol = safeTeX(ref.volume);
      if (ref.issue) vol += `(${safeTeX(ref.issue)})`;
      locator.push(vol);
    }
    if (ref.pages) locator.push(safeTeX(ref.pages));
    if (locator.length > 0) {
      venue += `. ${locator.join(":")}`;
    }
    parts.push(venue);
  }

  if (ref.doi) {
    parts.push(`doi: ${safeTeX(ref.doi)}`);
  }

  return `\\bibitem{${ref.id}} ${parts.join(". ")}.`;
}

/**
 * CSE Citation-Sequence format (same structure, references numbered by appearance).
 */
function formatCSESequence(ref: ReferenceInfo, _index: number): string {
  return formatCSENameYear(ref, _index);
}

function sortReferencesNameYear(refs: ReferenceInfo[]): ReferenceInfo[] {
  return [...refs].sort((a, b) => {
    const authorCmp = a.authors.localeCompare(b.authors);
    if (authorCmp !== 0) return authorCmp;
    return a.year.localeCompare(b.year);
  });
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

export class CSEGenerator implements LaTeXGenerator {
  private citationSystem: CSECitationSystem;

  constructor(citationSystem: CSECitationSystem = "name-year") {
    this.citationSystem = citationSystem;
  }

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

      if (this.citationSystem === "name-year") {
        const sorted = sortReferencesNameYear(features.references);
        bodyParts.push(renderBibliography(sorted, formatCSENameYear));
      } else {
        bodyParts.push(
          renderBibliography(features.references, formatCSESequence)
        );
      }
    }

    return buildDocument(CSE_PREAMBLE, bodyParts.join("\n"));
  }
}

export default CSEGenerator;
