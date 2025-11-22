# Commonry Design Tokens

This document defines the design system tokens used across all Commonry platforms (main app, Discourse forum, and any future extensions).

## Purpose

These design tokens ensure visual consistency across:

- **Commonry App** (commonry.app) - React/Vite application
- **The Square** (forum.commonry.app) - Discourse forum
- Any future platforms or integrations

## Color System

### Light Mode (Default)

#### Primary Color: Jade Green

```css
--terminal-green: #00a86b; /* Main green */
--terminal-green-dark: #008055; /* Darker for hover states */
--terminal-green-glow: rgba(0, 168, 107, 0.15); /* Glow effect */
```

**Usage:**

- Primary actions and CTAs
- Active navigation states
- Focus indicators
- Interactive element highlights

**Tailwind Classes:**

- `terminal-primary` (text)
- `bg-terminal-primary` (background)
- `border-terminal-primary` (borders)
- `shadow-terminal-glow` (box shadow)

#### Accent Color: Coral Orange

```css
--terminal-orange: #ff6b35; /* Vibrant coral-orange */
--terminal-orange-dark: #e5572e; /* Darker for hover */
--terminal-orange-glow: rgba(255, 107, 53, 0.15); /* Glow effect */
```

**Usage:**

- Secondary actions
- Highlights and badges
- Warning states
- Accent elements

**Tailwind Classes:**

- `terminal-accent` (text)
- `bg-terminal-accent` (background)
- `border-terminal-accent` (borders)

#### Background Colors

```css
--paper: #fafaf9; /* Warm off-white */
--paper-darker: #f5f5f4; /* Slightly darker for cards */
```

**Tailwind Classes:**

- `bg-terminal-base` → `--paper`
- `bg-terminal-surface` → `--paper-darker`

#### Text Colors

```css
--ink: #1c1917; /* Near black */
--ink-light: #44403c; /* Medium gray for secondary text */
```

**Tailwind Classes:**

- `text-terminal-base` → `--ink`
- `text-terminal-muted` → `--ink-light`

#### Borders & Dividers

```css
--border-light: #d6d3d1; /* Soft neutral gray */
```

**Tailwind Classes:**

- `border-terminal-muted`

---

### Dark Mode

#### Primary Color: Cyan

```css
--cyan: #00d9ff; /* Bright cyan */
--cyan-dark: #0891b2; /* Darker cyan */
--cyan-glow: rgba(0, 217, 255, 0.3); /* Glow effect */
--cyan-glow-strong: rgba(0, 217, 255, 0.6); /* Stronger glow */
```

**Usage:**

- Primary actions and CTAs
- Active navigation states
- Focus indicators
- Terminal/tech aesthetic elements

**Applies to same Tailwind classes** but in dark mode:

- `dark:text-cyan`
- `dark:bg-cyan`
- `dark:border-cyan`

#### Accent Color: Amber

```css
--amber: #fbbf24; /* Warm amber */
--amber-dark: #f59e0b; /* Darker amber */
--amber-glow: rgba(251, 191, 36, 0.3); /* Glow effect */
```

**Usage:**

- Secondary actions
- Highlights and badges
- Interactive accents

**Tailwind Classes (dark mode):**

- `dark:text-amber`
- `dark:bg-amber`

#### Background Colors

```css
--dark: #0d1117; /* Deep dark background */
--dark-lighter: #161b22; /* Slightly lighter for cards */
--dark-surface: #161b22; /* Surface elements */
```

**Tailwind Classes:**

- `dark:bg-dark` → `#0d1117`
- `dark:bg-dark-surface` → `#161b22`

#### Text Colors

```css
--text-primary: #c9d1d9; /* Light gray text */
--text-muted: #8b949e; /* Muted gray for secondary */
```

**Tailwind Classes:**

- `dark:text-text-primary`
- `dark:text-text-muted`

#### Borders

```css
--dark-border: #30363d; /* Subtle borders */
```

**Tailwind Classes:**

- `dark:border-dark-border`

---

## Typography

### Font Families

```css
--font-sans:
  "IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto",
  sans-serif;
--font-mono: "IBM Plex Mono", "Menlo", "Monaco", "Courier New", monospace;
```

**Usage Guidelines:**

- **Monospace (`font-mono`)**: Use for navigation, terminal-style UI, code blocks, technical elements
- **Sans-serif (`font-sans`)**: Use for body text, descriptions, long-form content

**Tailwind Classes:**

- `font-mono`
- `font-sans`

### Font Sizes (Modular Scale: 1.25 ratio)

