# ✍️ Text-to-Handwriting Website — Professional Prompt Roadmap

> **Role Prompt (Use this at the start of EVERY session):**
>
> *"You are a professional software engineer with 10+ years of experience building scalable, production-grade web applications. You specialize in React, Node.js, TypeScript, and modern frontend architecture. You write clean, modular, and maintainable code following SOLID principles, separation of concerns, and industry best practices. You think in systems — not just features. Every decision you make considers performance, scalability, accessibility, and developer experience. You never cut corners on architecture."*

---

## Architecture Overview

```
text-to-handwriting/
├── frontend/                  # React + Vite + TypeScript + Tailwind
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── features/          # Feature-based modules (handwriting, export, settings)
│   │   ├── hooks/             # Custom React hooks
│   │   ├── utils/             # Pure utility functions
│   │   ├── types/             # Global TypeScript types
│   │   └── store/             # Zustand global state
├── backend/                   # Node.js + Express + TypeScript (optional)
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   └── middleware/
└── shared/                    # Shared types between frontend & backend
```

---

## Phase 1 — Project Scaffolding & Architecture Setup

**Goal:** Initialize a clean, scalable project structure with all tooling configured.

### 🟦 Prompt 1.1 — Project Init

```
You are a professional software engineer with 10+ years of experience building scalable,
production-grade web applications.

Scaffold a full-stack Text-to-Handwriting web app with the following stack:
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS v3
- State management: Zustand
- Linting: ESLint + Prettier with strict TypeScript rules
- Folder structure: feature-based (not file-type-based)
- Path aliases: @components, @features, @hooks, @utils, @types, @store

Output:
1. The complete folder structure with file names
2. vite.config.ts with path aliases
3. tsconfig.json with strict mode
4. tailwind.config.ts with custom theme placeholder
5. .eslintrc and .prettierrc configs

Do not generate placeholder lorem ipsum content. Every file should have purposeful starter code.
```

### 🟦 Prompt 1.2 — Design System Tokens

```
You are a professional software engineer with 10+ years of experience building scalable,
production-grade web applications.

Set up a design system foundation for the Text-to-Handwriting app using Tailwind CSS.

Define custom tokens in tailwind.config.ts for:
- Colors: primary (ink blue), surface (paper cream/white), neutral, accent, error
- Typography: font families for UI (Inter) and handwriting preview (system fallback)
- Spacing scale: consistent 4px base grid
- Border radius: soft, rounded card aesthetic
- Box shadows: subtle paper elevation effects

Also create a /src/styles/globals.css with:
- CSS custom properties mirroring the Tailwind tokens
- Base resets
- Smooth scrolling and focus-visible styles

Output clean, well-commented code only.
```

---

## Phase 2 — Core Handwriting Engine

**Goal:** Build the heart of the app — the canvas/SVG renderer that makes text look handwritten.

### 🟨 Prompt 2.1 — Handwriting Renderer Hook

```
You are a professional software engineer with 10+ years of experience building scalable,
production-grade web applications.

Build a custom React hook called `useHandwritingRenderer` that accepts the following inputs:
- text: string
- fontFamily: string (handwriting font name)
- inkColor: string (hex)
- fontSize: number
- lineSpacing: number
- letterVariation: number (0-1, controls randomness)
- paperType: 'lined' | 'blank' | 'grid' | 'dotted'

The hook should:
1. Use an HTML5 Canvas ref to render the text
2. Apply subtle per-character randomness in: size (±2px), rotation (±1.5deg), y-offset (±2px)
   to simulate natural human handwriting variation
3. Respect line breaks and auto-wrap text to fit the canvas width
4. Return: { canvasRef, regenerate, isRendering }

Rules:
- Written in TypeScript with full type safety
- Pure logic — no UI, no styling inside the hook
- The randomness must be seedable (accept optional `seed: number`) for reproducibility
- Use requestAnimationFrame for smooth rendering on large text
```

### 🟨 Prompt 2.2 — Paper Background Component

