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

  lines.push("\\documentclass[conference]{IEEEtran}");
  lines.push("");
  lines.push("\\usepackage{amsmath}");
  lines.push("\\usepackage{amssymb}");
  lines.push("\\usepackage{amsfonts}");
  lines.push("\\usepackage{graphicx}");
  lines.push("\\usepackage{textcomp}");
  lines.push("\\usepackage{cite}");
  lines.push("\\usepackage{url}");

  return lines.join("\n");
}

function buildTitleBlock(features: DocumentFeatures): string {
  const lines: string[] = [];

  lines.push(`\\title{${safeTeX(features.title)}}`);
  lines.push("");

  if (features.authors.length > 0) {
    lines.push("\\author{");

    const authorBlocks = features.authors.map((author) => {
      const parts: string[] = [];
      parts.push(`\\IEEEauthorblockN{${safeTeX(author.name)}}`);

      const affiliationParts: string[] = [];
      if (author.affiliation) {
        affiliationParts.push(safeTeX(author.affiliation));
      }
      if (author.email) {
        affiliationParts.push(safeTeX(author.email));
      }
      if (affiliationParts.length > 0) {
        parts.push(`\\IEEEauthorblockA{${affiliationParts.join(" \\\\ ")}}`);
      }

      return parts.join("\n");
    });

    lines.push(authorBlocks.join("\n\\and\n"));
    lines.push("}");
  }

  lines.push("");
  lines.push("\\maketitle");

  return lines.join("\n");
}

function buildAbstractBlock(features: DocumentFeatures): string {
  const lines: string[] = [];

  if (features.abstract) {
    lines.push(renderAbstract(features.abstract));
  }

  if (features.keywords.length > 0) {
    lines.push("");
    lines.push("\\begin{IEEEkeywords}");
    lines.push(features.keywords.map(safeTeX).join(", "));
    lines.push("\\end{IEEEkeywords}");
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
 * IEEE citation format:
 * [N] Initials. Lastname, "Title," \textit{Journal}, vol. V, no. N, pp. X--Y, Year.
 *
 * References numbered by order of first appearance.
 */
function ieeeRefFormatter(ref: ReferenceInfo, _index: number): string {
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
        .join(" ");
      return `${initials} ${safeTeX(lastName)}`;
    });
    parts.push(formatted.join(", "));
  }

  if (ref.title) {
    parts.push("``" + safeTeX(ref.title) + "''");
  }

  if (ref.venue) {
    parts.push(`\\textit{${safeTeX(ref.venue)}}`);
  }

  if (ref.volume) {
    parts.push(`vol.~${safeTeX(ref.volume)}`);
  }

  if (ref.issue) {
    parts.push(`no.~${safeTeX(ref.issue)}`);
  }

  if (ref.pages) {
    parts.push(`pp.~${safeTeX(ref.pages)}`);
  }

  if (ref.year) {
    parts.push(safeTeX(ref.year));
  }

  if (ref.doi) {
    parts.push(`doi:~${safeTeX(ref.doi)}`);
  }

  return `\\bibitem{${ref.id}} ${parts.join(", ")}.`;
}

function buildReferences(features: DocumentFeatures): string {
  if (!features.references.length) return "";

  return renderBibliography(features.references, ieeeRefFormatter);
}

function buildAcknowledgments(): string {
  return "";
}

export class IEEEGenerator implements LaTeXGenerator {
  generate(
    features: DocumentFeatures,
    images: ExtractedImage[],
    tables: ExtractedTable[],
    equations: ExtractedEquation[]
  ): string {
    const preamble = buildPreamble();

    const bodyParts: string[] = [];

    bodyParts.push(buildTitleBlock(features));
    bodyParts.push("");

    const abstractBlock = buildAbstractBlock(features);
    if (abstractBlock) {
      bodyParts.push(abstractBlock);
      bodyParts.push("");
    }

    const sections = buildSections(features, images, tables, equations);
    if (sections) {
      bodyParts.push(sections);
      bodyParts.push("");
    }

    const acknowledgments = buildAcknowledgments();
    if (acknowledgments) {
      bodyParts.push(acknowledgments);
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

export default IEEEGenerator;