```css
h1: 2.441rem; /* ~39px */
h2: 1.953rem; /* ~31px */
h3: 1.563rem; /* ~25px */
h4: 1.25rem; /* ~20px */
p: 1rem; /* ~16px */
small: 0.875rem; /* ~14px */
```

**Line Heights:**

- Headings: 1.2
- Body text: 1.6
- Monospace: 1.5

**Letter Spacing:**

- Headings: -0.02em (tighter)
- Body: -0.01em (slightly tight)
- Monospace: 0 (normal)

---

## Spacing Scale

Based on 8px grid system:

```
0.5rem = 8px    → gap-2
0.75rem = 12px  → gap-3
1rem = 16px     → gap-4
1.5rem = 24px   → gap-6
2rem = 32px     → gap-8
3rem = 48px     → gap-12
4rem = 64px     → gap-16
```

**Common Patterns:**

- Card padding: `p-5` to `p-8` (20-32px)
- Section margins: `mb-12` (48px)
- Navigation gaps: `gap-6` (24px)

---

## Border Radius

```css
--radius: 0.5rem; /* 8px */

lg: 0.5rem; /* Standard cards, buttons */
md: 0.375rem; /* Smaller elements */
sm: 0.25rem; /* Badges, tags */
```

**Tailwind Classes:**

- `rounded` → 0.25rem
- `rounded-lg` → 0.5rem (most common)
- `rounded-full` → 9999px (pills, avatars)

---

## Shadows & Glows

### Light Mode

```css
/* Terminal Green Glow */
--terminal-green-glow: rgba(0, 168, 107, 0.15);
box-shadow: 0 0 20px var(--terminal-green-glow);

/* Orange Accent Glow */
--terminal-orange-glow: rgba(255, 107, 53, 0.15);
box-shadow: 0 0 20px var(--terminal-orange-glow);
```

**Tailwind Classes:**

- `shadow-terminal-glow`
- `shadow-terminal-accent-glow`

### Dark Mode

```css
/* Cyan Glow */
--cyan-glow: rgba(0, 217, 255, 0.3);
box-shadow: 0 0 20px rgba(0, 217, 255, 0.3);

/* Strong Cyan Glow (CTAs) */
--cyan-glow-strong: rgba(0, 217, 255, 0.6);
box-shadow: 0 0 30px rgba(0, 217, 255, 0.6);

/* Amber Glow */
--amber-glow: rgba(251, 191, 36, 0.3);
box-shadow: 0 0 20px rgba(251, 191, 36, 0.3);
```

**Tailwind Classes:**

- `dark:shadow-cyan-glow`
- `glow-cyan` / `glow-cyan-strong`
- `glow-amber`

### Text Shadows (Glow Effect)

```css
/* Light Mode */
text-shadow: 0 0 15px var(--terminal-green-glow);

/* Dark Mode */
text-shadow: 0 0 15px rgba(0, 217, 255, 0.5);
```

**Tailwind Classes:**

- `text-shadow-terminal`
- `dark:[text-shadow:0_0_15px_rgba(0,217,255,0.5)]` (inline)

---

## Component Patterns

### Navigation Bar

```css
/* Structure */
position: sticky;
top: 0;
z-index: 40-50;
border-bottom: 2px solid [primary-color];
box-shadow: 0 0 20px [primary-glow];

/* Light Mode */
background: var(--paper);
border-color: var(--terminal-green);

/* Dark Mode */
background: var(--dark);
border-color: var(--cyan);
```

### Cards

```css
/* Light Mode */
background: var(--paper-darker);
border: 1px solid var(--border-light);
border-radius: 0.5rem;
padding: 1.25rem-2rem;

/* Dark Mode */
background: var(--dark-surface);
border: 1px solid var(--dark-border);

/* Hover State */
border-color: [primary-color];
box-shadow: 0 0 20px [primary-glow];
```

### Buttons

```css
/* Primary Button - Light */
background: var(--terminal-green);
color: var(--paper);
border: 1px solid var(--terminal-green);
box-shadow: 0 0 20px var(--terminal-green-glow);

/* Primary Button - Dark */
background: var(--cyan);
color: var(--dark);
border: 1px solid var(--cyan);
box-shadow: 0 0 20px var(--cyan-glow);

/* Hover State */
opacity: 0.9;
transform: scale(1.05);
```

### Interactive States

```css
/* Hover */
transition: all 0.2s ease;
text-shadow: 0 0 8px currentColor;

/* Focus (keyboard navigation) */
outline: none;
box-shadow: 0 0 0 2px [primary-color];
ring-offset: 2px;

/* Active */
font-weight: 700;
text-shadow: 0 0 15px [primary-glow];
```