```
You are a professional software engineer with 10+ years of experience building scalable,
production-grade web applications.

Create a React component called `<PaperCanvas />` that:
1. Renders an SVG or Canvas paper background based on `paperType` prop:
   - 'lined': horizontal rules every 32px, faint blue (#c8d8e8)
   - 'blank': off-white (#faf8f4) background, subtle texture via CSS noise filter
   - 'grid': 20px grid, faint gray
   - 'dotted': 20px dot grid

2. Accepts a `children` prop to overlay the handwriting canvas on top

3. Has a realistic paper shadow/elevation using box-shadow

4. Is fully responsive — scales correctly on mobile and desktop

5. Accepts `pageSize` prop: 'A4' | 'Letter' | 'Square'

Component must be:
- TypeScript typed with exported prop interface `PaperCanvasProps`
- Styled with Tailwind only (no inline styles except dynamic values)
- Accessible: proper ARIA roles for the visual document region
```

### 🟨 Prompt 2.3 — Font Loader Utility

```
You are a professional software engineer with 10+ years of experience building scalable,
production-grade web applications.

Create a utility module at /src/utils/fontLoader.ts that:
1. Defines a typed array of available handwriting fonts:
   - name: string (display name)
   - family: string (CSS font-family value)
   - url: string (Google Fonts or local @font-face URL)
   - style: 'cursive' | 'print' | 'mixed'
   - languages: string[] (supported scripts: 'latin', 'arabic', etc.)

2. Exports a `loadFont(fontFamily: string): Promise<void>` function using the
   FontFace Web API — loads the font dynamically and adds it to document.fonts

3. Exports a `preloadFonts(families: string[]): Promise<void>` for batch loading

4. Handles errors gracefully with typed error returns

Include at least 8 realistic handwriting font entries with Google Fonts URLs.
All code must be TypeScript strict mode compliant.
```

---

## Phase 3 — UI Features & Controls

**Goal:** Build the user-facing input panel and settings controls.

### 🟩 Prompt 3.1 — Text Input Panel

```
You are a professional software engineer with 10+ years of experience building scalable,
production-grade web applications.

Build a React feature module at /src/features/editor/ containing:

1. `<TextInputPanel />` component:
   - A large, clean textarea for the user to type their text
   - Live character count and word count display
   - Debounced output (300ms) so the handwriting re-renders don't fire on every keystroke
   - Paste support with clipboard sanitization (strip HTML tags)
   - Keyboard shortcut: Ctrl+Enter to trigger manual re-render

2. A `useEditorState` hook (Zustand slice) managing:
   - rawText: string
   - debouncedText: string
   - wordCount: number
   - charCount: number

All components must be:
- Fully accessible (label, aria-describedby, keyboard navigable)
- Styled with Tailwind CSS
- TypeScript typed
- Zero external UI library dependencies
```

### 🟩 Prompt 3.2 — Settings Panel

```
You are a professional software engineer with 10+ years of experience building scalable,
production-grade web applications.

Create a `<SettingsPanel />` React component at /src/features/settings/ with the following
grouped controls:

GROUP 1 — Handwriting Style:
- Font selector: visual grid of font previews (renders "Hello" in each font)
- Ink color picker: preset swatches (Black, Blue, Red, Green) + custom hex input
- Font size slider: 12px–28px

GROUP 2 — Paper:
- Paper type selector: Lined / Blank / Grid / Dotted (visual icon buttons)
- Page size selector: A4 / Letter / Square

GROUP 3 — Realism:
- Letter variation slider: 0 (uniform) → 100 (very natural)
- Line spacing slider: 1.0x → 2.5x

State must be managed by a Zustand `useSettingsStore` slice with full TypeScript types.
The component must be collapsible on mobile (accordion pattern).
Use only Tailwind for styling. No external component libraries.
```

---

## Phase 4 — Export & Download

**Goal:** Let users download their handwritten output as PNG or PDF.

### 🟪 Prompt 4.1 — Export Service

