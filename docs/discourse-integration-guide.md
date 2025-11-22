# Discourse Integration Guide for Commonry

## Overview

This guide explains how Commonry and Discourse (The Square) are integrated to feel like one unified application.

**Note:** Your application is built with **Vite + React**, not Next.js. The architecture has been optimized for this stack.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Experience                      │
│  Seamless navigation between Commonry ↔ The Square     │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
┌───────────────────┐                 ┌──────────────────┐
│  commonry.app     │                 │ forum.commonry   │
│  (Vite + React)   │◄───SSO Auth────►│ .app (Discourse) │
│                   │                 │                  │
│ - SharedNavigation│                 │ - Same Navigation│
│ - The Square View │                 │ - Commonry Theme │
│ - Breadcrumb      │                 │ - Breadcrumb     │
└───────────────────┘                 └──────────────────┘
        │                                       │
        └───────────────────┬───────────────────┘
                            ▼
                  ┌──────────────────┐
                  │  Shared Design   │
                  │     Tokens       │
                  │                  │
                  │ - Colors         │
                  │ - Typography     │
                  │ - Spacing        │
                  │ - Components     │
                  └──────────────────┘
```

## What Was Implemented

### 1. Enhanced Square View (`src/components/SquareView.tsx`)

**Added Features:**
- ✅ Categories grid showing forum sections with color-coded labels
- ✅ Forum statistics (topics, members, posts)
- ✅ Recent topics list
- ✅ Breadcrumb navigation showing "Commonry > The Square"
- ✅ SSO integration for seamless login

**API Integration:**
- Fetches from `https://forum.commonry.app/latest.json`
- Fetches from `https://forum.commonry.app/categories.json`
- Fetches from `https://forum.commonry.app/site.json` (stats)

**User Flow:**
1. User clicks "The Square" in navigation
2. Sees preview of forum activity (categories + recent topics)
3. Clicks "Enter The Square" button
4. SSO authenticates user automatically
5. Redirects to forum with user already logged in

### 2. Shared Navigation (`src/components/layout/SharedNavigation.tsx`)

**Already Exists** - This component is designed to work on both sites!

**Features:**
- Logo linking to commonry.app
- Navigation links: Your Plot | The Commons | The Square | Profile
- Active state highlighting
- Mobile-responsive hamburger menu (via `MobileNavigation`)
- Dark mode support
- Keyboard navigation (ARIA compliant)

**Usage:**

```tsx
// On Commonry app
<SharedNavigation
  currentView="square"
  onNavigate={(view) => setCurrentView(view)}
/>

// On Discourse (conceptually - implemented via HTML/CSS)
<SharedNavigation
  currentView="square"
  isExternal={true}  // Links go to full URLs
/>
```

### 3. Breadcrumb Component (`src/components/layout/Breadcrumb.tsx`)

**New Component** - Provides visual continuity

**Features:**
- Shows current location hierarchy
- Links back to parent pages
- Different modes for Commonry vs Discourse

**Usage on Commonry:**
```tsx
<Breadcrumb items={[
  { label: "The Square", current: true }
]} />
```

**Usage on Discourse (via HTML):**
```tsx
<Breadcrumb
  showCommonryHome
  items={[
    { label: "The Square", href: "https://forum.commonry.app" },
    { label: "Category Name", current: true }
  ]}
/>
```

### 4. Discourse Theme Files

**Location:** `docs/discourse-theme.md`

**Contents:**
- Complete HTML for navigation header
- Complete CSS mirroring Commonry styles
- Dark mode support
- Mobile responsive design
- Accessibility features

**Installation:**
1. Go to Discourse Admin → Customize → Themes
2. Edit CSS/HTML
3. Paste Header HTML from docs
4. Paste Common CSS from docs
5. Save and preview

### 5. Design Tokens Documentation

**Location:** `docs/design-tokens.md`

**Contents:**
- Complete color system (light + dark mode)
- Typography scale and font families
- Spacing scale
- Shadow and glow effects
- Component patterns
- Accessibility guidelines

## File Structure

