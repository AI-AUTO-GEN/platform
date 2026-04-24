# Higgsfield AI — UX/UI Design System Audit
> Audit Date: 2026-04-24

## Visual Identity

### Color Palette
| Role | Color | Usage |
|------|-------|-------|
| **Background** | `#000000` (Pure Black) | Page background, canvas |
| **Surface** | `~#0a0a0f` – `#111` | Cards, panels, nav |
| **Primary Accent** | `#D7FF00` (Neon Yellow-Green) | CTAs, highlights, badges |
| **Secondary** | White `#FFFFFF` | Text, borders |
| **Muted** | `#666` – `#888` | Subtext, inactive states |
| **Error/NSFW** | Red tones | Status indicators |
| **Success** | Green tones | Completion states |

### Typography
- **Family:** Clean, high-contrast sans-serif (likely Inter or custom)
- **Weights:** 400 (body), 500 (labels), 600 (headings), 700 (bold CTAs)
- **Case:** Mixed — section headers in sentence case, nav in title case

### Border & Radius
- **Cards:** Rounded corners (~12-16px radius)
- **Buttons:** Pill-shaped (full radius) for primary CTAs
- **Inputs:** Subtle border, dark fill, rounded

## Component Library

### Navigation
- **Top Bar:** Horizontal mega-menu with dropdowns
  - Left: Logo + product links (Explore, Image, Video, Audio, Collab, Edit, Character)
  - Center: Studios (Marketing Studio, Cinema Studio, Originals, Apps, Assist, Community)
  - Right: Pricing (with badge), Login, Sign up
- **Glassmorphism:** Backdrop blur on navigation bar

### Cards
- **Feature Cards:** Dark background, rounded corners, hover-to-play video preview
- **App Cards:** Grid layout, icon + title + description, hover animation
- **Shot Cards:** Thumbnail + metadata (model, resolution, duration)

### Buttons
- **Primary:** Neon yellow-green (`#D7FF00`) on dark, pill-shaped
- **Secondary:** Ghost/outline, white border
- **Disabled:** Muted gray

### Interactive Patterns
- **Hover-to-Play:** Video previews auto-play on hover (feature/app cards)
- **Glassmorphism:** Frosted glass effect on overlays/modals
- **Pill Badges:** Status indicators ("New", "Pro", "3.5")
- **Grid Layout:** Dense card grids for apps and galleries
- **Tabs:** For switching contexts (Image/Video/Audio)

### Form Controls
- **Prompt Input:** Large text area, dark background, clear placeholder text
- **Aspect Ratio Selector:** Visual pill toggles (9:16, 16:9, 1:1)
- **Resolution Selector:** Dropdown or segmented control
- **Model Selector:** Dropdown with model names and icons

## Layout Architecture

### Landing Page
```
┌─────────────────────────────────────────────┐
│ TOP NAV (glassmorphism, fixed)              │
├─────────────────────────────────────────────┤
│ HERO: Full-width feature banner             │
│ (rotating featured models/capabilities)     │
├─────────────────────────────────────────────┤
│ FEATURE GRID: 2-3 column cards              │
│ (GPT Image 2, Kling 3.0 4K, etc.)          │
├─────────────────────────────────────────────┤
│ STUDIO SHOWCASE: Marketing + Cinema         │
├─────────────────────────────────────────────┤
│ ORIGINALS: Featured AI series               │
├─────────────────────────────────────────────┤
│ FOOTER: Links, legal, social                │
└─────────────────────────────────────────────┘
```

### Generation Workspace (Collab)
```
┌─────────────────────────────────────────────┐
│ TOP NAV                                     │
├─────────────────────────────────────────────┤
│  SIDEBAR    │     GENERATION AREA           │
│  (Tools,    │  ┌─────────────────────┐      │
│   Models,   │  │  OUTPUT PREVIEW     │      │
│   History)  │  │                     │      │
│             │  └─────────────────────┘      │
│             │  ┌─────────────────────┐      │
│             │  │  PROMPT + CONTROLS  │      │
│             │  └─────────────────────┘      │
└─────────────┴───────────────────────────────┘
```

### Cinema Studio
```
┌─────────────────────────────────────────────┐
│ TOP: Project name + navigation              │
├──────┬──────────────────────────┬───────────┤
│      │  SHOT SEQUENCE           │ INSPECTOR │
│ TOOL │  [Shot 1][Shot 2][Shot 3]│ (Settings │
│ RAIL │                          │  Camera   │
│      │  CANVAS / PREVIEW        │  Params)  │
│      │                          │           │
├──────┴──────────────────────────┴───────────┤
│ TIMELINE: Keyframes, duration, camera path  │
└─────────────────────────────────────────────┘
```

## User Flows

### 1. Onboarding
Sign up → Verify email → Choose plan → Enter workspace → Tutorial/onboarding overlay

### 2. Text-to-Video Generation
Select model → Write prompt → Set resolution/AR/duration → Generate → Queue → Preview → Download/Iterate

### 3. Cinema Studio (Multi-Shot)
Create project → Add shots → Configure each shot (prompt, camera, character) → Generate sequence → Review timeline → Export

### 4. Marketing Studio
Paste product URL → Auto-extract assets → Choose template (UGC, Unbox, etc.) → Select avatar → Generate ad → Export

### 5. Character Creation (Soul ID)
Upload 10-20 photos → Train identity → Lock avatar → Reference in prompts with @tag → Use across projects

## Key UX Patterns to Learn From

1. **Model Aggregation as UX** — Users don't need to leave the platform to try different models
2. **Hover-to-Play Previews** — Instant quality assessment without clicks
3. **Draft → Final Workflow** — Encouraging cost-efficient creative iteration
4. **One-Click Apps** — Micro-tools that solve specific creative needs
5. **Mr. Higgs Co-Director** — AI that structures the creative process
6. **Credit Transparency** — Clear cost-per-action before committing