```
You are a professional software engineer with 10+ years of experience building scalable,
production-grade web applications.

Create an export service module at /src/features/export/exportService.ts with:

1. `exportAsPNG(canvasRef: RefObject<HTMLCanvasElement>, filename: string): Promise<void>`
   - Exports the canvas at 2x resolution (for Retina/high-DPI screens)
   - Triggers browser download

2. `exportAsPDF(canvasRef: RefObject<HTMLCanvasElement>, filename: string): Promise<void>`
   - Uses jsPDF (import from CDN/npm) to create a properly sized PDF
   - Embeds the canvas as an image inside the PDF
   - Sets correct page dimensions based on paperType (A4 vs Letter)
   - Adds metadata: title, author ("Text to Handwriting App"), creation date

3. Both functions must:
   - Return typed Result objects: { success: boolean; error?: string }
   - Handle canvas-not-ready edge cases gracefully
   - Show a loading state via a callback: onProgress?: (status: 'preparing' | 'rendering' | 'done') => void

Written in strict TypeScript. No any types.
```

### 🟪 Prompt 4.2 — Export Button UI

```
You are a professional software engineer with 10+ years of experience building scalable,
production-grade web applications.

Build an `<ExportMenu />` component that:
1. Shows a primary "Download" button with a dropdown for format selection: PNG / PDF
2. Displays a loading spinner during export with a status message
3. Shows a success toast ("Downloaded successfully!") on completion
4. Shows an error toast with a retry option on failure

The toast system must be:
- Built from scratch (no external toast library)
- Animated (slide in from bottom-right, auto-dismiss after 3s)
- Accessible (role="alert", aria-live="polite")

All Tailwind. Full TypeScript. No dependencies beyond React and the export service.
```

---

## Phase 5 — Performance & Polish

**Goal:** Make the app feel fast, smooth, and production-ready.

### 🟥 Prompt 5.1 — Performance Optimization

```
You are a professional software engineer with 10+ years of experience building scalable,
production-grade web applications.

Review and optimize the Text-to-Handwriting app for performance:

1. Implement React.memo and useMemo/useCallback where re-renders are expensive
   (specifically in PaperCanvas and the handwriting renderer)

2. Set up code splitting with React.lazy + Suspense for:
   - The SettingsPanel (lazy load since it's not visible on first paint)
   - The ExportMenu

3. Add a Web Worker for the handwriting randomization logic so it doesn't block the main thread:
   - Create /src/workers/handwritingWorker.ts
   - Use Vite's ?worker import syntax
   - The worker receives text + settings and returns processed character data

4. Implement virtualization for very long texts (>500 lines) using a simple windowed rendering approach

Document every optimization with a comment explaining WHY it was applied.
```

### 🟥 Prompt 5.2 — Responsive Layout & Mobile UX

```
You are a professional software engineer with 10+ years of experience building scalable,
production-grade web applications.

Design and implement the overall page layout for the Text-to-Handwriting app:

Desktop (≥1024px):
- Left panel (40%): Text input + Settings
- Right panel (60%): Live paper preview (scrollable if multi-page)
- Sticky top bar: App name + Export button

Tablet (768px–1023px):
- Stacked: Settings collapsed by default, preview below input
- Floating Export FAB button

Mobile (<768px):
- Full-screen text input view
- Tab bar at bottom: Edit | Preview | Export
- Preview is a scaled-down paper card
- Settings open as a bottom sheet (slide-up modal)

Implementation requirements:
- Use Tailwind responsive prefixes only (no media query JS)
- Bottom sheet must trap focus and support swipe-to-dismiss
- All interactive elements must be minimum 44x44px tap targets (WCAG AA)
- Test at 320px minimum width
```

---

## Phase 6 — Deployment ✅ COMPLETED

**Goal:** Ship it to the world.

### ⬛ Prompt 6.1 — Vercel Deployment Config

