# Discourse Theme Quick Start Guide

## Easy Installation - Copy from Separate Files

I've created separate files to make this super easy:

### STEP 1: Access Discourse Admin

1. Go to: `https://forum.commonry.app/admin/customize/themes`
2. Click on your active theme (or create a new one)
3. Click "Edit CSS/HTML" button

### STEP 2: Add Header HTML

1. In the Discourse theme editor, click the **"Header"** tab (left sidebar)
2. Open the file: `/home/rb347841/Commonry/docs/discourse-header.html`
3. **Select all and copy** (Ctrl+A, Ctrl+C or Cmd+A, Cmd+C)
4. **Paste into Discourse Header tab**

### STEP 3: Add Common CSS

1. In the Discourse theme editor, click the **"Common"** tab under CSS section
2. Open the file: `/home/rb347841/Commonry/docs/discourse-styles.css`
3. **Select all and copy** (Ctrl+A, Ctrl+C or Cmd+A, Cmd+C)
4. **Paste into Discourse Common CSS tab**

### STEP 4: Save

1. Click **"Save"** button in Discourse
2. Visit `https://forum.commonry.app` to see the changes

---

## Files to Copy

You have THREE ways to get the code:

### Option 1: Separate Files (EASIEST)

- **HTML**: `/home/rb347841/Commonry/docs/discourse-header.html`
- **CSS**: `/home/rb347841/Commonry/docs/discourse-styles.css`

### Option 2: Combined Documentation

- **Full Guide**: `/home/rb347841/Commonry/docs/discourse-theme.md`
  - Contains both HTML and CSS with instructions
  - HTML is in lines 18-115
  - CSS is in lines 120-471

### Option 3: Command Line

```bash
# Copy HTML to clipboard (if you have xclip)
cat /home/rb347841/Commonry/docs/discourse-header.html | xclip -selection clipboard

# Copy CSS to clipboard
cat /home/rb347841/Commonry/docs/discourse-styles.css | xclip -selection clipboard
```

---

## Visual Guide

```
docs/
├── discourse-header.html        ← Paste into Discourse Header tab
├── discourse-styles.css         ← Paste into Discourse Common CSS tab
├── discourse-theme.md           ← Full documentation with both
├── design-tokens.md             ← Design system reference
└── discourse-integration-guide.md ← Complete integration guide
```

---
