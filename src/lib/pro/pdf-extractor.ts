import { getDocumentProxy, extractText } from "unpdf";
import type {
  ExtractedPDF,
  ExtractedImage,
  ExtractedTable,
  ExtractedEquation,
  PageContent,
} from "./types";

export async function extractPDF(
  buffer: ArrayBuffer,
  fileName: string
): Promise<ExtractedPDF> {
  const uint8 = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(uint8);

  const pages: PageContent[] = [];
  const allText: string[] = [];
  const images: ExtractedImage[] = [];
  const tables: ExtractedTable[] = [];
  const equations: ExtractedEquation[] = [];

  let imageCounter = 0;
  let tableCounter = 0;
  let equationCounter = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);

    const textContent = await page.getTextContent();
    const items = textContent.items
      .filter((item) => "str" in item)
      .map((item) => {
        const t = item as unknown as { str: string; transform: number[]; width: number; height: number };
        return { str: t.str, transform: t.transform, width: t.width || 0, height: t.height || 0 };
      });

    const pageText = items.map((item) => item.str).join(" ");
    pages.push({ pageNumber: i, text: pageText });
    allText.push(pageText);

    const detectedTables = detectTables(items, i);
    for (const table of detectedTables) {
      tableCounter++;
      tables.push({ ...table, id: `table-${tableCounter}` });
    }

    const detectedEquations = detectEquations(pageText, i);
    for (const eq of detectedEquations) {
      equationCounter++;
      equations.push({ ...eq, id: `eq-${equationCounter}` });
    }

    try {
      const ops = await page.getOperatorList();
      const pdfjs = await import("unpdf/pdfjs");

      for (let j = 0; j < ops.fnArray.length; j++) {
        const OPS_MAP = pdfjs.OPS as Record<string, number>;
        if (
          ops.fnArray[j] === OPS_MAP.paintImageXObject ||
          ops.fnArray[j] === OPS_MAP.paintJpegXObject ||
          ops.fnArray[j] === OPS_MAP.paintXObject
        ) {
          const imgName = ops.argsArray[j]?.[0];
          if (!imgName) continue;

          try {
            const imgData = await page.objs.get(imgName);
            if (!imgData || !("width" in imgData) || !("height" in imgData)) continue;

            const w = imgData.width as number;
            const h = imgData.height as number;
            if (w < 20 || h < 20) continue;

            imageCounter++;
            let dataUrl = "";

            if ("data" in imgData && imgData.data) {
              const rawData = imgData.data as Uint8ClampedArray;
              const kind = ("kind" in imgData ? imgData.kind : 1) as number;
              dataUrl = rgbaToDataUrl(rawData, w, h, kind);
            }

            images.push({
              id: `img-${imageCounter}`,
              pageIndex: i,
              dataUrl,
              width: w,
              height: h,
              caption: findNearbyCaption(pageText, imageCounter),
            });
          } catch {
            // individual image extraction may fail
          }
        }
      }
    } catch {
      // operator list extraction may fail on some pages
    }
  }

  const { text: mergedText } = await extractText(pdf, { mergePages: true });

  return {
    text: mergedText || allText.join("\n\n"),
    pages,
    images,
    tables,
    equations,
    fileName,
    pageCount: pdf.numPages,
  };
}

function rgbaToDataUrl(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  kind: number
): string {
  const channels = kind === 2 ? 1 : kind === 3 ? 3 : 4;

  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + pixelDataSize;
  const bmp = new Uint8Array(fileSize);

  bmp[0] = 0x42; bmp[1] = 0x4D;
  bmp[2] = fileSize & 0xff; bmp[3] = (fileSize >> 8) & 0xff;
  bmp[4] = (fileSize >> 16) & 0xff; bmp[5] = (fileSize >> 24) & 0xff;
  bmp[10] = 54;

  bmp[14] = 40;
  bmp[18] = width & 0xff; bmp[19] = (width >> 8) & 0xff;
  bmp[20] = (width >> 16) & 0xff; bmp[21] = (width >> 24) & 0xff;
  bmp[22] = height & 0xff; bmp[23] = (height >> 8) & 0xff;
  bmp[24] = (height >> 16) & 0xff; bmp[25] = (height >> 24) & 0xff;
  bmp[26] = 1;
  bmp[28] = 24;
  bmp[34] = pixelDataSize & 0xff; bmp[35] = (pixelDataSize >> 8) & 0xff;
  bmp[36] = (pixelDataSize >> 16) & 0xff; bmp[37] = (pixelDataSize >> 24) & 0xff;

  for (let y = 0; y < height; y++) {
    const bmpRow = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * channels;
      const dstIdx = 54 + bmpRow * rowSize + x * 3;

      let r: number, g: number, b: number;
      if (channels === 1) {
        r = g = b = data[srcIdx];
      } else if (channels === 3) {
        r = data[srcIdx]; g = data[srcIdx + 1]; b = data[srcIdx + 2];
      } else {
        r = data[srcIdx]; g = data[srcIdx + 1]; b = data[srcIdx + 2];
      }

      bmp[dstIdx] = b;
      bmp[dstIdx + 1] = g;
      bmp[dstIdx + 2] = r;
    }
  }

  let binary = "";
  for (let i = 0; i < bmp.length; i++) {
    binary += String.fromCharCode(bmp[i]);
  }
  return `data:image/bmp;base64,${btoa(binary)}`;
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

