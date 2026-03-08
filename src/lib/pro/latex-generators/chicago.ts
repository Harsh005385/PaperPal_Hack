import type {
  DocumentFeatures,
  ExtractedImage,
  ExtractedTable,
  ExtractedEquation,
  ReferenceInfo,
  SectionInfo,
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

import {
  renderImage,
  renderTable,
  renderEquation,
} from "./base";

function formatChicagoFootnote(ref: ReferenceInfo): string {
  const parts: string[] = [];

  if (ref.authors) {
    parts.push(safeTeX(ref.authors));
  }

  if (ref.title) {
    parts.push(`"${safeTeX(ref.title)}"`);
  }

  if (ref.venue) {
    let venueStr = `\\textit{${safeTeX(ref.venue)}}`;
    if (ref.volume) {
      venueStr += ` ${safeTeX(ref.volume)}`;
    }
    if (ref.year) {
      venueStr += ` (${safeTeX(ref.year)})`;
    }
    if (ref.pages) {
      venueStr += `: ${safeTeX(ref.pages)}`;
    }
    parts.push(venueStr);
  }

  if (ref.doi) {
    parts.push(`\\url{https://doi.org/${safeTeX(ref.doi)}}`);
  }

  return parts.join(", ");
}

function formatChicagoBibEntry(ref: ReferenceInfo, _index: number): string {
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
      venueStr += ` ${safeTeX(ref.volume)}`;
    }
    if (ref.year) {
      venueStr += ` (${safeTeX(ref.year)})`;
    }
    if (ref.pages) {
      venueStr += `: ${safeTeX(ref.pages)}`;
    }
    venueStr += ".";
    parts.push(venueStr);
  }

  if (ref.doi) {
    parts.push(`\\url{https://doi.org/${safeTeX(ref.doi)}}`);
  }

  return `\\bibitem{${ref.id}} ${parts.join(" ")}`;
}

