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

const ACS_PREAMBLE = `\\documentclass[12pt]{article}

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
\\titleformat{\\subsection}{\\normalfont\\bfseries\\normalsize}{\\thesubsection.}{0.5em}{}

% --- ACS superscript citation command ---
\\newcommand{\\acscite}[1]{\\textsuperscript{#1}}`;

function buildTitleBlock(features: DocumentFeatures): string {
  const lines: string[] = [];

  lines.push("\\begin{center}");
  lines.push(`{\\LARGE\\bfseries ${safeTeX(features.title)} \\par}`);
  lines.push("\\vspace{1cm}");

  if (features.authors.length > 0) {
    const authorEntries: string[] = [];
    for (const author of features.authors) {
      let entry = `{\\large ${safeTeX(author.name)}}`;
      if (author.affiliation) {
        entry += `\\\\{\\normalsize\\itshape ${safeTeX(author.affiliation)}}`;
      }
      if (author.email) {
        entry += `\\\\{\\small \\url{${author.email}}}`;
      }
      authorEntries.push(entry);
    }
    lines.push(authorEntries.join("\n\\vspace{0.4cm}\n"));
  }

  lines.push("\\vspace{1cm}");
  lines.push("\\end{center}");

  return lines.join("\n");
}

function buildAbstractBlock(features: DocumentFeatures): string {
  const lines: string[] = [];

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
 * ACS reference format:
 * Surname, Initials. Title. \textit{Abbrev. J. Name} \textbf{Year}, volume, pages.
 */
function formatACSRef(ref: ReferenceInfo, _index: number): string {
  const parts: string[] = [];

  if (ref.authors) {
    parts.push(safeTeX(ref.authors));
  }

  if (ref.title) {
    parts.push(safeTeX(ref.title));
  }

  const journalParts: string[] = [];
  if (ref.venue) {
    journalParts.push(`\\textit{${safeTeX(ref.venue)}}`);
  }
  if (ref.year) {
    journalParts.push(`\\textbf{${safeTeX(ref.year)}}`);
  }
  if (ref.volume) {
    journalParts.push(`\\textit{${safeTeX(ref.volume)}}`);
  }
  if (ref.pages) {
    journalParts.push(safeTeX(ref.pages));
  }
  if (journalParts.length > 0) {
    parts.push(journalParts.join(", "));
  }

  if (ref.doi) {
    parts.push(`DOI: ${safeTeX(ref.doi)}`);
  }

  return `\\bibitem{${ref.id}} ${parts.join(". ")}.`;
}

const ACS_SECTION_ORDER = [
  "Abstract",
  "Introduction",
  "Experimental Methods",
  "Experimental",
  "Methods",
  "Results",
  "Results and Discussion",
  "Discussion",
  "Conclusion",
  "Conclusions",
  "Acknowledgments",
  "Acknowledgements",
  "Supporting Information",
];

function sectionSortKey(heading: string): number {
  const normalised = heading.trim().toLowerCase();
  const idx = ACS_SECTION_ORDER.findIndex(
    (s) => s.toLowerCase() === normalised
  );
  return idx === -1 ? ACS_SECTION_ORDER.length : idx;
}

function renderSections(
  features: DocumentFeatures,
  images: ExtractedImage[],
  tables: ExtractedTable[],
  equations: ExtractedEquation[]
): string {
  const sorted = [...features.sections].sort(
    (a, b) => sectionSortKey(a.heading) - sectionSortKey(b.heading)
  );

  const lines: string[] = [];
  for (const section of sorted) {
    lines.push(renderSectionContent(section, images, tables, equations));
    lines.push("");
  }

  return lines.join("\n");
}

export class ACSGenerator implements LaTeXGenerator {
  generate(
    features: DocumentFeatures,
    images: ExtractedImage[],
    tables: ExtractedTable[],
    equations: ExtractedEquation[]
  ): string {
    const bodyParts: string[] = [];

    bodyParts.push(buildTitleBlock(features));
    bodyParts.push("");

    bodyParts.push(buildAbstractBlock(features));
    bodyParts.push("");

    bodyParts.push(renderSections(features, images, tables, equations));

    if (features.references.length > 0) {
      bodyParts.push("");
      bodyParts.push(renderBibliography(features.references, formatACSRef));
    }

    return buildDocument(ACS_PREAMBLE, bodyParts.join("\n"));
  }
}

export default ACSGenerator;