function detectTables(
  items: TextItem[],
  pageIndex: number
): Omit<ExtractedTable, "id">[] {
  const tables: Omit<ExtractedTable, "id">[] = [];

  const yPositions = items.map((item) => Math.round(item.transform[5]));
  const uniqueYs = [...new Set(yPositions)].sort((a, b) => b - a);

  const rowGroups: Map<number, TextItem[]> = new Map();
  for (let i = 0; i < items.length; i++) {
    const y = Math.round(items[i].transform[5]);
    if (!rowGroups.has(y)) rowGroups.set(y, []);
    rowGroups.get(y)!.push(items[i]);
  }

  let consecutiveAlignedRows = 0;
  let tableRows: string[][] = [];
  let prevColCount = 0;

  for (const y of uniqueYs) {
    const rowItems = rowGroups.get(y)!;
    if (rowItems.length < 2) {
      if (consecutiveAlignedRows >= 3 && tableRows.length >= 3) {
        const caption = findTableCaption(items, y);
        tables.push({ pageIndex, rows: [...tableRows], caption });
      }
      consecutiveAlignedRows = 0;
      tableRows = [];
      prevColCount = 0;
      continue;
    }

    const sorted = rowItems.sort(
      (a, b) => a.transform[4] - b.transform[4]
    );
    const cols = sorted.map((item) => item.str.trim()).filter(Boolean);

    if (prevColCount === 0 || Math.abs(cols.length - prevColCount) <= 1) {
      consecutiveAlignedRows++;
      tableRows.push(cols);
      prevColCount = cols.length;
    } else {
      if (consecutiveAlignedRows >= 3 && tableRows.length >= 3) {
        const caption = findTableCaption(items, y);
        tables.push({ pageIndex, rows: [...tableRows], caption });
      }
      consecutiveAlignedRows = 1;
      tableRows = [cols];
      prevColCount = cols.length;
    }
  }

  if (consecutiveAlignedRows >= 3 && tableRows.length >= 3) {
    tables.push({ pageIndex, rows: tableRows });
  }

  return tables;
}

function detectEquations(
  text: string,
  pageIndex: number
): Omit<ExtractedEquation, "id">[] {
  const equations: Omit<ExtractedEquation, "id">[] = [];

  const patterns = [
    /\$\$([^$]+)\$\$/g,
    /\\\[([^\]]+)\\\]/g,
    /\\begin\{equation\}([\s\S]*?)\\end\{equation\}/g,
    /\\begin\{align\}([\s\S]*?)\\end\{align\}/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      equations.push({
        pageIndex,
        raw: match[0],
        latex: match[1]?.trim(),
      });
    }
  }

  const mathPatterns =
    /(?:^|\s)((?:[A-Za-z]\s*[=<>≤≥±∓≈≡∝∞∑∏∫∂∇√]+\s*[\w\d\s+\-*/^().,{}[\]]+){2,})/gm;
  let match;
  while ((match = mathPatterns.exec(text)) !== null) {
    const raw = match[1].trim();
    if (raw.length > 5 && raw.length < 500) {
      equations.push({ pageIndex, raw });
    }
  }

  return equations;
}

function findNearbyCaption(
  pageText: string,
  figureNumber: number
): string | undefined {
  const patterns = [
    new RegExp(`Fig\\.?\\s*${figureNumber}[.:]?\\s*([^.]+\\.?)`, "i"),
    new RegExp(`Figure\\s*${figureNumber}[.:]?\\s*([^.]+\\.?)`, "i"),
  ];
  for (const p of patterns) {
    const m = pageText.match(p);
    if (m) return m[0].trim();
  }
  return undefined;
}

function findTableCaption(
  items: TextItem[],
  nearY: number
): string | undefined {
  const nearby = items
    .filter((item) => Math.abs(Math.round(item.transform[5]) - nearY) < 30)
    .map((item) => item.str)
    .join(" ");

  const m = nearby.match(/Table\s*\d+[.:]?\s*([^.]+\.?)/i);
  return m ? m[0].trim() : undefined;
}
