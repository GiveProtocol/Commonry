# Discourse Theme Integration for Commonry

This document contains the HTML and CSS code to integrate Commonry's navigation into your Discourse forum, creating a seamless unified experience.

## Installation Instructions

### Step 1: Access Discourse Admin

1. Navigate to `https://forum.commonry.app/admin/customize/themes`
2. Click on your current theme or create a new one
3. Go to "Edit CSS/HTML"

### Step 2: Add Header HTML

Go to **Header** section and paste the following:

```html
<script type="text/discourse-plugin" version="0.8">
  // Detect dark mode and apply class to html element
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (isDarkMode) {
    document.documentElement.classList.add('dark');
  }

  // Listen for dark mode changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    });
  }
</script>

<!-- Commonry Shared Navigation -->
<nav class="commonry-nav" role="navigation" aria-label="Main navigation">
  <div class="commonry-nav-container">
    <!-- Logo and Brand -->
    <a href="https://commonry.app" class="commonry-logo" aria-label="Go to Commonry home">
      <div class="commonry-logo-icon" role="img" aria-label="Commonry logo">🏛️</div>
      <div class="commonry-brand">
        <div class="commonry-subtitle">$ cd ~</div>
        <div class="commonry-title">COMMONRY</div>
      </div>
    </a>

    <!-- Navigation Links -->
    <div class="commonry-nav-links" role="menubar">
      <a
        href="https://commonry.app/study"
        class="commonry-nav-link"
        role="menuitem"
        aria-label="Navigate to Your Plot - Personal study area"
      >
        [Your Plot]
      </a>
      <span class="commonry-nav-separator">|</span>
      <a
        href="https://commonry.app/browse"
        class="commonry-nav-link"
        role="menuitem"
        aria-label="Navigate to The Commons - Browse public decks"
      >
        [The Commons]
      </a>
      <span class="commonry-nav-separator">|</span>
      <a
        href="https://forum.commonry.app"
        class="commonry-nav-link commonry-nav-link-active"
        role="menuitem"
        aria-current="page"
        aria-label="Navigate to The Square - Community forum"
      >
        [The Square]
      </a>
      <span class="commonry-nav-separator">|</span>
      <a
        href="https://commonry.app/profile"
        class="commonry-nav-link"
        role="menuitem"
        aria-label="Navigate to your profile"
      >
        [Profile]
      </a>
    </div>
  </div>
</nav>

<!-- Breadcrumb -->
<nav class="commonry-breadcrumb" aria-label="Breadcrumb">
  <ol class="commonry-breadcrumb-list">
    <li class="commonry-breadcrumb-item">
      <a href="https://commonry.app" class="commonry-breadcrumb-link">
        <svg class="commonry-breadcrumb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        <span>Commonry</span>
      </a>
    </li>
    <li class="commonry-breadcrumb-separator">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </li>
    <li class="commonry-breadcrumb-item">
      <a href="https://forum.commonry.app" class="commonry-breadcrumb-link">The Square</a>
    </li>
  </ol>
</nav>
```

### Step 3: Add CSS

Go to **Common** CSS section and paste the following:

