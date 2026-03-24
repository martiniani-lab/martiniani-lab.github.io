# Martiniani Lab Website

Source code for [martinianilab.org](https://martinianilab.org). Built with [Astro](https://astro.build/) — a static site generator that produces zero client-side JavaScript by default.

All recurring content (team, publications, news, funding, press, etc.) lives in flat YAML or BibTeX files. To add an entry, append a few lines to the relevant file. The site builds all formatting, layout, grouping, and sorting automatically.

## Quick Start

```bash
npm install          # Install dependencies (Node.js 22+ required)
npm run dev          # Start local dev server (http://localhost:4321)
npm run build        # Build static site to dist/
npm run preview      # Preview the built site
npm run test         # Run tests
```

After any content change, push to `main` and GitHub Actions will build and deploy automatically.

---

## How to Update Content

### Publications

**File:** `src/content/publications/references.bib`
**Pages affected:** `/publications`

Publications are stored as standard BibTeX. Add a new entry anywhere in the file (the site sorts by year automatically). Use `@article` for published papers and `@unpublished` for preprints.

```bibtex
@article{smith2025example,
  title     = {Example Paper Title},
  author    = {Smith, J. and Doe, A. and Martiniani, S.},
  journal   = {Physical Review Letters},
  volume    = {135},
  pages     = {012345},
  year      = {2025},
  doi       = {10.1103/PhysRevLett.135.012345},
  eprint    = {2501.00000},
  note      = {Editor's Suggestion},
  localfile = {papers/prl2025.pdf}
}
```

**Key fields:**
- `eprint` — arXiv ID (generates an arXiv link)
- `doi` — DOI (generates a DOI link)
- `note` — shown as a badge (e.g., "Editor's Suggestion", "Cover article")
- `localfile` — path to a local PDF in `public/pdf/` (generates a PDF link)
- `sortkey` — optional integer for ordering papers within the same year (higher = listed first)

**Auto-sync:** A GitHub Action runs weekly to fetch new papers from Google Scholar and create a PR. Manual edits to `note`, `localfile`, and `sortkey` fields are preserved.

---

### News

**File:** `src/content/news.yaml`
**Pages affected:** `/news` (all items), `/` homepage (latest 7)

Add 2-3 lines at the **top** of the file (entries must be sorted newest-first):

```yaml
- date: 2025-09-25
  text: "CLAMP accepted at NeurIPS 2025."
  link: https://arxiv.org/abs/2506.13717   # optional
```

Markdown links work in the `text` field:
```yaml
- date: 2025-07-01
  text: "New paper in [Nature Communications](https://doi.org/10.1038/...)."
```

**Single source of truth:** The homepage automatically shows the 7 most recent items from this same file. No duplication needed.

---

### Team Members

**File:** `src/content/team.yaml`
**Pages affected:** `/team`, `/` homepage (PI spotlight)

To add a new member, append an entry under the appropriate role section:

```yaml
- name: "Jane Smith"
  role: postdoc          # pi | postdoc | graduate | staff | undergraduate
  image: jane.jpg        # filename in src/assets/images/team/
  title: "Simons Fellow"  # optional
  order: 15              # controls display order within role group
  links:                 # optional
    scholar: "https://scholar.google.com/..."
    github: "https://github.com/..."
```

**Photos:** Drop any photo (any size, any aspect ratio) into `src/assets/images/team/`. Astro automatically crops to square, resizes, compresses, and converts to WebP at build time. No manual image editing needed.

If no photo is available, set `image: ""` — a placeholder silhouette will be shown.

---

### Homepage Research Tiles

**File:** `src/content/highlights.yaml`
**Pages affected:** `/` homepage

Each entry becomes a tile on the homepage grid:

```yaml
- title: "AI for Materials"
  subtitle: "OMatG: Open Materials Generation"
  image: research/mind_pic8.png    # path relative to src/assets/images/
  link: https://arxiv.org/abs/2501.02364
  color: "#6fc3df"                 # optional accent color
```

To change what's featured on the homepage, edit this file. Reorder entries to change tile order.

---

### Alumni

**File:** `src/content/alumni.yaml`
**Pages affected:** `/alumni`

To move someone from active team to alumni:
1. Remove their entry from `team.yaml`
2. Add them to `alumni.yaml`:

```yaml
- category: graduate     # postdoc | graduate | undergraduate | masters | visitor | intern | highschool
  name: "Aaron Shih"
  degree: "Ph.D."
  field: "Physics"
  year: 2025
  institution: "NYU"
  currentPosition: "Postdoc at MIT"   # optional
  linkedin: "https://linkedin.com/in/..."  # optional
```

---

### Funding

**File:** `src/content/funding.yaml`
**Pages affected:** `/funding`

```yaml
- agency: "NSF"
  name: "CAREER: Quantifying the Complexity of Materials Landscapes"
  image: "funding/nsf.jpg"    # path relative to src/assets/images/
  role: "PI"
  years: "2025-2030"
  amount: "$700,000"           # optional
  awardNumber: "2443027"       # optional
  description: "Basin sampling methods for materials discovery."  # optional
```

**Logos:** Drop agency logos into `src/assets/images/funding/`. Any size/format works.

---

### Press Coverage

**File:** `src/content/press.yaml`
**Pages affected:** `/press`

```yaml
- category: newspaper    # cover | editorial | podcast | newspaper
  title: "AI Discovers New Materials"
  source: "New Scientist"
  url: "https://newscientist.com/..."
  image: "press/newscientist.png"   # optional, relative to src/assets/images/
  date: "2025-03-15"               # optional
```

---

### Software

**File:** `src/content/software.yaml`
**Pages affected:** `/software`

```yaml
- name: "FReSCo"
  description: "Fast Reciprocal Space Correlator — O(NlogN) algorithm for inverse design of spectrally-shaped structures."
  url: "https://github.com/martiniani-lab/FReSCo"
  github: "https://github.com/martiniani-lab/FReSCo"
  image: "fresco.jpg"     # optional, relative to src/assets/images/software/
  featured: true           # optional, highlights on the page
  order: 2                 # controls display order
```

---

### Video Gallery

**File:** `src/content/gallery.yaml`
**Pages affected:** `/gallery`

```yaml
- title: "Painting Correlations In Fourier Space"
  youtubeId: "A-CNb0IMXQw"    # the ID from the YouTube URL
  description: "This video won the 2024 APS Gallery of Soft Matter Prize."
```

---

### Teaching

**File:** `src/content/teaching.yaml`
**Pages affected:** `/teaching`

```yaml
- institution: "New York University"
  years: "2022-present"
  courses:
    - name: "Physics of Neural Systems"
      code: "PHYS-GA 2061"
      semesters: "Spring 2023"
```

---

### CV

**File:** `public/pdf/cv.pdf`

Simply replace this file with the updated PDF. No other changes needed — the site links to `/pdf/cv.pdf`.

---

### GEO Content (FAQ, Bio, Research Areas)

**File:** `src/content/geo.yaml`
**Generates:** `public/llms-full.txt` (at build time via `integrations/geo.mjs`)

This is the single source of truth for all Generative Engine Optimization content — FAQ entries, bio text, research area descriptions, and social links. The build integration (`integrations/geo.mjs`) reads this file along with other YAML sources to auto-generate `public/llms-full.txt`.

To add a new FAQ entry:
```yaml
faq:
  - question: "What is X?"
    answer: >
      Description of X with citations and context.
```

**Important:** GEO content (FAQ, narratives) must never appear on visible pages. It lives only in `llms.txt`, `llms-full.txt`, and JSON-LD metadata.

---

### llms.txt (AI Crawler Summary)

**File:** `public/llms.txt`

This is a dense, token-efficient summary of Stefano's research for AI systems (ChatGPT, Perplexity, etc.). Update it when major new results are published or awards are received. Keep the format factual and citation-dense. Can be more assertive than the visible site — this is the primary vehicle for maximizing LLM attention.

---

## How Deployment Works

**On push to `main`:** GitHub Actions (`.github/workflows/deploy.yml`) runs `npm ci && npm run build` and deploys the `dist/` folder to GitHub Pages.

**Weekly publication sync:** GitHub Actions (`.github/workflows/sync-pubs.yml`) runs every Sunday at midnight UTC. It fetches new papers from Google Scholar via `fetch_scholar.py`, updates `references.bib`, and creates a PR for review. You can also trigger it manually from the Actions tab.

---

## Project Structure

```
src/
├── assets/images/          # All images (auto-optimized at build time)
│   ├── team/               # Team photos (any size — auto-cropped)
│   ├── research/           # Research highlight images
│   ├── funding/            # Agency logos
│   ├── press/              # Press/media images
│   └── software/           # Software screenshots
├── components/             # Reusable UI components
├── content/                # All editable content lives here
│   ├── team.yaml
│   ├── news.yaml
│   ├── highlights.yaml
│   ├── alumni.yaml
│   ├── funding.yaml
│   ├── press.yaml
│   ├── software.yaml
│   ├── gallery.yaml
│   ├── teaching.yaml
│   ├── geo.yaml            # GEO content (FAQ, bio, research areas) → feeds llms-full.txt
│   └── publications/
│       └── references.bib
├── layouts/                # Page layout templates
├── lib/                    # TypeScript utilities (BibTeX parser, data loaders)
├── pages/                  # One .astro file per page route
└── styles/                 # CSS (global.css, components.css, layouts.css)
public/
├── pdf/                    # CV and paper PDFs
├── fonts/                  # Self-hosted Source Sans Pro
├── llms.txt                # AI crawler summary (manually edited)
├── llms-full.txt           # Auto-generated at build from geo.yaml + other YAML
├── robots.txt
├── CNAME                   # Custom domain
└── favicon.svg
integrations/
└── geo.mjs                 # Astro build integration: generates llms-full.txt from geo.yaml
scripts/
├── fetch_scholar.py        # Google Scholar sync (primary, uses scholarly + ScraperAPI)
└── sync-publications.py    # Semantic Scholar API sync (legacy fallback)
```

## Content Update Cheat Sheet

| Task | What to do |
|---|---|
| Add a publication | Auto-synced weekly from Google Scholar. Or: add BibTeX entry to `references.bib` |
| Add a news item | Add 2 lines to top of `news.yaml` (date + text) |
| Add a team member | Add entry to `team.yaml` + drop photo in `src/assets/images/team/` |
| Change homepage tiles | Edit `highlights.yaml` |
| Move member to alumni | Cut from `team.yaml`, paste into `alumni.yaml` |
| Add funding | Add entry to `funding.yaml` + drop logo in `src/assets/images/funding/` |
| Add press coverage | Add entry to `press.yaml` |
| Add software | Add entry to `software.yaml` |
| Add video | Add entry to `gallery.yaml` (just need YouTube ID) |
| Update teaching | Add course to `teaching.yaml` |
| Update CV | Replace `public/pdf/cv.pdf` |
| Update AI summary | Edit `public/llms.txt` |
| Add/update GEO FAQ | Edit `src/content/geo.yaml`, rebuild to regenerate `llms-full.txt` |
