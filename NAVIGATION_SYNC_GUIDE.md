# Commonry Navigation Synchronization Guide

This guide helps you keep the navigation consistent across both the Commonry app and Discourse forum.

## 📋 Overview

The navigation appears identically on:
- **Commonry App** (commonry.app) - React/Vite app
- **Discourse Forum** (forum.commonry.app) - Discourse theme

Both use:
- Same logo and branding
- Same navigation items (Your Plot, The Commons, The Square, Profile)
- Same color scheme and typography
- Same responsive behavior

---

## 🎨 Design Tokens

### Colors

#### Light Mode
```css
/* Primary */
--terminal-green: #00a86b           /* Jade/emerald green */
--terminal-green-dark: #008055      /* Darker for hover */
--terminal-green-glow: rgba(0, 168, 107, 0.15)

/* Accent */
--terminal-orange: #ff6b35          /* Vibrant coral-orange */
--terminal-orange-dark: #e5572e
--terminal-orange-glow: rgba(255, 107, 53, 0.15)

/* Backgrounds */
--paper: #fafaf9                    /* Warm off-white */
--paper-darker: #f5f5f4             /* Slightly darker for cards */

/* Text */
--ink: #1c1917                      /* Near black */
--ink-light: #44403c                /* Medium gray for secondary text */

/* Borders */
--border-light: #d6d3d1             /* Soft neutral gray */
```

#### Dark Mode
```css
/* Primary */
--cyan: #00d9ff                     /* Electric cyan */

/* Accent */
--amber: #fbbf24                    /* Warm amber */

/* Backgrounds */
--dark: #0d1117                     /* Deep dark background */
--dark-surface: #161b22             /* Slightly lighter surface */

/* Text */
--text-primary: #c9d1d9             /* Light gray text */
--text-muted: #8b949e               /* Muted gray text */

/* Borders */
--dark-border: #30363d              /* Dark border */
```

### Typography
```css
/* Fonts */
--font-sans: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif
--font-mono: 'IBM Plex Mono', 'Menlo', 'Monaco', 'Courier New', monospace

/* Font sizes */
--logo-size: 1.5rem (24px)
--logo-prompt: 0.75rem (12px)
--nav-links: 0.875rem (14px)
```

### Spacing
```css
/* Navigation padding */
--nav-padding-x: 2rem (32px)
--nav-padding-y: 1rem (16px)

/* Logo spacing */
--logo-gap: 0.75rem (12px)
--logo-margin-bottom: 1rem (16px)

/* Link spacing */
--link-gap: 1.5rem (24px)
```

### Effects
```css
/* Shadows */
--shadow-terminal-light: 0 0 20px rgba(0, 168, 107, 0.15)
--shadow-terminal-dark: 0 0 20px rgba(0, 217, 255, 0.3)

/* Text shadows */
--text-shadow-light: 0 0 15px rgba(0, 168, 107, 0.5)
--text-shadow-dark: 0 0 15px rgba(0, 217, 255, 0.5)
--text-shadow-hover: 0 0 8px currentColor

/* Transitions */
--transition-standard: all 0.2s ease
```

---

## 🔄 Keeping Navigation in Sync

### When to Update Both

Update **both** the Commonry app and Discourse theme when you change:

1. **Navigation items** - Adding, removing, or renaming sections
2. **Colors** - Adjusting the color scheme or theme
3. **Typography** - Changing fonts or sizes
4. **Spacing** - Modifying padding or gaps
5. **Logo** - Updating branding or logo design

### Where to Make Changes

#### Commonry App (React)
```
File: /src/components/layout/SharedNavigation.tsx
```

Changes to make:
- Update `navItems` array for navigation links
- Modify Tailwind classes for styling
- Adjust component props if needed

#### Discourse Theme
```
File: Discourse Admin > Customize > Themes > Edit CSS/HTML > Header
```

Changes to make:
- Update navigation HTML links
- Modify CSS custom properties for colors
- Adjust spacing and typography CSS

---

## 📝 Step-by-Step Update Process

### Adding a New Navigation Item

#### 1. Update Commonry App
Edit `/src/components/layout/SharedNavigation.tsx`:

```tsx
const navItems = [
  {
    view: "study",
    label: "Your Plot",
    url: "https://commonry.app/study",
    ariaLabel: "Navigate to Your Plot - Personal study area"
  },
  // ADD NEW ITEM HERE:
  {
    view: "newview",
    label: "New Section",
    url: "https://commonry.app/newview",
    ariaLabel: "Navigate to New Section"
  },
  // ... other items
];
```

#### 2. Update Discourse Theme
Edit the Header section in Discourse theme:

```html
<!-- Add in desktop nav -->
<span class="commonry-nav-separator" aria-hidden="true">|</span>
<a href="https://commonry.app/newview" class="commonry-nav-link" role="menuitem">
  [New Section]
</a>

<!-- Add in mobile nav -->
<a href="https://commonry.app/newview" class="commonry-nav-link">[New Section]</a>
```

### Changing Colors

#### 1. Update Commonry App
Edit `/src/globals.css`:

```css
:root {
  --terminal-green: #NEW_COLOR;
}

.dark {
  --primary: NEW_HSL_VALUES;
}
```

#### 2. Update Discourse Theme
Edit the `<style>` section in Header:

```css
#commonry-nav {
  border-bottom: 2px solid #NEW_COLOR;
}

html.dark-scheme #commonry-nav {
  border-bottom-color: #NEW_DARK_COLOR;
}
```

