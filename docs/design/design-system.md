# `pi-web` Design System Specification

This document details the core design system for `pi-web`. The design system is styled purely using standard **CSS Custom Properties** (Variables). This design system is responsive, highly performant, handles instant client-side transitions, and permits deep user customizability.

---

## 1. Core Principles

1. **Monospace Typography:** Highly tailored to developer workflows, using a clean monospace typeface stack.
2. **Obsidian Obsidian Dark by Default:** Provides a premium, high-contrast visual footprint that is comfortable for long hours of pairing.
3. **Fully Semantic Visual Tokens:** No hardcoded hex values in CSS rules or component styles. Every color, border, padding, and layout attribute references semantic tokens. (Note: `<meta name="theme-color">` requires a literal color value and is the sole exception.)
4. **Zero Compilation Overhead:** Themes are resolved purely at runtime by the browser, removing the need for server-side CSS precompilation.
5. **Local Custom Themes:** Anyone can configure custom themes by adding a simple CSS stylesheet in their active configuration directory.

---

## 2. Built-in Premium Themes

`pi-web` packages four highly polished, built-in themes out of the box:

### A. Carbon/Obsidian Dark (`[data-theme="dark"]`)
- **Theme Color:** `#0e0e13` / `#111116`
- **Contrast Style:** Deep black-zinc background with teal highlights (`#9cc7c0`). Emits a clean, developer-focused, distraction-free environment.

### B. Warm Linen Light (`[data-theme="light"]`)
- **Theme Color:** `#f6f5f2`
- **Contrast Style:** Soft, warm linen background with dark charcoal text (`#1f2328`) and warm pine-green accent indicators (`#496f69`). Avoids high-glare blinding whites.

### C. Arctic Frost Nord (`[data-theme="nord"]`)
- **Theme Color:** `#2e3440`
- **Contrast Style:** A beautifully balanced slate-polar color scheme inspired by Nord, emphasizing crisp cyan highlights (`#88c0d0`) and cool blue borders (`#81a1c1`).

### D. Cyberpunk Dracula (`[data-theme="dracula"]`)
- **Theme Color:** `#282a36`
- **Contrast Style:** High-contrast cyberpunk palette, utilizing vibrant neon pink (`#ff79c6`), light green (`#50fa7b`), and soft violet (`#bd93f9`).

---

## 3. Dynamic Custom Themes

You can inject **your own themes** into `pi-web`!

### How It Works Under the Hood
1. The server checks for the file `~/.pi/agent/pi-web/custom-themes.css` on every page request.
2. If it exists, the Go server automatically appends a stylesheet link:
   ```html
   <link rel="stylesheet" href="/custom-themes.css">
   ```
3. You can define any theme block utilizing a `[data-theme="custom"]` (or any custom identifier) selector to override color schemes!

### Example: Setting Up a Custom Theme
Create `~/.pi/agent/pi-web/custom-themes.css` and paste the following structure:

```css
[data-theme="custom"] {
    /* ── Main Canvas ── */
    --body-bg: #1e1e1e;
    --surface: #252526;
    --surface-2: #2d2d30;
    --text: #d4d4d4;
    --text-soft: #aaaaaa;
    --dim: #3e3e42;
    --accent: #007acc;
    --border-accent: #007acc;
    
    /* ── Syntax Overrides ── */
    --syntaxKeyword: #569cd6;
    --syntaxString: #ce9178;
    --syntaxComment: #6a9955;
    
    /* ... you can override any design system token listed below! */
}
```

Once saved, reload the page and open the **Session Actions menu (⋯)** in the top-right of the session header, then cycle through the **Theme** toggle until **⚙ Custom** appears.

---

## 4. Design Tokens Manifest

Every component (the index list cards, sidebar tree, chat bubbles, buttons, and command palette) uses this unified variable taxonomy:

### Colors & Surfaces
- `--body-bg`: Main screen canvas background.
- `--surface`: Background of primary cards, panels, and sheets.
- `--surface-2`: Hovers, action lists, active states.
- `--text`: High-contrast body and title copy.
- `--text-soft`: Lower contrast descriptive labels.
- `--muted`: Extremely low-emphasis metadata.
- `--dim`: Outer dividing rules and borders.
- `--dim-2`: Inner subtle divisions.
- `--accent`: Brand focus, highlight borders, and state changes.

### Syntax Highlighting & Diffs
- `--syntaxKeyword`: Language keywords.
- `--syntaxComment`: Code comments.
- `--syntaxString`: String literals.
- `--toolDiffAdded`: Inline git addition rows.
- `--toolDiffRemoved`: Inline git deletion rows.

### Common Components
- **Buttons (`.btn-primary`, `.btn-secondary`):**
  - Rounded borders: `6px`.
  - Margin padding: `8px 14px`.
  - Inherited color-transitions: `0.12s ease`.
- **Inputs (`input[type="text"]`):**
  - Soft-shadow focus rings mapping `--accent`.
  - Complete padding alignment with adjacent buttons.
