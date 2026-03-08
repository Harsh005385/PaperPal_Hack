# PaperPal

**Instant academic paper formatting — powered by LLMs and rule-based LaTeX generation.**

Upload a research paper, pick a citation style, and get a publication-ready LaTeX PDF. Two pipelines: a fast LLM-driven converter for `.docx`/`.txt`/`.tex` files, and a **Pro pipeline** that parses PDFs with layout-aware extraction and generates LaTeX through pure rule-based code — zero hallucination.

---

## Screenshots

### Landing Page
![Landing Page](./images/hero.png)

### Format Selection
![Format Selection](./images/formats.png)

### Upload Your Paper
![Upload](./images/upload_paper.png)

### Split-Pane Editor with Live Preview
![Editor](./images/split_Screen.png)

### PDF Download
![Download PDF](./images/download_pdf.png)

---

## Table of Contents

- [Why PaperPal?](#why-paperpal)
- [Supported Formats](#supported-formats)
- [Two Pipelines](#two-pipelines)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Team](#team)

---

## Why PaperPal?

Every researcher has been there — the paper is done, the content is solid, but reformatting for APA, IEEE, or Vancouver eats hours. Adjusting margins, citation styles, heading levels, and reference lists manually is tedious work that has nothing to do with actual research.

PaperPal automates this entirely. Drop in your document, select a format, and the system produces LaTeX output that follows the exact typographic and structural rules of your chosen style. The generated PDF is ready to submit.

---

## Supported Formats

| Format | Full Name | Typical Fields |
|--------|-----------|---------------|
| **APA** | American Psychological Association (7th ed.) | Psychology, Education, Social Sciences |
| **MLA** | Modern Language Association (9th ed.) | Humanities, Literature, Arts |
| **Chicago** | Chicago Manual of Style (Notes & Bibliography) | History, Publishing, General Academic |
| **Harvard** | Harvard Referencing | Business, Social Sciences, General Use |
| **IEEE** | IEEE Conference / Journal | Engineering, Computer Science, Electronics |
| **AMA** | American Medical Association | Medicine, Health, Biological Sciences |
| **Vancouver** | Vancouver (ICMJE) | Biomedical Journals, Clinical Research |
| **ACS** | American Chemical Society | Chemistry, Biochemistry, Materials Science |
| **CSE** | Council of Science Editors | Biology, Earth Sciences, Natural Sciences |
| **Custom** | User-Defined | Any — define your own rules |

Each format has a dedicated master prompt describing the exact visual and structural expectations — fonts, spacing, heading hierarchy, citation mechanics, reference list formatting.

---

## Two Pipelines

### Standard Pipeline
Upload `.docx`, `.txt`, or `.tex` files. The LLM converts your content into LaTeX for the selected format via Server-Sent Events with real-time progress tracking.

### Pro Pipeline (PDF-to-LaTeX)
Upload a PDF research paper. The system:
1. **Extracts content** — text, images, tables, and equations using `unpdf` + `pdfjs-dist`
2. **Analyzes structure with AI** — sends extracted text to an LLM to identify title, authors, abstract, sections, references, and metadata as structured JSON
3. **Generates LaTeX with rules** — passes the structured JSON to one of 9 format-specific rule-based LaTeX generators (pure TypeScript, zero LLM calls, zero hallucination)
4. **Compiles to PDF** — sends the LaTeX to TeXLive.net's free API and returns a compiled PDF

The Pro pipeline is completely isolated from the standard pipeline — separate routes, separate pages, separate code.

---

## Architecture

```
                               ┌───────────────────────────┐
                               │     Next.js Frontend       │
                               │     (React 19 + SSR)       │
                               └─────────────┬─────────────┘
                                             │
                ┌────────────────────────────┼────────────────────────────┐
                │            STANDARD        │           PRO              │
                ▼                            │           ▼                │
    ┌───────────────────┐                    │  ┌─────────────────┐      │
    │  /api/parse        │                    │  │ /api/pro/parse   │      │
    │  Mammoth (.docx)   │                    │  │ unpdf (PDF)      │      │
    │  + .txt / .tex     │                    │  │ Images + Tables  │      │
    └────────┬──────────┘                    │  │ + Equations      │      │
             │                               │  └────────┬────────┘      │
             ▼                               │           ▼               │
    ┌───────────────────┐                    │  ┌─────────────────┐      │
    │  /api/convert      │                    │  │ /api/pro/extract │      │
    │  SSE streaming     │                    │  │ LLM → JSON       │      │
    │  LLM → LaTeX       │                    │  │ (Edge, SSE)      │      │
    │  (Edge runtime)    │                    │  └────────┬────────┘      │
    └────────┬──────────┘                    │           ▼               │
             │                               │  ┌─────────────────┐      │
             │                               │  │ Rule-Based       │      │
             │                               │  │ LaTeX Generators │      │
             │                               │  │ (9 formats, TS)  │      │
             │                               │  └────────┬────────┘      │
             │                               │           ▼               │
             │                               │  ┌─────────────────┐      │
             │                               │  │ /api/pro/compile │      │
             │                               │  │ TeXLive.net API  │      │
             │                               │  │ LaTeX → PDF      │      │
             │                               │  └────────┬────────┘      │
             ▼                               │           ▼               │
    ┌──────────────────────────────────────────────────────────────────┐
    │                    Browser Preview + PDF Download                 │
    └──────────────────────────────────────────────────────────────────┘

    ┌───────────────┐    ┌──────────────────────────────────┐
    │  Token Pool    │    │  HuggingFace Inference API        │
    │  5 HF tokens   │───▶│  Qwen 72B → Llama 70B → Mixtral  │
    │  Round-robin   │    │  → Qwen Coder 32B → Gemma 2B     │
    └───────────────┘    └──────────────────────────────────┘

    ┌───────────────┐    ┌───────────────┐
    │  MongoDB Atlas │    │  JWT + bcrypt  │
    │  User accounts │    │  httpOnly auth │
    └───────────────┘    └───────────────┘
```

### Key Design Decisions

- **Token round-robin** — 5 HuggingFace API tokens rotate to avoid per-token rate limits. Rate-limited (429) or unavailable (503) tokens automatically cycle to the next.

- **Model fallback chain** — Qwen 72B → Llama 3.3 70B → Qwen Coder 32B → Mixtral 8x7B → Gemma 2 2B. Best quality is tried first, with automatic fallback.

- **Rule-based LaTeX generation (Pro)** — Each of the 9 citation formats has a dedicated TypeScript generator (150–340 lines each) encoding the exact formatting rules. No LLM is involved in LaTeX code generation — eliminating hallucinated citations, duplicate content, and formatting errors.

- **Code-based references** — References and bibliography entries are parsed and formatted programmatically in both pipelines.

- **Anti-hallucination guards** — Strict grounding rules are injected into every LLM prompt. The LLM reformats existing content without inventing text, fake authors, or placeholder references.

- **Edge runtime for streaming** — The `/api/convert` and `/api/pro/extract` routes use the Vercel Edge runtime, enabling SSE streaming without the 10-second Node.js timeout limit.

- **JSON repair** — The Pro pipeline includes a `repairTruncatedJSON()` function that can fix common LLM output issues (unclosed strings, unbalanced braces) and a full fallback parser for when JSON parsing fails entirely.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 15](https://nextjs.org/) (App Router, React 19) |
| Language | TypeScript 5.7 |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/) |
| Animations | [Framer Motion](https://motion.dev/) |
| Icons | [Lucide React](https://lucide.dev/) |
| Document Parsing | [Mammoth](https://github.com/mwilliamson/mammoth.js) (DOCX), [unpdf](https://github.com/nicolo-ribaudo/unpdf) (PDF) |
| PDF Content Extraction | unpdf + pdfjs-dist (text, images, tables, equations) |
| LLM Inference | [HuggingFace Inference API](https://huggingface.co/docs/api-inference/) |
| LaTeX Compilation | [TeXLive.net](https://texlive.net/) (free, no API key) |
| Database | [MongoDB Atlas](https://www.mongodb.com/atlas) via [Mongoose](https://mongoosejs.com/) |
| Auth | [JWT](https://jwt.io/) + [bcryptjs](https://github.com/dcodeIO/bcrypt.js) |
| Deployment | [Vercel](https://vercel.com/) |

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.x ([download](https://nodejs.org/))
- **npm** >= 9.x (comes with Node)
- **HuggingFace API tokens** — free tier works ([create tokens here](https://huggingface.co/settings/tokens))
- **MongoDB Atlas cluster** — free tier works ([create one here](https://www.mongodb.com/atlas))

### Installation

```bash
git clone https://github.com/davesohamm/PaperPal_Hack.git
cd PaperPal_Hack
npm install
```

### Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# HuggingFace tokens (1-5, more = fewer rate limits)
HF_TOKEN_1=hf_your_first_token
HF_TOKEN_2=hf_your_second_token
HF_TOKEN_3=hf_your_third_token
HF_TOKEN_4=hf_your_fourth_token
HF_TOKEN_5=hf_your_fifth_token

# MongoDB connection string
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/paperpal

# JWT secret (any random string, 32+ characters)
JWT_SECRET=your-secret-key-here
```

**HuggingFace token setup:**

1. Go to [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Create a **Fine-grained** token
3. Check **"Make calls to Inference Providers"**
4. Copy and paste into `.env.local`

The system works with as few as 1 token, but rate limits will be hit more often.

**MongoDB Atlas setup:**

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Add a database user with read/write access
3. Whitelist your IP (or `0.0.0.0/0` for dev)
4. Copy the connection string, replace `<db_password>`, append `/paperpal`

### Running Locally

```bash
# On Windows, increase memory for large builds:
$env:NODE_OPTIONS="--max-old-space-size=4096"; npm run dev

# On macOS/Linux:
NODE_OPTIONS="--max-old-space-size=4096" npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For production build:

```bash
npm run build
npm start
```

---

## How It Works

### Standard Pipeline

1. **Pick a format** — Choose from 10 citation styles on the formats page
2. **Upload your document** — Drag and drop a `.docx`, `.txt`, or `.tex` file
3. **AI conversion** — Text is chunked and sent to HuggingFace LLMs via SSE streaming with real-time progress
4. **LaTeX assembly** — Preamble is generated first, body chunks are converted, references are formatted by code (not LLM)
5. **Preview and download** — Split-pane editor with raw LaTeX on the left, rendered preview on the right

### Pro Pipeline (PDF input)

1. **Upload PDF** at `/pro/upload` — select target format, upload your source PDF
2. **PDF parsing** — `unpdf` + `pdfjs-dist` extracts text per page, detects images (with pixel data), tables (heuristic column alignment), and equations (regex pattern matching)
3. **AI structure extraction** — Extracted text is sent to the LLM to produce a compact structured JSON: title, authors, abstract, keywords, sections, references, metadata
4. **Section enrichment** — The LLM's compact summaries are enriched with full text from the original extraction by matching section headings back to the source
5. **Rule-based LaTeX generation** — The appropriate format generator (e.g., `ieee.ts`, `apa.ts`) converts the structured features into complete, compilable LaTeX — no LLM involved
6. **Compilation** — LaTeX is sent to TeXLive.net's free API, which returns a compiled PDF
7. **Editor** — Split view with editable LaTeX code, PDF preview, download buttons for both `.tex` and `.pdf`

---

## Project Structure

```
PaperPal_Hack/
├── public/
│   └── favicon.svg
├── images/                              # Demo screenshots
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/                    # Authentication routes
│   │   │   │   ├── route.ts             # Unified auth endpoint
│   │   │   │   ├── signin/route.ts      # Sign in
│   │   │   │   ├── signup/route.ts      # Sign up
│   │   │   │   ├── me/route.ts          # Token verification
│   │   │   │   └── logout/route.ts      # Cookie clear
│   │   │   ├── parse/route.ts           # Document parsing (Mammoth)
│   │   │   ├── convert/route.ts         # LLM LaTeX generation (Edge, SSE)
│   │   │   └── pro/                     # Pro pipeline API
│   │   │       ├── parse/route.ts       # PDF extraction (Node runtime)
│   │   │       ├── extract/route.ts     # LLM feature extraction (Edge, SSE)
│   │   │       └── compile/route.ts     # LaTeX → PDF via TeXLive.net (Edge)
│   │   ├── auth/page.tsx                # Sign in / Sign up
│   │   ├── formats/page.tsx             # Format selection grid
│   │   ├── upload/page.tsx              # File upload (standard)
│   │   ├── custom-format/page.tsx       # Custom format builder
│   │   ├── editor/page.tsx              # LaTeX editor + preview (standard)
│   │   ├── pro/
│   │   │   ├── upload/page.tsx          # PDF upload + format selection (Pro)
│   │   │   └── editor/page.tsx          # LaTeX editor + compiled PDF (Pro)
│   │   ├── page.tsx                     # Landing page
│   │   ├── layout.tsx                   # Root layout + AuthProvider
│   │   └── globals.css                  # Global styles
│   ├── components/
│   │   ├── Navbar.tsx                   # Navigation with Pro badge + user menu
│   │   ├── GlowCard.tsx                 # Animated card component
│   │   ├── PageTransition.tsx           # Route transition wrapper
│   │   └── TextReveal.tsx               # Animated text reveal
│   ├── context/
│   │   └── AuthContext.tsx              # Auth state + JWT management
│   └── lib/
│       ├── constants.ts                 # Format definitions + UI config
│       ├── db.ts                        # MongoDB connection (lazy init)
│       ├── jwt.ts                       # JWT sign/verify helpers
│       ├── models.ts                    # LLM model configs + format prompts
│       ├── token-pool.ts               # HF token rotation + fallback
│       ├── user.ts                      # User schema + bcrypt
│       └── pro/                         # Pro pipeline library
│           ├── types.ts                 # Shared interfaces
│           ├── pdf-extractor.ts         # PDF → text/images/tables/equations
│           ├── llm-prompts.ts           # Structured extraction prompts
│           └── latex-generators/        # Rule-based LaTeX generators
│               ├── base.ts             # Shared utilities (escapeTeX, tables, figures, equations)
│               ├── index.ts            # Generator registry
│               ├── apa.ts             # APA 7th Edition
│               ├── mla.ts             # MLA 9th Edition
│               ├── ieee.ts            # IEEE Conference
│               ├── chicago.ts         # Chicago Manual of Style
│               ├── harvard.ts         # Harvard Referencing
│               ├── ama.ts             # AMA
│               ├── vancouver.ts       # Vancouver
│               ├── acs.ts             # ACS
│               └── cse.ts            # CSE
├── .env.example                        # Environment variable template
├── .gitignore
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import the repository on [vercel.com](https://vercel.com)
3. Add environment variables in Project Settings → Environment Variables:
   - `HF_TOKEN_1` through `HF_TOKEN_5`
   - `MONGODB_URI`
   - `JWT_SECRET`
4. Deploy — Vercel handles the build automatically

The Edge runtime routes (`/api/convert`, `/api/pro/extract`, `/api/pro/compile`) bypass Vercel's 10-second Node.js timeout, enabling long-running SSE streams.

---

## Roadmap

- [x] Multi-model LLM pipeline with round-robin token distribution
- [x] 10 citation formats (APA, MLA, Chicago, Harvard, IEEE, AMA, Vancouver, ACS, CSE, Custom)
- [x] Format-specific master prompts for accurate LaTeX generation
- [x] Real-time SSE progress tracking
- [x] Anti-hallucination grounding rules
- [x] Code-based reference formatting (no LLM for bibliography)
- [x] Split-pane LaTeX editor with live preview
- [x] MongoDB + JWT authentication with bcrypt
- [x] **Pro pipeline: PDF input with layout-aware extraction**
- [x] **Rule-based LaTeX generators (9 formats, zero LLM hallucination)**
- [x] **TeXLive.net integration for server-side PDF compilation**
- [x] **PDF image, table, and equation extraction**
- [x] **Section enrichment from full extracted text**
- [x] **Truncated JSON repair + fallback parser**
- [x] Vercel deployment with Edge runtime for streaming
- [ ] Batch conversion (multiple papers)
- [ ] Custom format builder UI
- [ ] Full image embedding in compiled PDFs
- [ ] Export to Overleaf with one click

---

## Team

Built during a hackathon by a team of 5.

---

## License

This project is for academic and educational use. See [LICENSE](./LICENSE) for details.