```
Commonry/
├── src/
│   ├── components/
│   │   ├── SquareView.tsx                    # Enhanced with categories
│   │   └── layout/
│   │       ├── SharedNavigation.tsx          # Already existed, works great!
│   │       ├── Navigation.tsx                # Landing page nav
│   │       └── Breadcrumb.tsx                # NEW - Visual continuity
│   ├── services/
│   │   └── discourse-api.ts                  # API integration
│   ├── globals.css                           # Design tokens (CSS variables)
│   └── index.css
├── docs/
│   ├── discourse-integration-guide.md        # THIS FILE
│   ├── discourse-theme.md                    # Copy-paste into Discourse
│   └── design-tokens.md                      # Complete design system
├── tailwind.config.js                        # Tailwind theme config
└── .env                                      # Config (VITE_DISCOURSE_URL, etc.)
```

## How to Deploy Changes

### Updating Commonry App

1. Make changes to React components
2. Test locally: `npm run dev`
3. Build: `npm run build`
4. Deploy to Netlify (automatic via git push)

```bash
# Make changes
vim src/components/SquareView.tsx

# Test
npm run dev

# Commit and push (triggers Netlify deploy)
git add .
git commit -m "Update Square view"
git push
```

### Updating Discourse Theme

1. Edit HTML/CSS in Discourse Admin
2. **OR** update `docs/discourse-theme.md` and copy-paste to Discourse
3. Save changes
4. Verify on forum.commonry.app

**Important:** Keep Discourse theme in sync with Commonry changes!

## Keeping Navigation in Sync

When you update navigation in Commonry:

### Step 1: Update SharedNavigation.tsx

```tsx
// Add new nav item
const navItems = useMemo(() => [
  // ... existing items
  {
    view: "newview",
    label: "New View",
    url: "https://commonry.app/newview",
    ariaLabel: "Navigate to new view",
    onClick: () => handleNavigate("newview", "https://commonry.app/newview")
  }
], [handleNavigate]);
```

### Step 2: Update Discourse Theme HTML

Go to `docs/discourse-theme.md` and update the navigation HTML:

```html
<!-- Add new link -->
<span class="commonry-nav-separator">|</span>
<a
  href="https://commonry.app/newview"
  class="commonry-nav-link"
  role="menuitem"
>
  [New View]
</a>
```

### Step 3: Update Discourse Admin

Copy-paste the updated HTML to Discourse Admin → Themes → Header

## Design Token Updates

When changing colors, fonts, or other design tokens:

### Step 1: Update globals.css

```css
:root {
  --terminal-green: #00a86b;  /* Change this */
}
```

### Step 2: Update tailwind.config.js

```js
colors: {
  green: {
    DEFAULT: 'var(--terminal-green)',
    // ...
  }
}
```

### Step 3: Update Discourse Theme CSS

In `docs/discourse-theme.md` CSS section:

```css
:root {
  --commonry-green: #00a86b;  /* Change this */
}
```

### Step 4: Copy to Discourse Admin

Paste updated CSS into Discourse Admin → Themes → Common CSS

### Step 5: Update Documentation

Update `docs/design-tokens.md` with the new values

## Testing Checklist

Before deploying changes:

- [ ] Test on Commonry app (commonry.app)
  - [ ] Navigation works
  - [ ] The Square view loads
  - [ ] Categories display correctly
  - [ ] Recent topics show up
  - [ ] SSO login works

- [ ] Test on Discourse (forum.commonry.app)
  - [ ] Navigation appears correctly
  - [ ] Links go to right destinations
  - [ ] "The Square" is marked as active
  - [ ] Breadcrumb shows correctly

- [ ] Test dark mode
  - [ ] Toggle dark mode on commonry.app
  - [ ] Enable dark mode in browser/OS for forum
  - [ ] Check all colors render correctly

- [ ] Test responsive design
  - [ ] Mobile view (< 768px)
  - [ ] Tablet view (768px - 1024px)
  - [ ] Desktop view (> 1024px)

- [ ] Test accessibility
  - [ ] Keyboard navigation (Tab key)
  - [ ] Screen reader (check ARIA labels)
  - [ ] Color contrast (use browser tools)

