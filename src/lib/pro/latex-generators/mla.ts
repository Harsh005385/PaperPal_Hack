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

function getLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] || fullName;
}

function formatMLAFirstPageHeader(features: DocumentFeatures): string {
  const lines: string[] = [];

  const authorName =
    features.authors.length > 0 ? safeTeX(features.authors[0].name) : "Author";
  const lastName = features.authors.length > 0
    ? safeTeX(getLastName(features.authors[0].name))
    : "Author";

  lines.push("% ─── MLA First-Page Header (no title page) ───");
  lines.push("\\noindent " + authorName + " \\\\");
  lines.push("\\noindent Instructor Name \\\\");
  lines.push("\\noindent Course Title \\\\");
  lines.push("\\noindent \\today");
  lines.push("");
  lines.push(
    "\\begin{center}" +
      safeTeX(features.title) +
      "\\end{center}"
  );

  return lines.join("\n");
}

function formatMLAReference(ref: ReferenceInfo, _index: number): string {
  const parts: string[] = [];

  if (ref.authors) {
    const authorNames = ref.authors.split(",");
    if (authorNames.length > 0) {
      const first = authorNames[0].trim();
      const nameParts = first.split(/\s+/);
      if (nameParts.length >= 2) {
        const lastName = nameParts[nameParts.length - 1];
        const firstNames = nameParts.slice(0, -1).join(" ");
        parts.push(`${safeTeX(lastName)}, ${safeTeX(firstNames)}`);
      } else {
        parts.push(safeTeX(first));
      }
    }
  }

  if (ref.title) {
    parts.push(`"${safeTeX(ref.title)}."`);
  }

  if (ref.venue) {
    let venueStr = `\\textit{${safeTeX(ref.venue)}}`;
    if (ref.volume) {
      venueStr += `, vol. ${safeTeX(ref.volume)}`;
    }
    if (ref.issue) {
      venueStr += `, no. ${safeTeX(ref.issue)}`;
    }
    if (ref.year) {
      venueStr += `, ${safeTeX(ref.year)}`;
    }
    if (ref.pages) {
      venueStr += `, pp. ${safeTeX(ref.pages)}`;
    }
    venueStr += ".";
    parts.push(venueStr);
  }

  if (ref.doi) {
    parts.push(`\\url{https://doi.org/${safeTeX(ref.doi)}}`);
  }

  return `\\bibitem{${ref.id}} ${parts.join(" ")}`;
}

function buildMLAPreamble(features: DocumentFeatures): string {
  const lines: string[] = [];

  const lastName = features.authors.length > 0
    ? safeTeX(getLastName(features.authors[0].name))
    : "Author";

  lines.push("\\documentclass[12pt]{article}");
  lines.push("");
  lines.push("% ─── MLA 9th Edition Packages ───");
  lines.push("\\usepackage[margin=1in]{geometry}");
  lines.push("\\usepackage{setspace}");
  lines.push("\\usepackage{times}");
  lines.push("\\usepackage{graphicx}");
  lines.push("\\usepackage{fancyhdr}");
  lines.push("\\usepackage{indentfirst}");
  lines.push("\\usepackage{url}");
  lines.push("\\usepackage{hyperref}");
  lines.push("\\usepackage{hanging}");
  lines.push("");
  lines.push("% ─── MLA Spacing ───");
  lines.push("\\doublespacing");
  lines.push("\\setlength{\\parindent}{0.5in}");
  lines.push("");
  lines.push("% ─── Page Style: author last name + page number top-right ───");
  lines.push("\\pagestyle{fancy}");
  lines.push("\\fancyhf{}");
  lines.push("\\rhead{" + lastName + " \\thepage}");
  lines.push("\\renewcommand{\\headrulewidth}{0pt}");
  lines.push("");
  lines.push("% ─── MLA: no section numbering ───");
  lines.push("\\setcounter{secnumdepth}{0}");
  lines.push("");
  lines.push("% ─── Remove default title command ───");
  lines.push("\\title{}");
  lines.push("\\author{}");
  lines.push("\\date{}");

  return lines.join("\n");
}

function buildMLABody(
  features: DocumentFeatures,
  images: ExtractedImage[],
  tables: ExtractedTable[],
  equations: ExtractedEquation[]
): string {
  const lines: string[] = [];

  lines.push("\\thispagestyle{fancy}");
  lines.push("");
  lines.push(formatMLAFirstPageHeader(features));
  lines.push("");

  if (features.abstract) {
    lines.push("% ─── Abstract (not standard MLA, but included if present) ───");
    lines.push("\\section*{Abstract}");
    lines.push("");
    lines.push("\\noindent " + safeTeX(features.abstract));
    lines.push("");
  }

  if (features.keywords.length > 0) {
    lines.push(renderKeywords(features.keywords, "Keywords"));
    lines.push("");
  }

  if (features.sections.length > 0) {
    lines.push("% ─── Body Sections ───");
    lines.push("");

    for (const section of features.sections) {
      lines.push(
        renderSectionContent(section, images, tables, equations, "\\section")
      );
      lines.push("");
    }
  }

  if (features.references.length > 0) {
    lines.push("% ─── Works Cited (MLA Format) ───");
    lines.push("\\newpage");
    lines.push("\\begin{center}");
    lines.push("Works Cited");
    lines.push("\\end{center}");
    lines.push("");
    lines.push("\\setlength{\\bibhang}{0.5in}");
    lines.push("\\setlength{\\bibsep}{\\baselineskip}");
    lines.push("");
    lines.push(renderBibliography(features.references, formatMLAReference));
  }

  return lines.join("\n");
}

export class MLAGenerator implements LaTeXGenerator {
  generate(
    features: DocumentFeatures,
    images: ExtractedImage[],
    tables: ExtractedTable[],
    equations: ExtractedEquation[]
  ): string {
    const preamble = buildMLAPreamble(features);
    const body = buildMLABody(features, images, tables, equations);
    return buildDocument(preamble, body);
  }
}

export default MLAGenerator;
