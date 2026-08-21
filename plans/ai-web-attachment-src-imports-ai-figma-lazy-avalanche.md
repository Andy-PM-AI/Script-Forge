# ScriptForge — AI Screenplay Creation Tool: Implementation Plan

## Context
Build "ScriptForge", a complete web-based AI-assisted short drama screenplay creation tool. The project is a fresh Vite + React 19 + Tailwind CSS v4 scaffold with only a placeholder App.tsx and a single-line index.css. Everything needs to be built from scratch.

The product is a 7-step wizard workflow: Project Setup → Characters/Background/Storyline → Segment Outline → Episode-Group Outline → Per-Episode Synopsis → Script Editor → Export. Users can navigate between pages and interact with AI-generated content blocks.

**Design language** (from the spec + create_make_theme): deep indigo dark theme (#1A1A2E bg), purple-to-blue gradient accent (#6C5CE7 → #0984E3), card bg #252540, borders #3D3D5C. Inter for UI, JetBrains Mono for the screenplay viewer. Professional tool aesthetic (Cursor/Linear feel).

---

## File Structure

```
src/
  context/AppContext.tsx        — navigation state + project data
  data/mockData.ts              — all mock AI-generated content
  components/
    ui/
      TopNav.tsx                — fixed 64px navbar with 7-step progress bar
      Sidebar.tsx               — collapsible 240/56px left nav
      RightPanel.tsx            — 320px AI feedback + history panel
      WorkflowShell.tsx         — layout wrapper (TopNav + Sidebar + content + RightPanel)
      AIContentBlock.tsx        — AI content card (regenerate/edit/restore + skeleton)
      SkeletonLoader.tsx        — pulsing placeholder blocks
      PromptEditorModal.tsx     — full-screen modal with code-editor textarea
      ProjectCard.tsx           — project grid card with progress bar
      CharacterCard.tsx         — character avatar + traits card
      RadioCard.tsx             — styled radio as clickable card
      GenreTagCloud.tsx         — multi-select genre pills
      SegmentedControl.tsx      — horizontal tab-strip
      CharacterForm.tsx         — inline character add/edit form
      ScriptViewer.tsx          — dual-pane screenplay renderer (showpiece)
    steps/
      HomeView.tsx              — hero + recent projects grid
      Step1Setup.tsx            — project setup form
      Step2Characters.tsx       — 3 AI content blocks (characters/background/storyline)
      Step3SegmentOutline.tsx   — segment cards (skipped if ≤40 eps)
      Step4EpisodeGroupOutline.tsx — two-level nested outline (skipped if ≤40 eps)
      Step5EpisodeSynopsis.tsx  — per-episode synopsis grid
      Step6Script.tsx           — screenplay viewer with scene nav
      Step7Export.tsx           — completion + download options
      ProjectsView.tsx          — full projects list with filters
  App.tsx                       — rewrite as state-based router
  index.css                     — font imports + Tailwind + theme tokens
```

---

## Implementation Order

### 1. `src/index.css`
Add Google Fonts `@import` for Inter and JetBrains Mono **before** `@import 'tailwindcss'`. Add Tailwind v4 `@theme {}` block with all color/font/radius tokens. Add `body` base styles, `.gradient-primary` utility, custom scrollbar styles.

Key tokens:
```css
@theme {
  --color-bg-base: #1A1A2E;
  --color-bg-card: #252540;
  --color-border: #3D3D5C;
  --color-primary: #6C5CE7;
  --color-accent: #0984E3;
  --color-text: #E8E8F0;
  --color-muted: #8888AA;
  --color-success: #00B894;
  --color-warning: #FDCB6E;
  --color-danger: #E17055;
  --font-sans: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --radius: 0.75rem;
}
```

### 2. `src/context/AppContext.tsx`
View enum: `'home' | 'projects' | 'step1' | 'step2' | 'step3' | 'step4' | 'step5' | 'step6' | 'step7'`. Holds `currentProject` (market, genre[], episodes, language, synopsis, characters), sidebar/rightPanel open state, AI history log. Exports `useApp()` hook.

Step-skip logic: `navigate()` auto-skips step3/step4 when `episodes <= 40`.

### 3. `src/data/mockData.ts`
Mock content: `mockCharacters[]`, `mockBackground`, `mockStoryline`, `mockSegments[]`, `mockEpisodeGroups[][]`, `mockEpisodeSynopses[]`, `mockScriptScenes[]` (each scene: sceneHeading, action, dialogue array), `mockProjects[]`.

### 4. Shared UI components (in dependency order)
- `SkeletonLoader` — `animate-pulse` blocks, accepts `lines` prop
- `AIContentBlock` — card with gradient pseudo-element left border, toolbar (refresh/pencil/clock icons), inline editing state via `useState`, skeleton on `isLoading`
- `RadioCard`, `GenreTagCloud`, `SegmentedControl`, `CharacterForm`, `CharacterCard` — form primitives for Step 1
- `PromptEditorModal` — fixed overlay, textarea with `font-mono`, Restore Default + Save buttons
- `ProjectCard` — gradient thumbnail div, progress bar, hover lift effect
- `ScriptViewer` — dual-pane: left scene list (200px) + right `font-mono` screenplay body. Screenplay format: scene heading in bold/primary color, action lines normal, character cue centered+uppercase, dialogue centered max-w-[360px], parentheticals italic+muted. `scrollIntoView` sync between panes via `useRef`.

### 5. Layout shell
- `TopNav` — Logo wordmark ("Script" white + "Forge" gradient), center stepper (shown only on step views), New Project button + avatar. Stepper: 7 nodes connected by lines; completed = checkmark, active = gradient fill, future = ghost circle. Steps 3/4 rendered dimmed + dashed connector when `episodes <= 40`.
- `Sidebar` — width transitions via `transition-[width] duration-200`. Content varies by current view (different nav items per step). Collapse chevron at bottom.
- `RightPanel` — slides in/out with `translate-x-full`. AI feedback textarea + Send button (top), operation history list (bottom). Tab handle on left edge when collapsed.
- `WorkflowShell` — `fixed TopNav + flex(Sidebar + main + RightPanel)`. Main area: `flex-1 overflow-y-auto pt-16`, inner `max-w-[1200px] mx-auto px-6 py-8`.

### 6. Views (in priority order)

**HomeView** — no WorkflowShell. Hero with dot-grid background (reuse existing App.tsx pattern), headline, two CTAs. Below: 3-column project grid with `mockProjects`. Empty state if no projects.

**Step1Setup** — centered form (max-w-2xl). Market RadioCards, GenreTagCloud, episode SegmentedControl, language select, synopsis textarea with char count, character list with CharacterForm. Footer: Save Draft + Generate & Continue.

**Step2Characters** — 3 `AIContentBlock`s (characters/background/storyline). Staggered loading simulation (setTimeout 800/1400/2000ms). Regenerate triggers re-loading cycle.

**Step6Script** — showpiece. WorkflowShell with `ScriptViewer` taking full remaining height. Episode selector dropdown top bar. Floating "generating" progress banner. Right panel becomes "Scene Notes" contextually.

**Step3SegmentOutline** — vertical list of segment `AIContentBlock` cards. Skip placeholder if `episodes <= 40`.

**Step4EpisodeGroupOutline** — two-level accordion. Same skip logic.

**Step5EpisodeSynopsis** — 2-column CSS grid of synopsis cards with hover lift.

**Step7Export** — centered completion screen. Animated SVG checkmark (stroke-dashoffset). Export format RadioCards (PDF/Word/FDX/Markdown). Download button. Share link input.

**ProjectsView** — TopNav only (no stepper). Search + filter row. 3-column card grid with toggle for list view (table). New Project FAB.

### 7. `src/App.tsx` — rewrite
Wrap in `AppProvider`, render `<Router>` which switches on `view` from `useApp()`. Clean removal of the dot-grid placeholder.

---

## Key Technical Notes

- **Gradient left border on AIContentBlock**: use `::before` pseudo-element (or a positioned `<div>`) with `background: linear-gradient(to bottom, #6C5CE7, #0984E3)`, `width: 3px`, `border-radius: 2px`, since CSS `border-image` doesn't support border-radius.
- **Tailwind v4 CSS vars**: custom colors referenced as `bg-[var(--color-bg-card)]` or via `@theme` mapping if using shorthand names.
- **Font imports**: Google Fonts `@import` must be the very first lines in `src/index.css`, before `@import 'tailwindcss'`.
- **ScriptViewer**: both panes use `overflow-y-auto height-full` inside `flex flex-row flex-1 min-h-0` to enable independent scrolling.

---

## Verification
1. Dev server hot-reloads automatically (already running on `$PORT`)
2. Navigate: Home → New Project → Step 1 → fill form → Step 2 (see staggered AI loading)
3. Step 2: click Regenerate on a block, see loading state cycle
4. Navigate to Step 6: verify screenplay typography (monospace, centered dialogue, uppercase scene headings)
5. Left sidebar collapse/expand works; right panel opens/closes
6. Step progress bar reflects current step; completed steps show checkmark
7. Project cards on Home link back into the workflow
8. Step 7 shows export screen with animated checkmark