```css
/* =================================================================
   COMMONRY DISCOURSE THEME - SHARED NAVIGATION
   Version: 1.0.0

   This CSS creates a unified navigation experience between
   Commonry (main app) and The Square (Discourse forum).

   Design System:
   - Light Mode: Jade Green (#00a86b) + Coral Orange (#ff6b35)
   - Dark Mode: Cyan (#00d9ff) + Amber (#fbbf24)
   - Font: IBM Plex Mono (monospace) for terminal aesthetic
   ================================================================= */

/* CSS Variables - Synchronized with Commonry */
:root {
  /* Light Mode Colors */
  --commonry-green: #00a86b;
  --commonry-green-dark: #008055;
  --commonry-green-glow: rgba(0, 168, 107, 0.15);
  --commonry-orange: #ff6b35;
  --commonry-orange-dark: #e5572e;
  --commonry-paper: #fafaf9;
  --commonry-paper-darker: #f5f5f4;
  --commonry-ink: #1c1917;
  --commonry-ink-light: #44403c;
  --commonry-border-light: #d6d3d1;

  /* Font Stack */
  --commonry-font-mono: 'IBM Plex Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
  --commonry-font-sans: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

/* Dark Mode Variables */
html.dark {
  --commonry-cyan: #00d9ff;
  --commonry-cyan-dark: #0891b2;
  --commonry-cyan-glow: rgba(0, 217, 255, 0.3);
  --commonry-amber: #fbbf24;
  --commonry-amber-dark: #f59e0b;
  --commonry-dark: #0d1117;
  --commonry-dark-lighter: #161b22;
  --commonry-dark-border: #30363d;
  --commonry-text-primary: #c9d1d9;
  --commonry-text-muted: #8b949e;
}

/* =================================================================
   SHARED NAVIGATION BAR
   ================================================================= */

.commonry-nav {
  position: sticky;
  top: 0;
  z-index: 1000;
  background-color: var(--commonry-paper);
  border-bottom: 2px solid var(--commonry-green);
  box-shadow: 0 0 20px var(--commonry-green-glow);
  padding: 1rem 2rem;
}

html.dark .commonry-nav {
  background-color: var(--commonry-dark);
  border-bottom-color: var(--commonry-cyan);
  box-shadow: 0 0 20px var(--commonry-cyan-glow);
}

.commonry-nav-container {
  max-width: 1280px;
  margin: 0 auto;
}

/* Logo Section */
.commonry-logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  transition: opacity 0.2s ease;
  margin-bottom: 1rem;
}

.commonry-logo:hover {
  opacity: 0.8;
}

.commonry-logo-icon {
  font-size: 2.5rem;
  line-height: 1;
}

.commonry-brand {
  font-family: var(--commonry-font-mono);
}

.commonry-subtitle {
  font-size: 0.75rem;
  color: var(--commonry-ink-light);
}

html.dark .commonry-subtitle {
  color: var(--commonry-text-muted);
}

.commonry-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--commonry-green);
  transition: text-shadow 0.3s ease;
}

html.dark .commonry-title {
  color: var(--commonry-cyan);
}

.commonry-logo:hover .commonry-title {
  text-shadow: 0 0 20px var(--commonry-green-glow);
}

html.dark .commonry-logo:hover .commonry-title {
  text-shadow: 0 0 20px rgba(0, 217, 255, 0.5);
}

/* Navigation Links */
.commonry-nav-links {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  font-family: var(--commonry-font-mono);
  font-size: 0.875rem;
}

.commonry-nav-separator {
  color: var(--commonry-ink-light);
  user-select: none;
}

html.dark .commonry-nav-separator {
  color: var(--commonry-text-muted);
}

.commonry-nav-link {
  color: var(--commonry-ink-light);
  text-decoration: none;
  transition: color 0.2s ease, text-shadow 0.2s ease;
  padding: 0.5rem;
  border-radius: 0.25rem;
}

html.dark .commonry-nav-link {
  color: var(--commonry-text-muted);
}

.commonry-nav-link:hover {
  color: var(--commonry-green);
  text-shadow: 0 0 8px currentColor;
}

html.dark .commonry-nav-link:hover {
  color: var(--commonry-cyan);
}

.commonry-nav-link:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--commonry-green);
}

html.dark .commonry-nav-link:focus-visible {
  box-shadow: 0 0 0 2px var(--commonry-cyan);
}

/* Active Navigation Link */
.commonry-nav-link-active {
  color: var(--commonry-green);
  font-weight: 700;
  text-shadow: 0 0 15px var(--commonry-green-glow);
}

html.dark .commonry-nav-link-active {
  color: var(--commonry-cyan);
  text-shadow: 0 0 15px rgba(0, 217, 255, 0.5);
}

/* =================================================================
   BREADCRUMB NAVIGATION
   ================================================================= */

.commonry-breadcrumb {
  max-width: 1280px;
  margin: 1.5rem auto;
  padding: 0 2rem;
}

.commonry-breadcrumb-list {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
  font-family: var(--commonry-font-mono);
  font-size: 0.875rem;
}

.commonry-breadcrumb-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.commonry-breadcrumb-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--commonry-ink-light);
  text-decoration: none;
  transition: color 0.2s ease;
}

html.dark .commonry-breadcrumb-link {
  color: var(--commonry-text-muted);
}

.commonry-breadcrumb-link:hover {
  color: var(--commonry-green);
}

html.dark .commonry-breadcrumb-link:hover {
  color: var(--commonry-cyan);
}

.commonry-breadcrumb-icon {
  width: 1rem;
  height: 1rem;
}

.commonry-breadcrumb-separator {
  display: flex;
  align-items: center;
  color: var(--commonry-ink-light);
}

html.dark .commonry-breadcrumb-separator {
  color: var(--commonry-text-muted);
}

.commonry-breadcrumb-separator svg {
  width: 0.75rem;
  height: 0.75rem;
}

/* =================================================================
   DISCOURSE CONTENT ADJUSTMENTS
   ================================================================= */

/* Add spacing below navigation */
#main-outlet {
  margin-top: 2rem;
}

/* Adjust Discourse header to not conflict */
.d-header {
  margin-top: 0;
}

/* Optional: Hide Discourse's default header if you want full integration */
/* Uncomment the following line to hide Discourse header completely:
.d-header {
  display: none;
}
*/

/* =================================================================
   RESPONSIVE DESIGN
   ================================================================= */

@media (max-width: 768px) {
  .commonry-nav {
    padding: 0.75rem 1rem;
  }

  .commonry-breadcrumb {
    padding: 0 1rem;
  }

  .commonry-nav-links {
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .commonry-nav-separator {
    display: none;
  }

  .commonry-logo-icon {
    font-size: 2rem;
  }

  .commonry-title {
    font-size: 1.25rem;
  }

  .commonry-nav-link {
    padding: 0.375rem;
    font-size: 0.8125rem;
  }
}

/* =================================================================
   ACCESSIBILITY ENHANCEMENTS
   ================================================================= */

/* Respect reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  .commonry-nav-link,
  .commonry-breadcrumb-link,
  .commonry-logo {
    transition: none;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .commonry-nav {
    border-bottom-width: 3px;
  }

  .commonry-nav-link-active {
    font-weight: 800;
    text-decoration: underline;
  }
}

/* Focus styles for keyboard navigation */
*:focus-visible {
  outline: 2px solid var(--commonry-green);
  outline-offset: 2px;
}

html.dark *:focus-visible {
  outline-color: var(--commonry-cyan);
}

/* =================================================================
   PRINT STYLES
   ================================================================= */

@media print {
  .commonry-nav,
  .commonry-breadcrumb {
    display: none;
  }
}
```

