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
  lines.push("\\usepackage{amsmath}");
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
  lines.push("");
  lines.push("% AMA uses superscript numeric citations");
  lines.push("\\newcommand{\\amacite}[1]{\\textsuperscript{#1}}");

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
    const authorNames = features.authors
      .map((a) => safeTeX(a.name))
      .join(", ");
    lines.push(`${authorNames}\\\\[1em]`);

    const affiliations = features.authors
      .filter((a) => a.affiliation)
      .map((a) => safeTeX(a.affiliation!));
    const unique = [...new Set(affiliations)];
    if (unique.length > 0) {
      lines.push(`${unique.join(" \\\\ ")}\\\\[1em]`);
    }

    const emails = features.authors
      .filter((a) => a.email)
      .map((a) => safeTeX(a.email!));
    if (emails.length > 0) {
      lines.push(`${emails.join(", ")}\\\\`);
    }
  }

  lines.push("");
  lines.push("\\vfill");
  lines.push("\\today");
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
    lines.push(renderKeywords(features.keywords, "Key Words"));
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
 * AMA citation format:
 * AuthorInitials (no periods). Title. Abbreviated Journal. Year;Volume(Issue):Pages.
 *
 * Superscript numbers in text via \textsuperscript{N}.
 * References numbered by order of first appearance.
 */
function amaRefFormatter(ref: ReferenceInfo, _index: number): string {
  const parts: string[] = [];

  if (ref.authors) {
    const authorList = ref.authors.split(/,\s*|;\s*|\s+and\s+/);
    const formatted = authorList.map((a) => {
      const tokens = a.trim().split(/\s+/);
      if (tokens.length < 2) return safeTeX(a.trim());
      const lastName = tokens[tokens.length - 1];
      const initials = tokens
        .slice(0, -1)
        .map((t) => t.charAt(0).toUpperCase())
        .join("");
      return `${safeTeX(lastName)} ${initials}`;
    });

    if (formatted.length <= 6) {
      parts.push(formatted.join(", "));
    } else {
      parts.push(formatted.slice(0, 3).join(", ") + ", et al");
    }
  }

  if (ref.title) {
    parts.push(safeTeX(ref.title));
  }

  if (ref.venue) {
    parts.push(`\\textit{${safeTeX(ref.venue)}}`);
  }

  const pubDetail: string[] = [];
  if (ref.year) {
    pubDetail.push(safeTeX(ref.year));
  }

  let volIssuePages = "";
  if (ref.volume) {
    volIssuePages += safeTeX(ref.volume);
  }
  if (ref.issue) {
    volIssuePages += `(${safeTeX(ref.issue)})`;
  }
  if (ref.pages) {
    volIssuePages += `:${safeTeX(ref.pages)}`;
  }

  if (pubDetail.length > 0 && volIssuePages) {
    parts.push(`${pubDetail.join("")};${volIssuePages}`);
  } else if (pubDetail.length > 0) {
    parts.push(pubDetail.join(""));
  } else if (volIssuePages) {
    parts.push(volIssuePages);
  }

  if (ref.doi) {
    parts.push(`doi:${safeTeX(ref.doi)}`);
  }

  return `\\bibitem{${ref.id}} ${parts.join(". ")}.`;
}

function buildReferences(features: DocumentFeatures): string {
  if (!features.references.length) return "";

  const lines: string[] = [];
  lines.push("\\newpage");
  lines.push("\\section*{References}");
  lines.push("");
  lines.push(
    "\\renewcommand{\\section}[2]{}%  suppress thebibliography heading"
  );
  lines.push("");
  lines.push(renderBibliography(features.references, amaRefFormatter));

  return lines.join("\n");
}

function buildPageBreak(): string {
  return "\\newpage";
}

export class AMAGenerator implements LaTeXGenerator {
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
    bodyParts.push(buildPageBreak());
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

export default AMAGenerator;