- [ ] Test SSO flow
  - [ ] Log out of both sites
  - [ ] Log in to commonry.app
  - [ ] Click "The Square" → should auto-login to forum
  - [ ] Verify username matches on both sites

## Troubleshooting

### Issue: Forum API not loading

**Symptoms:** Categories or topics not showing on The Square

**Solution:**
```bash
# Check Discourse is running
curl https://forum.commonry.app/latest.json

# Check CORS settings in Discourse Admin
# Admin → Settings → Security → cors_origins
# Should include: https://commonry.app
```

### Issue: Navigation looks different on forum

**Symptoms:** Styles don't match between app and forum

**Solution:**
1. Compare `src/globals.css` with Discourse theme CSS
2. Ensure all CSS variables are defined
3. Check that fonts are loading (IBM Plex Mono/Sans)
4. Clear Discourse cache: Admin → Tools → Clear Cache

### Issue: SSO not working

**Symptoms:** User not logged in when entering forum

**Solution:**
```bash
# Check environment variables
cat .env | grep DISCOURSE

# Should have:
# DISCOURSE_SSO_SECRET=...
# DISCOURSE_URL=http://forum.commonry.app

# Check Discourse SSO settings:
# Admin → Settings → Login
# - enable_discourse_connect = true
# - discourse_connect_url = https://api.commonry.app/api/discourse/sso
# - discourse_connect_secret = [matching secret from .env]
```

### Issue: Dark mode not working on forum

**Symptoms:** Forum stays in light mode

**Solution:**

Ensure dark mode detection script is in Discourse Header:

```javascript
<script type="text/discourse-plugin" version="0.8">
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (isDarkMode) {
    document.documentElement.classList.add('dark');
  }
</script>
```

## Future Enhancements

### Potential Improvements

1. **Real-time Activity Stream**
   - WebSocket connection to show live forum activity
   - Notification badges for new posts

2. **Unified Search**
   - Search across both app content and forum posts
   - Single search bar in navigation

3. **Cross-Platform Notifications**
   - Forum replies appear in Commonry app
   - Study reminders can link to forum discussions

4. **Embedded Forum Widgets**
   - Show recent forum posts in study views
   - Display related discussions when viewing decks

5. **Progressive Web App**
   - Install Commonry as PWA
   - Offline access to forum content

6. **Advanced Breadcrumbs**
   - Dynamic breadcrumbs based on Discourse category/topic
   - Deep linking back to specific forum sections from app

## Support and Resources

### Documentation
- [Discourse Theme Developer Guide](https://meta.discourse.org/t/developer-s-guide-to-discourse-themes/93648)
- [Discourse API Docs](https://docs.discourse.org/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Framer Motion Docs](https://www.framer.com/motion/)

### Commonry-Specific Docs
- [Design Tokens](design-tokens.md)
- [Discourse Theme](discourse-theme.md)
- This Integration Guide

### Quick Reference

**Environment Variables:**
```bash
VITE_DISCOURSE_URL=https://forum.commonry.app
VITE_API_URL=https://api.commonry.app
DISCOURSE_SSO_SECRET=<your-secret>
DISCOURSE_URL=http://forum.commonry.app
```

**Key Files:**
- Navigation: `src/components/layout/SharedNavigation.tsx`
- Square View: `src/components/SquareView.tsx`
- API Service: `src/services/discourse-api.ts`
- Design Tokens: `src/globals.css`
- Theme Config: `tailwind.config.js`

**Discourse Admin URLs:**
- Themes: `https://forum.commonry.app/admin/customize/themes`
- SSO Settings: `https://forum.commonry.app/admin/site_settings/category/login`
- CORS Settings: `https://forum.commonry.app/admin/site_settings/category/security`

## Version History

- **v1.0.0** (2025-01-22): Initial integration
  - Shared navigation component
  - Enhanced Square view with categories
  - Breadcrumb component
  - Complete Discourse theme
  - Design tokens documentation

---

**Questions or Issues?**

If you encounter problems not covered in this guide:

1. Check the troubleshooting section above
2. Review the design tokens documentation
3. Verify environment variables are set correctly
4. Test the SSO flow end-to-end
5. Clear all caches (browser, Discourse, Netlify)

Happy integrating! 🏛️