### Step 4: Save and Preview

1. Click "Save"
2. Visit your forum to see the changes
3. Toggle between light and dark mode to verify both themes work correctly

## Keeping Navigation in Sync

Whenever you update the navigation in the main Commonry app (src/components/layout/SharedNavigation.tsx), you should also update the Discourse theme to match.

### Key Areas to Keep Synchronized:

1. **Navigation Items**: If you add/remove navigation items in SharedNavigation.tsx, update the corresponding links in the Discourse header HTML
2. **Colors**: If you change color values in globals.css or tailwind.config.js, update the CSS variables in the Discourse theme
3. **Font Families**: If you change fonts, update `--commonry-font-mono` and `--commonry-font-sans` variables
4. **Active States**: Ensure "The Square" is marked as active (`commonry-nav-link-active`) in Discourse theme

## Customization Options

### Option 1: Hide Discourse's Default Header

If you want complete integration and only show Commonry's navigation, uncomment this line in the CSS:

```css
.d-header {
  display: none;
}
```

### Option 2: Add Mobile Hamburger Menu

For a mobile-responsive hamburger menu on Discourse, you can add the following script to the **Header** section:

```javascript
<script type="text/discourse-plugin" version="0.8">
  // Mobile menu toggle
  api.onPageChange(() => {
    const nav = document.querySelector('.commonry-nav-links');
    if (nav && window.innerWidth <= 768) {
      // Add hamburger button and functionality
      // Implementation left as exercise - depends on your specific needs
    }
  });
</script>
```

### Option 3: Category-Specific Breadcrumbs

To show dynamic breadcrumbs based on the current category, add this to **Header**:

```javascript
<script type="text/discourse-plugin" version="0.8">
  api.onPageChange(() => {
    const categoryName = document.querySelector('.category-name')?.textContent;
    const breadcrumb = document.querySelector('.commonry-breadcrumb-list');

    if (categoryName && breadcrumb) {
      // Add category to breadcrumb
      const li = document.createElement('li');
      li.className = 'commonry-breadcrumb-item';
      li.innerHTML = `
        <span class="commonry-breadcrumb-separator">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </span>
        <span class="commonry-breadcrumb-link" style="color: var(--commonry-green); font-weight: 700;">
          ${categoryName}
        </span>
      `;
      breadcrumb.appendChild(li);
    }
  });
</script>
```

## Troubleshooting

### Issue: Styles not appearing
- **Solution**: Make sure you're editing **Common** CSS, not Desktop or Mobile specific CSS
- Clear your browser cache and hard refresh (Ctrl+F5 or Cmd+Shift+R)

### Issue: Navigation overlaps with Discourse content
- **Solution**: Increase the `margin-top` value for `#main-outlet` in the CSS

### Issue: Dark mode not working
- **Solution**: Ensure the dark mode detection script is in the **Header** section and that your browser/OS dark mode is enabled

### Issue: Fonts look different
- **Solution**: Import IBM Plex fonts by adding this to the **</head>** section:
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  ```

## Support

If you need help with the integration:
1. Check that all CSS variables are defined
2. Verify HTML structure matches exactly
3. Test in multiple browsers
4. Check browser console for any JavaScript errors

For more advanced customization, refer to:
- [Discourse Theme Developer Guide](https://meta.discourse.org/t/developer-s-guide-to-discourse-themes/93648)
- Commonry design system documentation (see docs/design-tokens.md)
