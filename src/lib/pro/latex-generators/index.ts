import type { FormatId, DocumentFeatures, ExtractedImage, ExtractedTable, ExtractedEquation } from "../types";
import type { LaTeXGenerator } from "./base";
import { APAGenerator } from "./apa";
import { MLAGenerator } from "./mla";
import { ChicagoGenerator } from "./chicago";
import { IEEEGenerator } from "./ieee";
import { HarvardGenerator } from "./harvard";
import { AMAGenerator } from "./ama";
import { VancouverGenerator } from "./vancouver";
import { ACSGenerator } from "./acs";
import { CSEGenerator } from "./cse";

const GENERATORS: Record<FormatId, LaTeXGenerator> = {
  apa: new APAGenerator(),
  mla: new MLAGenerator(),
  chicago: new ChicagoGenerator(),
  ieee: new IEEEGenerator(),
  harvard: new HarvardGenerator(),
  ama: new AMAGenerator(),
  vancouver: new VancouverGenerator(),
  acs: new ACSGenerator(),
  cse: new CSEGenerator(),
};

export function generateLaTeX(
  formatId: FormatId,
  features: DocumentFeatures,
  images: ExtractedImage[],
  tables: ExtractedTable[],
  equations: ExtractedEquation[]
): string {
  const generator = GENERATORS[formatId];
  if (!generator) {
    throw new Error(`Unknown format: ${formatId}`);
  }
  return generator.generate(features, images, tables, equations);
}

export { GENERATORS };
export type { LaTeXGenerator };