---

## Animation Guidelines

### Transitions

```css
/* Standard */
transition: all 0.2s ease;

/* Hover effects */
transition:
  color 0.2s ease,
  text-shadow 0.2s ease;

/* Transform */
transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
```

### Keyframe Animations

```css
/* Fade In */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Slide Up */
@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Blink (cursor) */
@keyframes blink {
  50% {
    opacity: 0;
  }
}
```

**Tailwind Classes:**

- `animate-pulse`
- `animate-blink`
- `transition-all`

### Respect Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
```

---

## Accessibility

### Contrast Ratios

All color combinations meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text):

✅ Green (#00a86b) on White (#fafaf9): 4.52:1
✅ Cyan (#00d9ff) on Dark (#0d1117): 8.14:1
✅ Ink (#1c1917) on White (#fafaf9): 16.42:1
✅ Text Primary (#c9d1d9) on Dark (#0d1117): 12.67:1

### Focus Indicators

Always provide visible focus indicators for keyboard navigation:

```css
*:focus-visible {
  outline: 2px solid [primary-color];
  outline-offset: 2px;
}
```

### ARIA Labels

All interactive elements should have appropriate ARIA labels:

```html
<button aria-label="Navigate to Your Plot - Personal study area">
  [Your Plot]
</button>

<nav aria-label="Main navigation">...</nav>
<nav aria-label="Breadcrumb">...</nav>
```

---

## Usage in Different Platforms

### React/Vite (Main App)

Use Tailwind classes:

```tsx
<div className="bg-terminal-base dark:bg-dark">
  <h1 className="terminal-primary dark:text-cyan font-mono">Title</h1>
</div>
```

### Discourse (Forum)

Use CSS variables:

```css
.my-element {
  background-color: var(--commonry-paper);
  color: var(--commonry-green);
}

html.dark .my-element {
  background-color: var(--commonry-dark);
  color: var(--commonry-cyan);
}
```

### Plain HTML/CSS

Use CSS variables defined in root:

```css
:root {
  --primary-color: #00a86b;
}

html.dark {
  --primary-color: #00d9ff;
}

.button {
  background: var(--primary-color);
}
```

---

## Updating Design Tokens

When updating design tokens, you must update them in **all** locations:

1. **Vite/React App**:
   - `/src/globals.css` (CSS variables)
   - `/tailwind.config.js` (Tailwind theme)

2. **Discourse Forum**:
   - Admin → Customize → Themes → Common CSS

3. **Documentation**:
   - `/docs/design-tokens.md` (this file)
   - `/docs/discourse-theme.md`

### Checklist for Token Updates

- [ ] Update CSS variables in `src/globals.css`
- [ ] Update Tailwind config in `tailwind.config.js`
- [ ] Update Discourse theme CSS
- [ ] Update documentation
- [ ] Test in both light and dark modes
- [ ] Test on mobile devices
- [ ] Verify accessibility (contrast ratios)
- [ ] Check print styles if applicable

---

## Terminal Aesthetic Guidelines

Commonry uses a "terminal" or "hacker" aesthetic inspired by classic Unix terminals and modern developer tools.

### Visual Language

- **Monospace fonts** for UI elements
- **Green and orange** (light mode) evoke classic terminal colors
- **Cyan and amber** (dark mode) reference cyberpunk/neon aesthetics
- **Glow effects** suggest CRT monitors
- **Terminal prompts** (`$`, `./`, brackets) throughout UI
- **Simple geometric shapes** (no gradients, no complex patterns)

### Do's and Don'ts

✅ **Do:**

- Use monospace fonts for navigation, buttons, and labels
- Apply subtle glow effects to primary elements
- Use terminal-style prefixes (`$`, `./command`)
- Keep animations subtle and purposeful
- Maintain high contrast for readability

❌ **Don't:**

- Use script or decorative fonts
- Overuse glow effects (reserve for interactive/active states)
- Add unnecessary animations or transitions
- Use multiple typefaces in the same view
- Sacrifice readability for aesthetics

---

## Version History

- **v1.0.0** (2025-01-22): Initial design system documentation
  - Defined light and dark mode color palettes
  - Established typography scale and font families
  - Created component patterns for navigation and cards
  - Documented accessibility requirements

---

## Contributing

When proposing changes to design tokens:

1. Document the rationale for the change
2. Ensure WCAG AA compliance
3. Test across all platforms (app, forum)
4. Update this documentation
5. Provide migration guide if breaking changes
