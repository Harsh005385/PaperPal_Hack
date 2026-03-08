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

function buildPreamble(): string {
  const lines: string[] = [];

  lines.push("\\documentclass[12pt]{article}");
  lines.push("");
  lines.push("\\usepackage[margin=1in]{geometry}");
  lines.push("\\usepackage{setspace}");
  lines.push("\\usepackage{times}");
  lines.push("\\usepackage{graphicx}");
  lines.push("\\usepackage{cite}");
  lines.push("\\usepackage{fancyhdr}");
  lines.push("\\usepackage{indentfirst}");
  lines.push("\\usepackage{url}");
  lines.push("");
  lines.push("\\doublespacing");
  lines.push("");
  lines.push("\\pagestyle{fancy}");
  lines.push("\\fancyhf{}");
  lines.push("\\renewcommand{\\headrulewidth}{0pt}");
  lines.push("\\fancyfoot[C]{\\thepage}");

  return lines.join("\n");
}

function buildTitlePage(features: DocumentFeatures): string {
  const lines: string[] = [];

  lines.push("\\begin{titlepage}");
  lines.push("\\centering");
  lines.push("\\vspace*{2in}");
  lines.push("");
  lines.push(`{\\Large\\bfseries ${safeTeX(features.title)}}\\\\[2em]`);

  if (features.authors.length > 0) {
    for (const author of features.authors) {
      lines.push(`${safeTeX(author.name)}\\\\`);
      if (author.affiliation) {
        lines.push(`${safeTeX(author.affiliation)}\\\\`);
      }
      if (author.email) {
        lines.push(`${safeTeX(author.email)}\\\\`);
      }
      lines.push("[0.5em]");
    }
  }

  lines.push("");
  lines.push("\\vfill");
  lines.push(`\\today`);
  lines.push("\\end{titlepage}");

  return lines.join("\n");
}

function buildAbstractSection(features: DocumentFeatures): string {
  const lines: string[] = [];

  if (features.abstract) {
    lines.push(renderAbstract(features.abstract));
    lines.push("");
  }

  if (features.keywords.length > 0) {
    lines.push(renderKeywords(features.keywords, "Keywords"));
    lines.push("");
  }

  return lines.join("\n");
}

function buildSections(
  features: DocumentFeatures,
  images: ExtractedImage[],
  tables: ExtractedTable[],
  equations: ExtractedEquation[]
): string {
  const lines: string[] = [];

  for (const section of features.sections) {
    lines.push("");
    lines.push(renderSectionContent(section, images, tables, equations));
  }

  return lines.join("\n");
}

/**
 * Harvard citation format:
 * Surname, Initials. Year. Title in sentence case. \textit{Journal}, volume(issue), pages.
 *
 * Author-date style without comma: (Smith 2020).
 * References sorted alphabetically.
 */
function harvardRefFormatter(ref: ReferenceInfo, _index: number): string {
  const parts: string[] = [];

  if (ref.authors) {
    const authorList = ref.authors.split(/,\s*|;\s*|\s+and\s+/);
    const formatted = authorList.map((a) => {
      const tokens = a.trim().split(/\s+/);
      if (tokens.length < 2) return safeTeX(a.trim());
      const lastName = tokens[tokens.length - 1];
      const initials = tokens
        .slice(0, -1)
        .map((t) => t.charAt(0).toUpperCase() + ".")
        .join("");
      return `${safeTeX(lastName)}, ${initials}`;
    });
    parts.push(formatted.join(", "));
  }

  if (ref.year) {
    parts.push(safeTeX(ref.year));
  }

  if (ref.title) {
    parts.push(safeTeX(ref.title));
  }

  const journalParts: string[] = [];
  if (ref.venue) {
    journalParts.push(`\\textit{${safeTeX(ref.venue)}}`);
  }

  if (ref.volume) {
    let volStr = safeTeX(ref.volume);
    if (ref.issue) {
      volStr += `(${safeTeX(ref.issue)})`;
    }
    journalParts.push(volStr);
  }

  if (ref.pages) {
    journalParts.push(`pp.~${safeTeX(ref.pages)}`);
  }

  if (journalParts.length > 0) {
    parts.push(journalParts.join(", "));
  }

  if (ref.doi) {
    parts.push(`doi:~${safeTeX(ref.doi)}`);
  }

  return `\\bibitem{${ref.id}} ${parts.join(". ")}.`;
}

function sortReferencesAlphabetically(
  references: ReferenceInfo[]
): ReferenceInfo[] {
  return [...references].sort((a, b) => {
    const surnameA = extractSurname(a.authors);
    const surnameB = extractSurname(b.authors);
    const cmp = surnameA.localeCompare(surnameB, "en", {
      sensitivity: "base",
    });
    if (cmp !== 0) return cmp;
    return (a.year || "").localeCompare(b.year || "");
  });
}

function extractSurname(authors: string): string {
  if (!authors) return "";
  const first = authors.split(/,|;|\s+and\s+/)[0].trim();
  const tokens = first.split(/\s+/);
  return tokens[tokens.length - 1] || "";
}

function buildReferences(features: DocumentFeatures): string {
  if (!features.references.length) return "";

  const sorted = sortReferencesAlphabetically(features.references);

  const lines: string[] = [];
  lines.push("\\newpage");
  lines.push("\\section*{References}");
  lines.push("");
  lines.push(
    "\\renewcommand{\\section}[2]{}%  suppress thebibliography heading"
  );
  lines.push("");
  lines.push(renderBibliography(sorted, harvardRefFormatter));

  return lines.join("\n");
}

function buildPageBreakAfterTitle(): string {
  return "\\newpage";
}

export class HarvardGenerator implements LaTeXGenerator {
  generate(
    features: DocumentFeatures,
    images: ExtractedImage[],
    tables: ExtractedTable[],
    equations: ExtractedEquation[]
  ): string {
    const preamble = buildPreamble();

    const bodyParts: string[] = [];

    bodyParts.push(buildTitlePage(features));
    bodyParts.push("");
    bodyParts.push(buildPageBreakAfterTitle());
    bodyParts.push("");

    const abstractSection = buildAbstractSection(features);
    if (abstractSection) {
      bodyParts.push(abstractSection);
    }

    const sections = buildSections(features, images, tables, equations);
    if (sections) {
      bodyParts.push(sections);
      bodyParts.push("");
    }

    const references = buildReferences(features);
    if (references) {
      bodyParts.push(references);
    }

    const body = bodyParts.filter(Boolean).join("\n");

    return buildDocument(preamble, body);
  }
}

export default HarvardGenerator;
