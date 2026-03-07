# PaperPal

**One-click research paper formatting, powered by open-source LLMs.**

Upload a `.docx`, `.txt`, or `.tex` file, pick a citation style, and get a publication-ready LaTeX PDF in under a minute. No manual formatting. No copy-pasting into Overleaf. No fighting with margins at 3 AM.

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
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)
- [Team](#team)

---

## Why PaperPal?

Every student has been there — the paper is done, the content is solid, but now you need to reformat it for APA. Or IEEE. Or Vancouver. Manually adjusting margins, citation styles, heading levels, and reference lists eats hours that could go toward actual research.

PaperPal fixes this. Drop in your document, select a format, and the system produces LaTeX output that follows the exact typographic and structural rules of your chosen style. The generated PDF is ready to submit.

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

Each format has a dedicated master prompt that describes the exact visual and structural expectations — fonts, spacing, heading hierarchy, citation mechanics, reference list formatting. The LLM doesn't guess. It follows a specification.

---

## Architecture

```
                              ┌──────────────────────┐
                              │   Next.js Frontend    │
                              │   (React 19 + SSR)    │
                              └──────────┬───────────┘
                                         │
                          ┌──────────────┼──────────────┐
                          ▼              ▼              ▼
                   ┌────────────┐ ┌────────────┐ ┌────────────┐
                   │ /api/parse │ │/api/convert│ │ /api/auth  │
                   │  Document  │ │   LaTeX    │ │  MongoDB   │
                   │  Parser    │ │ Generator  │ │  JWT Auth  │
                   └─────┬──────┘ └─────┬──────┘ └────────────┘
                         │              │
                         │              ▼
                         │     ┌─────────────────┐
                         │     │   Token Pool     │
                         │     │  (round-robin)   │
                         │     │  5 HF API keys   │
                         │     └────────┬────────┘
                         │              │
                         ▼              ▼
                  ┌─────────────┐ ┌──────────────────────────┐
                  │   Mammoth   │ │  HuggingFace Inference   │
                  │  .docx/.txt │ │  Qwen 72B ─▶ Llama 70B  │
                  │  /.tex      │ │  ─▶ Qwen Coder 32B      │
                  └─────────────┘ │  ─▶ Mixtral 8x7B        │
                                  │  ─▶ Gemma 2 2B          │
                                  └──────────┬───────────────┘
                                             │
                                             ▼
                                  ┌──────────────────────┐
                                  │  LaTeX Assembly      │
                                  │  Preamble + Sections  │
                                  │  + Code-based Refs    │
                                  └──────────┬───────────┘
                                             │
                                             ▼
                                  ┌──────────────────────┐
                                  │  Browser Preview     │
                                  │  + Save as PDF       │
                                  └──────────────────────┘
```

### Key Design Decisions

- **Token round-robin** — 5 HuggingFace API tokens are rotated to avoid per-token rate limits. If a token gets rate-limited (429) or a model returns 503, the pool automatically moves to the next token and model tier.

- **Model fallback chain** — Qwen 72B is tried first for best quality. If unavailable, it falls through Llama 3.3 70B, Qwen Coder 32B, Mixtral 8x7B, and finally Gemma 2 2B.

- **Code-based references** — References and bibliography entries are parsed and formatted programmatically, not by the LLM. This eliminates hallucinated citations entirely.

- **Chunked processing** — Long documents are split into ~2000-character chunks and processed in parallel batches of 3, then stitched together into a single LaTeX document.

- **Anti-hallucination guards** — Strict grounding rules are injected into every prompt. The LLM reformats existing content without inventing text, fake authors, or placeholder references.

- **JWT + MongoDB auth** — Users sign up with first name, last name, email, and password. Passwords are hashed with bcrypt. Sessions are managed via JWT tokens stored in httpOnly cookies and localStorage.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 15](https://nextjs.org/) (App Router, React 19) |
| Language | TypeScript 5.7 |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/) |
| Animations | [Framer Motion](https://motion.dev/) |
| Icons | [Lucide React](https://lucide.dev/) |
| Document Parsing | [Mammoth](https://github.com/mwilliamson/mammoth.js) (DOCX to text) |
| LLM Inference | [HuggingFace Inference API](https://huggingface.co/docs/api-inference/) |
| Database | [MongoDB Atlas](https://www.mongodb.com/atlas) via [Mongoose](https://mongoosejs.com/) |
| Auth | [JWT](https://jwt.io/) + [bcryptjs](https://github.com/dcodeIO/bcrypt.js) |
| PDF Generation | Browser print dialog (Save as PDF) |

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.x ([download](https://nodejs.org/))
- **npm** >= 9.x (comes with Node)
- **HuggingFace API tokens** — free tier works ([create tokens here](https://huggingface.co/settings/tokens))
- **MongoDB Atlas cluster** — free tier works ([create one here](https://www.mongodb.com/atlas))

### Installation

```bash
git clone https://github.com/your-username/PaperPal.git
cd PaperPal
npm install
```

### Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# HuggingFace tokens (use 1-5, more = fewer rate limits)
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
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For production:

```bash
npm run build
npm start
```

---

## How It Works

1. **Pick a format** — Choose from 10 citation styles. Each tile shows the full name, typical fields, and a citation example.

2. **Upload your document** — Drag and drop a `.docx`, `.txt`, or `.tex` file. The server extracts the title, abstract, body sections, and references.

3. **AI conversion** — Extracted text is chunked and sent to HuggingFace LLMs via Server-Sent Events. You see real-time progress — which model is processing, which chunk, overall percentage.

4. **LaTeX assembly** — Preamble is generated first (document class, packages, formatting commands for the chosen style). Body chunks are converted next. References are formatted by code, not by the LLM.

5. **Preview and edit** — Split-pane editor: raw LaTeX on the left, rendered preview on the right. Toggle between code-only, preview-only, or split view.

6. **Download as PDF** — Opens a print-ready view. Browser's "Save as PDF" produces the final file.

---

## Project Structure

```
PaperPal/
├── public/
│   └── favicon.svg
├── images/                          # Demo screenshots
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── route.ts         # Unified signin/signup
│   │   │   │   ├── me/route.ts      # Token verification
│   │   │   │   └── logout/route.ts  # Cookie clear
│   │   │   ├── convert/route.ts     # LaTeX generation (SSE)
│   │   │   └── parse/route.ts       # Document parsing
│   │   ├── auth/page.tsx            # Sign in / Sign up page
│   │   ├── editor/page.tsx          # LaTeX editor + preview
│   │   ├── formats/page.tsx         # Format selection
│   │   ├── upload/page.tsx          # File upload
│   │   ├── page.tsx                 # Landing page
│   │   ├── globals.css
│   │   └── layout.tsx               # Root layout + AuthProvider
│   ├── components/
│   │   ├── GlowCard.tsx
│   │   ├── Navbar.tsx               # Nav with user menu + logout
│   │   ├── PageTransition.tsx
│   │   └── TextReveal.tsx
│   ├── context/
│   │   └── AuthContext.tsx           # Auth state + JWT management
│   └── lib/
│       ├── constants.ts             # Format definitions
│       ├── db.ts                    # MongoDB connection
│       ├── jwt.ts                   # JWT helpers
│       ├── models.ts                # LLM configs + master prompts
│       ├── token-pool.ts            # HF token rotation
│       └── user.ts                  # User schema + bcrypt
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Roadmap

- [x] Multi-model LLM pipeline with round-robin token distribution
- [x] 10 citation formats (APA, MLA, Chicago, Harvard, IEEE, AMA, Vancouver, ACS, CSE, Custom)
- [x] Format-specific master prompts for accurate LaTeX generation
- [x] Real-time SSE progress tracking
- [x] Anti-hallucination grounding rules
- [x] Code-based reference formatting
- [x] Split-pane LaTeX editor with live preview
- [x] PDF export via browser print
- [x] MongoDB + JWT authentication with bcrypt
- [ ] Figure and table extraction from DOCX
- [ ] Server-side LaTeX compilation for direct PDF download
- [ ] Batch conversion (multiple papers)
- [ ] Custom format builder UI

---

## Team

Built during a hackathon by a team of 5. Each member contributed a HuggingFace API token to the shared pool — that's how the multi-token architecture was born.

<!--
| Name | Role | GitHub |
|------|------|--------|
| Member 1 | Frontend / UI | [@handle](https://github.com/handle) |
| Member 2 | LLM Pipeline | [@handle](https://github.com/handle) |
| Member 3 | Document Parsing | [@handle](https://github.com/handle) |
| Member 4 | Prompt Engineering | [@handle](https://github.com/handle) |
| Member 5 | Integration / Testing | [@handle](https://github.com/handle) |
-->

---

## License

This project is for academic and educational use. See [LICENSE](./LICENSE) for details.