```
You are a professional software engineer with 10+ years of experience building scalable,
production-grade web applications.

Prepare the Text-to-Handwriting app for production deployment on Vercel:

1. Create vercel.json with:
   - Build command: vite build
   - Output directory: dist
   - SPA rewrites (all routes → index.html)
   - Security headers: X-Frame-Options, X-Content-Type-Options, CSP

2. Set up environment variable handling:
   - Create .env.example with all required vars documented
   - Validate env vars at build time with a /src/env.ts module using Zod

3. Create a GitHub Actions CI workflow (.github/workflows/ci.yml):
   - Runs on push to main and PRs
   - Steps: Install → Lint → Type check → Build
   - Fails the pipeline on any TypeScript or ESLint error

4. Add a README.md with:
   - Project description
   - Tech stack badge table
   - Local development setup (3 commands max)
   - Deploy to Vercel button
```

---

## Phase 7 — Differentiating Features (What Makes This Unique)

**Goal:** Build the features that no competitor offers. These are the differentiators — existing tools like HandtextAI, RealisticHandwriting.com, and texttohandwriting.com **don't do these well or at all.** Build even 3 and you're already ahead.

> 💡 **Phase 7 Strategy:** Complete prompts in any order. Each is self-contained. Reference current component names from your codebase when pasting these prompts.

---

### 🟦 Prompt 7.1 — Real-Time Live Preview As You Type

**Why it's unique:** Most tools make you click "Generate." Yours updates handwriting **live as the user types** — like watching a pen write in real time. No competitor does this.

```
You are a professional software engineer with 10+ years of experience building scalable,
production-grade web applications.

Add real-time live handwriting preview to the PaperCanvas component. As the user types
in the TextInputPanel, the handwriting on the canvas should update with a 300ms debounce.
Add a subtle ink-drawing animation: each new word appears with a short left-to-right
draw animation (CSS transition on SVG stroke-dashoffset or canvas progressive render).
Make it feel like a pen is physically writing the text. Do not refactor unrelated code.
```

---

### 🟦 Prompt 7.2 — Filipino Language Support (Underserved Market)

**Why it's unique:** Almost zero handwriting tools support Tagalog, Ilocano, Cebuano, or Kapampangan. This targets a massive underserved local market with zero competition.

```
You are a professional software engineer with 10+ years of experience building scalable,
production-grade web applications.

Add Filipino language support to the handwriting renderer:
1. Ensure correct Unicode rendering for Filipino diacritics (á, é, í, ó, ú, ng, mga)
2. Add a 'Filipino School Pad' paper template: off-white background, single red vertical
   margin line 1.5 inches from the left, horizontal blue rules every 28px
3. Add Tagalog as a selectable language in settings that adjusts hyphenation and
   line-break rules using the Intl.Segmenter API
This is a unique feature no competitor offers. Do not refactor unrelated code.
```

---

### 🟦 Prompt 7.3 — Upload Your Own Handwriting (Custom Font Generator)

**Why it's unique:** The killer feature — your output literally looks like *you* wrote it. No free competitor offers this. Users take a photo of their own handwriting and the app converts it into a personal font.

```
You are a professional software engineer with 10+ years of experience building scalable,
production-grade web applications.

Build a 'My Handwriting' feature:
1. Provide a downloadable A4 template PDF with boxes for each letter A-Z, a-z, 0-9,
   and common punctuation
2. User uploads a photo of the filled template
3. Use the Anthropic Vision API to extract each character from the template image,
   crop them individually, and generate a custom SVG font definition
4. Store the generated font in localStorage as a base64 SVG font file
5. Add 'My Handwriting' as a selectable font option in the settings panel
Do not refactor unrelated code.
```

---

### 🟦 Prompt 7.4 — Controlled Imperfection Sliders

**Why it's unique:** Realism comes from imperfection. No competitor exposes these granular controls: Ink Pressure, Pen Wobble, Tiredness Effect, and Hand Mode.

```
You are a professional software engineer with 10+ years of experience building scalable,
production-grade web applications.

Extend the handwriting renderer with advanced realism controls:
1. Ink Pressure (0-100): Modulate stroke width per character — thick on downward motion,
   thin on upward (simulate ballpoint pen behavior on canvas)
2. Pen Wobble (0-100): Add subtle bezier curve noise to each character path using
   a Perlin noise function
3. Tiredness Effect (toggle): Gradually increase wobble and decrease baseline alignment
   by 0.5% per line, simulating a tired writer
4. Hand Mode (Left/Right): Adjust default letter slant — right-hand: slight right lean,
   left-hand: slight left or vertical lean
All sliders must update the canvas in real time. Do not refactor unrelated code.
```