function renderChicagoSectionWithFootnotes(
  section: SectionInfo,
  images: ExtractedImage[],
  tables: ExtractedTable[],
  equations: ExtractedEquation[],
  references: ReferenceInfo[],
  footnoteCounter: { value: number }
): string {
  const lines: string[] = [];

  const headingCmd =
    section.level === 1
      ? "\\section"
      : section.level === 2
        ? "\\subsection"
        : "\\subsubsection";

  lines.push(`${headingCmd}{${safeTeX(section.heading)}}`);

  if (section.content) {
    let paragraphs = section.content.split(/\n\s*\n/).filter(Boolean);
    if (paragraphs.length <= 1 && section.content.length > 300) {
      paragraphs = section.content.split(/\n/).filter((p) => p.trim().length > 0);
    }
    for (const para of paragraphs) {
      lines.push("");
      let text = safeTeX(para.trim());

      const citationPattern = /\(([^)]+?,\s*\d{4})\)/g;
      text = text.replace(citationPattern, (_match, inner: string) => {
        const citeParts = inner.split(",").map((s: string) => s.trim());
        const authorPart = citeParts[0] || "";
        const yearPart = citeParts[1] || "";

        const matchedRef = references.find(
          (r) =>
            r.authors.includes(authorPart) &&
            r.year === yearPart
        );

        if (matchedRef) {
          footnoteCounter.value++;
          return `\\footnote{${formatChicagoFootnote(matchedRef)}}`;
        }
        return `\\footnote{${safeTeX(authorPart)}, ${safeTeX(yearPart)}}`;
      });

      lines.push(text);
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

function buildChicagoPreamble(features: DocumentFeatures): string {
  const lines: string[] = [];

  lines.push("\\documentclass[12pt]{article}");
  lines.push("");
  lines.push("% ─── Chicago Manual of Style Packages ───");
  lines.push("\\usepackage[margin=1in]{geometry}");
  lines.push("\\usepackage{setspace}");
  lines.push("\\usepackage{times}");
  lines.push("\\usepackage{graphicx}");
  lines.push("\\usepackage{fancyhdr}");
  lines.push("\\usepackage{indentfirst}");
  lines.push("\\usepackage[bottom]{footmisc}");
  lines.push("\\usepackage{url}");
  lines.push("\\usepackage{hyperref}");
  lines.push("");
  lines.push("% ─── Chicago Spacing ───");
  lines.push("\\doublespacing");
  lines.push("\\setlength{\\parindent}{0.5in}");
  lines.push("");
  lines.push("% ─── Page Style ───");
  lines.push("\\pagestyle{fancy}");
  lines.push("\\fancyhf{}");
  lines.push("\\rhead{\\thepage}");
  lines.push("\\renewcommand{\\headrulewidth}{0pt}");
  lines.push("");
  lines.push("% ─── Footnote formatting ───");
  lines.push("\\renewcommand{\\footnoterule}{%");
  lines.push("  \\kern -3pt");
  lines.push("  \\hrule width 2in height 0.4pt");
  lines.push("  \\kern 2.6pt");
  lines.push("}");
  lines.push("\\renewcommand{\\thefootnote}{\\arabic{footnote}}");
  lines.push("\\setlength{\\footnotesep}{\\baselineskip}");
  lines.push("");
  lines.push("% ─── Section number depth off for cleaner headings ───");
  lines.push("\\setcounter{secnumdepth}{0}");
  lines.push("");
  lines.push("% ─── Title setup ───");
  lines.push("\\title{" + safeTeX(features.title) + "}");
  lines.push("");

  if (features.authors.length > 0) {
    const authorNames = features.authors
      .map((a) => safeTeX(a.name))
      .join(" \\\\ ");
    const affiliations = features.authors
      .filter((a) => a.affiliation)
      .map((a) => safeTeX(a.affiliation!));
    const uniqueAffiliations = [...new Set(affiliations)];

    lines.push("\\author{" + authorNames);
    if (uniqueAffiliations.length > 0) {
      lines.push("  \\\\ \\vspace{0.5em}");
      lines.push("  \\small " + uniqueAffiliations.join(" \\\\ \\small "));
    }
    lines.push("}");
  } else {
    lines.push("\\author{}");
  }

  lines.push("\\date{}");

  return lines.join("\n");
}

function buildChicagoBody(
  features: DocumentFeatures,
  images: ExtractedImage[],
  tables: ExtractedTable[],
  equations: ExtractedEquation[]
): string {
  const lines: string[] = [];

  lines.push("% ─── Title Page ───");
  lines.push("\\begin{titlepage}");
  lines.push("\\begin{center}");
  lines.push("\\vspace*{2in}");
  lines.push("{\\Large " + safeTeX(features.title) + "}");
  lines.push("");
  lines.push("\\vspace{1in}");

  if (features.authors.length > 0) {
    for (const author of features.authors) {
      lines.push(safeTeX(author.name) + " \\\\");
      if (author.affiliation) {
        lines.push(safeTeX(author.affiliation) + " \\\\");
      }
    }
  }

  lines.push("");
  lines.push("\\vspace{0.5in}");
  lines.push("\\today");
  lines.push("\\end{center}");
  lines.push("\\end{titlepage}");
  lines.push("");

  if (features.abstract) {
    lines.push("% ─── Abstract ───");
    lines.push("\\section*{\\centering Abstract}");
    lines.push("");
    lines.push("\\noindent " + safeTeX(features.abstract));
    lines.push("");
  }

  if (features.keywords.length > 0) {
    lines.push(renderKeywords(features.keywords, "Keywords"));
    lines.push("");
  }

  if (features.sections.length > 0) {
    lines.push("% ─── Body Sections with Footnote Citations ───");
    lines.push("");

    const footnoteCounter = { value: 0 };

    for (const section of features.sections) {
      lines.push(
        renderChicagoSectionWithFootnotes(
          section,
          images,
          tables,
          equations,
          features.references,
          footnoteCounter
        )
      );
      lines.push("");
    }
  }

  if (features.references.length > 0) {
    lines.push("% ─── Bibliography (Chicago Format) ───");
    lines.push("\\newpage");
    lines.push("\\begin{center}");
    lines.push("\\textbf{Bibliography}");
    lines.push("\\end{center}");
    lines.push("");
    lines.push("\\setlength{\\bibhang}{0.5in}");
    lines.push("\\setlength{\\bibsep}{\\baselineskip}");
    lines.push("");
    lines.push(
      renderBibliography(features.references, formatChicagoBibEntry)
    );
  }

  return lines.join("\n");
}

export class ChicagoGenerator implements LaTeXGenerator {
  generate(
    features: DocumentFeatures,
    images: ExtractedImage[],
    tables: ExtractedTable[],
    equations: ExtractedEquation[]
  ): string {
    const preamble = buildChicagoPreamble(features);
    const body = buildChicagoBody(features, images, tables, equations);
    return buildDocument(preamble, body);
  }
}

export default ChicagoGenerator;
