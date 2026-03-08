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

function formatAPAAuthorBlock(features: DocumentFeatures): string {
  const lines: string[] = [];

  lines.push("\\title{\\textbf{" + safeTeX(features.title) + "}}");
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
      lines.push("  \\\\ \\vspace{0.3em}");
      lines.push("  " + uniqueAffiliations.join(" \\\\ "));
    }
    lines.push("}");
  } else {
    lines.push("\\author{}");
  }

  lines.push("\\date{}");
  return lines.join("\n");
}

function formatAPAReference(ref: ReferenceInfo, _index: number): string {
  const parts: string[] = [];

  if (ref.authors) {
    parts.push(safeTeX(ref.authors));
  }

  if (ref.year) {
    parts.push(`(${safeTeX(ref.year)})`);
  }

  if (ref.title) {
    parts.push(`${safeTeX(ref.title)}.`);
  }

  if (ref.venue) {
    let venueStr = `\\textit{${safeTeX(ref.venue)}}`;
    if (ref.volume) {
      venueStr += `, \\textit{${safeTeX(ref.volume)}}`;
      if (ref.issue) {
        venueStr += `(${safeTeX(ref.issue)})`;
      }
    }
    if (ref.pages) {
      venueStr += `, ${safeTeX(ref.pages)}`;
    }
    venueStr += ".";
    parts.push(venueStr);
  }

  if (ref.doi) {
    parts.push(`\\url{https://doi.org/${safeTeX(ref.doi)}}`);
  }

  return `\\bibitem{${ref.id}} ${parts.join(" ")}`;
}

function buildAPAPreamble(features: DocumentFeatures): string {
  const lines: string[] = [];

  lines.push("\\documentclass[12pt]{article}");
  lines.push("");
  lines.push("% ─── APA 7th Edition Packages ───");
  lines.push("\\usepackage[margin=1in]{geometry}");
  lines.push("\\usepackage{setspace}");
  lines.push("\\usepackage{times}");
  lines.push("\\usepackage{graphicx}");
  lines.push("\\usepackage{cite}");
  lines.push("\\usepackage{fancyhdr}");
  lines.push("\\usepackage{titlesec}");
  lines.push("\\usepackage{indentfirst}");
  lines.push("\\usepackage{url}");
  lines.push("\\usepackage{hyperref}");
  lines.push("");
  lines.push("% ─── APA Spacing ───");
  lines.push("\\doublespacing");
  lines.push("\\setlength{\\parindent}{0.5in}");
  lines.push("");
  lines.push("% ─── Page Style: page numbers top-right ───");
  lines.push("\\pagestyle{fancy}");
  lines.push("\\fancyhf{}");
  lines.push("\\rhead{\\thepage}");
  lines.push("\\renewcommand{\\headrulewidth}{0pt}");
  lines.push("");
  lines.push("% ─── APA Heading Styles ───");
  lines.push("% Level 1: centered, bold");
  lines.push(
    "\\titleformat{\\section}{\\normalfont\\normalsize\\bfseries\\filcenter}{\\thesection.}{0.5em}{}"
  );
  lines.push("% Level 2: left-aligned, bold");
  lines.push(
    "\\titleformat{\\subsection}{\\normalfont\\normalsize\\bfseries}{\\thesubsection.}{0.5em}{}"
  );
  lines.push("% Level 3: left-aligned, bold italic");
  lines.push(
    "\\titleformat{\\subsubsection}{\\normalfont\\normalsize\\bfseries\\itshape}{\\thesubsubsection.}{0.5em}{}"
  );
  lines.push("");
  lines.push("\\titlespacing*{\\section}{0pt}{1em}{0.5em}");
  lines.push("\\titlespacing*{\\subsection}{0pt}{1em}{0.5em}");
  lines.push("\\titlespacing*{\\subsubsection}{0pt}{1em}{0.5em}");
  lines.push("");

  lines.push(formatAPAAuthorBlock(features));

  return lines.join("\n");
}

function buildAPABody(
  features: DocumentFeatures,
  images: ExtractedImage[],
  tables: ExtractedTable[],
  equations: ExtractedEquation[]
): string {
  const lines: string[] = [];

  lines.push("% ─── Title Page ───");
  lines.push("\\maketitle");
  lines.push("\\thispagestyle{fancy}");
  lines.push("");

  if (features.abstract) {
    lines.push("% ─── Abstract ───");
    lines.push("\\newpage");
    lines.push(
      "\\section*{\\centering Abstract}"
    );
    lines.push("\\addcontentsline{toc}{section}{Abstract}");
    lines.push("");
    lines.push("\\noindent " + safeTeX(features.abstract));
    lines.push("");

    if (features.keywords.length > 0) {
      lines.push(
        renderKeywords(features.keywords, "\\textit{Keywords}")
      );
      lines.push("");
    }
  }

  if (features.sections.length > 0) {
    lines.push("% ─── Body Sections ───");
    lines.push("\\newpage");
    lines.push("");

    for (const section of features.sections) {
      lines.push(
        renderSectionContent(section, images, tables, equations, "\\section")
      );
      lines.push("");
    }
  }

  if (features.references.length > 0) {
    lines.push("% ─── References (APA Format) ───");
    lines.push("\\newpage");
    lines.push(
      "\\section*{\\centering References}"
    );
    lines.push("\\addcontentsline{toc}{section}{References}");
    lines.push("");
    lines.push("\\setlength{\\bibhang}{0.5in}");
    lines.push("\\setlength{\\bibsep}{\\baselineskip}");
    lines.push("");
    lines.push(renderBibliography(features.references, formatAPAReference));
  }

  return lines.join("\n");
}

export class APAGenerator implements LaTeXGenerator {
  generate(
    features: DocumentFeatures,
    images: ExtractedImage[],
    tables: ExtractedTable[],
    equations: ExtractedEquation[]
  ): string {
    const preamble = buildAPAPreamble(features);
    const body = buildAPABody(features, images, tables, equations);
    return buildDocument(preamble, body);
  }
}

export default APAGenerator;