### Changing Typography

#### 1. Update Commonry App
Edit `/src/globals.css`:

```css
:root {
  --font-mono: 'New Font', monospace;
}
```

#### 2. Update Discourse Theme
Edit the `<style>` section:

```css
@import url('https://fonts.googleapis.com/css2?family=New+Font&display=swap');

#commonry-nav {
  font-family: 'New Font', monospace;
}
```

---

## 🧪 Testing Checklist

After making changes, test both environments:

### Commonry App (localhost:5173)
- [ ] Navigation appears correctly
- [ ] All links work (even though state-based)
- [ ] Active state highlights correct section
- [ ] Light mode colors correct
- [ ] Dark mode colors correct
- [ ] Mobile menu works (if applicable)
- [ ] Keyboard navigation works (Tab, Enter)
- [ ] Hover effects work
- [ ] Logo link works

### Discourse Forum (forum.commonry.app)
- [ ] Navigation appears correctly
- [ ] All links point to correct URLs
- [ ] "The Square" is highlighted as active
- [ ] Light mode colors match Commonry app
- [ ] Dark mode colors match Commonry app
- [ ] Fonts match Commonry app
- [ ] Mobile menu works
- [ ] Breadcrumb shows correct context
- [ ] Links open in same tab
- [ ] No console errors

### Cross-Browser Testing
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Mobile Safari
- [ ] Mobile Chrome

---

## 🎯 Navigation Items Reference

Current navigation structure:

| Label | View/Route | URL | Aria Label |
|-------|-----------|-----|-----------|
| Logo | home | https://commonry.app | Go to Commonry home |
| Your Plot | study | https://commonry.app/study | Navigate to Your Plot - Personal study area |
| The Commons | browse | https://commonry.app/browse | Navigate to The Commons - Browse public decks |
| The Square | square | https://forum.commonry.app | Navigate to The Square - Community forum |
| Profile | profile | https://commonry.app/profile | Navigate to your profile |

**Note:** Since Commonry uses state-based routing (not URL-based), the actual URLs in the app don't change. The `url` property in `SharedNavigation` is only used when the component is rendered in Discourse.

---

## 🐛 Troubleshooting

### Navigation doesn't appear on Discourse
- **Check:** Is the Header code properly saved in the theme?
- **Check:** Is the theme applied to your site?
- **Check:** Are there any JavaScript console errors?
- **Solution:** Clear browser cache and reload

### Colors don't match between app and forum
- **Check:** Are the CSS color values exactly the same in both files?
- **Check:** Is dark mode enabled/disabled consistently?
- **Solution:** Copy hex values directly from design tokens

### Mobile menu doesn't work on Discourse
- **Check:** Is the JavaScript code included in the Header?
- **Check:** Are there any console errors?
- **Solution:** Ensure the script tags are at the bottom of the Header code

### Fonts look different
- **Check:** Is the Google Fonts import at the top of Discourse theme CSS?
- **Check:** Are the font-family declarations using the same values?
- **Solution:** Ensure IBM Plex Sans and IBM Plex Mono are loaded

### Active state not showing on Discourse
- **Check:** Does "The Square" link have `class="commonry-nav-link active"`?
- **Solution:** Ensure the `active` class is only on The Square link in Discourse

---

## 📦 File Locations

### Commonry App
```
/src/
├── components/
│   └── layout/
│       └── SharedNavigation.tsx       # Main navigation component
├── App.tsx                            # Navigation implementation
└── globals.css                        # Design tokens and theme styles
```

### Discourse Theme
```
Discourse Admin Panel:
└── Customize
    └── Themes
        └── [Your Theme]
            └── Edit CSS/HTML
                └── Header                # Navigation HTML + CSS
```

---

## 🔐 Security Notes

### Cross-Site Navigation
- All Discourse links point to `https://commonry.app` or `https://forum.commonry.app`
- No relative links used in Discourse theme
- SSO handles authentication between sites

### Content Security Policy
If you have CSP headers, ensure:
- Google Fonts domain is allowed
- Inline styles are allowed (for Discourse theme)

---

## 🚀 Deployment Workflow

### When deploying navigation changes:

1. **Development**
   - Update SharedNavigation.tsx locally
   - Test in development server (localhost:5173)
   - Commit to git

2. **Production App**
   - Deploy Commonry app to production
   - Verify navigation works on commonry.app

3. **Discourse Theme**
   - Copy updated CSS/HTML from discourse-theme-navigation.html
   - Paste into Discourse Header
   - Save theme
   - Verify navigation works on forum.commonry.app

4. **Verification**
   - Navigate between app and forum
   - Check visual consistency
   - Test all links
   - Verify SSO flow works

---

## 📞 Support

If you encounter issues:
1. Check this guide's troubleshooting section
2. Review design tokens for color/spacing mismatches
3. Inspect browser console for JavaScript errors
4. Compare rendered HTML/CSS between app and forum

---

## 🔄 Version History

### Current Version
- Light/dark mode support
- Terminal-style aesthetic
- Mobile responsive
- Accessibility features (ARIA labels, keyboard navigation)
- Commons metaphor navigation (Your Plot, The Commons, The Square, Profile)

---

## 📚 Related Documentation

- [Discourse Theme Documentation](https://meta.discourse.org/t/developer-s-guide-to-discourse-themes/93648)
- [IBM Plex Fonts](https://fonts.google.com/specimen/IBM+Plex+Mono)
- [WCAG 2.1 Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