---

### 🟦 Prompt 7.5 — Scan-Effect Export (Looks Like a Real Photo)

**Why it's unique:** The output looks like someone *photographed* a real handwritten page — not a digital render. Slight rotation, paper grain, vignette, and optional crease effect.

```
You are a professional software engineer with 10+ years of experience building scalable,
production-grade web applications.

Add a 'Scan Effect' export mode to the exportService:
1. After rendering the base canvas, apply post-processing effects using a secondary
   offscreen canvas:
   - Random page rotation: 0.3–1.2 degrees using ctx.rotate()
   - Paper grain: overlay a semi-transparent noise texture (generate procedurally with
     Math.random pixel fill at 3% opacity)
   - Vignette: radial gradient from transparent center to rgba(0,0,0,0.12) at edges
   - Optional crease: a faint diagonal line across the page at low opacity
2. Add a toggle in the Export Menu: 'Clean' vs 'Scanned' mode
3. The scanned output should look indistinguishable from a phone photo of real paper
Do not refactor unrelated code.
```

---

### 🟦 Prompt 7.6 — Dark Mode Ink-on-Chalkboard Theme

**Why it's unique:** Great for teachers, presentations, and social media content. No competitor offers this aesthetic at all.

```
You are a professional software engineer with 10+ years of experience building scalable,
production-grade web applications.

Add a 'Chalkboard' theme to the paper type options:
1. Background: dark green (#2d4a2d) or black (#1a1a1a) textured surface
2. Ink color defaults to chalk white (#f5f0e8) with slight transparency variation
3. Apply a subtle chalk dust effect: each character has a soft gaussian blur halo
   (2px blur, 20% opacity white) to simulate chalk on slate
4. The horizontal lines become faint white chalk marks
5. Export renders the dark background correctly (no white page background)
This should feel like writing on a real classroom chalkboard.
Do not refactor unrelated code.
```

---

### 🟦 Prompt 7.7 — Direct Sharing to Social Media / WhatsApp

**Why it's unique:** Huge for the Philippine market where WhatsApp and Facebook are primary communication platforms. Instant sharing without saving first is a frictionless UX win.

```
You are a professional software engineer with 10+ years of experience building scalable,
production-grade web applications.

Add a Share feature using the Web Share API:
1. Add a 'Share' button next to the Download button in ExportMenu
2. On click: convert canvas to Blob, then call navigator.share() with:
   - files: [new File([blob], 'handwriting.png', { type: 'image/png' })]
   - title: 'My Handwritten Note'
   - text: 'Created with Text to Handwriting'
3. Graceful fallback: if Web Share API is not supported, show a modal with:
   - Copy image to clipboard button
   - Direct download button
   - A shareable link (if hosted)
4. Show the share sheet immediately — no extra confirmation dialogs
Do not refactor unrelated code.
```

---

### 🟦 Prompt 7.8 — Realistic Yellow Pad Paper Mode (Interactive Header + Body)

**Why it's unique:** A fully interactive digital yellow legal pad that mirrors the physical experience — header area for name/date fields, body for continuous writing, with draggable/resizable text elements. No competitor replicates the physical yellow pad UX.

**Context:** The yellow pad layout has two distinct zones:
- **Header area** — larger line spacing; typically where name, date, and subject are written
- **Body area** — consistent narrower line spacing for main content

**What to build:**
- The header zone supports **drag-and-drop text elements** (Name, Date, Subject) that users can reposition freely, like placing labels on real paper
- Text elements in the header are **resizable** by dragging a handle
- The body zone supports **continuous line-aligned typing**, with the cursor snapping to each ruled line
- Users can **click anywhere on a body line** to start typing at that position
- After positioning a header element, pressing Tab or Enter smoothly shifts focus to the body for uninterrupted writing
- The yellow pad paper color (`#FDFBD4`) and ruled lines (`#B0C4DE` at 32px spacing, with a wider 64px spacing for the header) must accurately match a physical legal pad
- A single **red left margin line** at 72px from the left edge
- The overall feel: flexible placement first, then smooth continuous typing

