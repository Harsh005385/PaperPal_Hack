export interface ExtractedImage {
  id: string;
  pageIndex: number;
  dataUrl: string;
  width: number;
  height: number;
  caption?: string;
}

export interface ExtractedTable {
  id: string;
  pageIndex: number;
  rows: string[][];
  caption?: string;
}

export interface ExtractedEquation {
  id: string;
  pageIndex: number;
  raw: string;
  latex?: string;
}

export interface PageContent {
  pageNumber: number;
  text: string;
}

export interface ExtractedPDF {
  text: string;
  pages: PageContent[];
  images: ExtractedImage[];
  tables: ExtractedTable[];
  equations: ExtractedEquation[];
  fileName: string;
  pageCount: number;
}

export interface AuthorInfo {
  name: string;
  affiliation?: string;
  email?: string;
}

export interface SectionInfo {
  level: number;
  heading: string;
  content: string;
  figures: string[];
  tables: string[];
  equations: string[];
}

export interface ReferenceInfo {
  id: string;
  authors: string;
  title: string;
  venue: string;
  year: string;
  pages?: string;
  volume?: string;
  issue?: string;
  doi?: string;
}

export interface DocumentFeatures {
  title: string;
  authors: AuthorInfo[];
  abstract: string;
  keywords: string[];
  sections: SectionInfo[];
  references: ReferenceInfo[];
  metadata: {
    paperType: string;
    field: string;
  };
}

export type FormatId =
  | "apa"
  | "mla"
  | "ieee"
  | "chicago"
  | "harvard"
  | "ama"
  | "vancouver"
  | "acs"
  | "cse";