```
You are a professional software engineer with 10+ years of experience building scalable,
production-grade web applications.

Build a <YellowPadEditor /> React component that replicates a physical yellow legal pad:

PAPER LAYOUT:
- Background: #FDFBD4 (classic yellow pad color)
- Red left margin line: 1px solid #E8A0A0 at x=72px
- Header zone: top 192px of the pad — ruled lines at 64px spacing (3 wide lines)
- Body zone: below 192px — ruled lines at 32px spacing, faint blue (#B0C4DE)
- Drop shadow and paper border for realism

HEADER ZONE — Draggable Text Elements:
- Render 3 default labeled fields: 'Name:', 'Date:', 'Subject:'
- Each field is a draggable container (use @dnd-kit/core or native HTML5 drag API)
- Each container has: a label (non-editable), an inline contentEditable input, and a resize handle
- Dragging repositions the element freely within the header zone bounds
- Resize handle on the bottom-right corner scales the text element width
- On Tab or Enter inside any header field → focus moves to the first body line

BODY ZONE — Line-Aligned Typing:
- Body is a transparent contentEditable div overlaid on the ruled lines
- line-height must exactly match the 32px rule spacing so text sits on the lines
- Clicking on any visible line area sets the cursor to that line
- Typing flows naturally from the clicked position, wrapping to the next line
- No scrollbars within the body — the page grows in height as content fills

STATE & ARCHITECTURE:
- Use a Zustand slice: useYellowPadStore with: headerElements[], bodyContent: string
- headerElements: { id, label, value, x, y, width }
- Persist state to localStorage under key 'yellowpad-state'
- Export a getPadSnapshot(): Promise<Blob> function using html2canvas for saving

STYLE:
- Tailwind for layout and positioning
- Inline dynamic styles only for x/y/width on draggable elements
- Full TypeScript types for all props and store shape
- Accessible: each header field has aria-label matching its label text

Do not refactor unrelated code. Integrate into the existing PaperCanvas paperType system
by adding 'yellow-pad' as a new paperType option in useSettingsStore.
```

---

## 🏆 Competitive Comparison

| Feature | Your App | HandtextAI | RealisticHandwriting.com | texttohandwriting.com |
|---|---|---|---|---|
| Live real-time preview | ✅ | ❌ | ❌ | ❌ |
| Upload your own handwriting | ✅ | ✅ (paid) | ❌ | ❌ |
| Filipino language support | ✅ | ❌ | ❌ | ❌ |
| Tiredness / pressure effects | ✅ | ❌ | ❌ | ❌ |
| Scan photo effect export | ✅ | ❌ | ❌ | ❌ |
| Chalkboard mode | ✅ | ❌ | ❌ | ❌ |
| Web Share API (WhatsApp) | ✅ | ❌ | ❌ | ❌ |
| Interactive Yellow Pad mode | ✅ | ❌ | ❌ | ❌ |
| 100% Free, no watermark | ✅ | ❌ (paid) | ✅ | ✅ |

---

## Quick Reference — Prompt Chaining Tips

| Situation | What to add to your prompt |
|---|---|
| Continuing a session | Paste the role prompt + "Here is the current code: [paste]" |
| Debugging | "Here is the error: [paste]. Fix it without changing the architecture." |
| Adding a feature | "Add [feature] to the existing [component]. Do not refactor unrelated code." |
| Code review | "Review this code for: TypeScript strictness, performance, accessibility, and clean architecture." |
| Stuck on a bug | "Explain step by step what this code does, then identify where the bug could be." |

---

*Roadmap version: 2.0 — Text-to-Handwriting Web App*
*Stack: React 18 · Vite · TypeScript · Tailwind CSS · Zustand · Canvas API*
*Phases 1–6: ✅ Complete | Phase 7: 🚧 In Progress*