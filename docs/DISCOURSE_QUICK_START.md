# Discourse Theme Quick Start Guide

## What You Need to Copy

The file `discourse-theme.md` contains TWO main code blocks:

1. **Header HTML** (starts around line 17)
2. **Common CSS** (starts around line 104)

## Step-by-Step Installation

### STEP 1: Access Discourse Admin

1. Go to: `https://forum.commonry.app/admin/customize/themes`
2. Click on your active theme (or create a new one)
3. Click "Edit CSS/HTML" button

### STEP 2: Add Header HTML

1. In the Discourse theme editor, click the **"Header"** tab (left sidebar)
2. Open the file: `/home/rb347841/Commonry/docs/discourse-theme.md`
3. **Scroll to line 17** where you see:
   ```
   ### Step 2: Add Header HTML

   Go to **Header** section and paste the following:

   ```html
   ```
4. **Copy everything from** `<script type="text/discourse-plugin"`
   **all the way to** the closing `</nav>` tag (around line 102)

5. **Paste into Discourse Header tab**

### STEP 3: Add Common CSS

1. In the Discourse theme editor, click the **"Common"** tab under CSS section
2. In `discourse-theme.md`, **scroll to line 104** where you see:
   ```
   ### Step 3: Add CSS

   Go to **Common** CSS section and paste the following:

   ```css
   ```
3. **Copy everything from** `/* =================================================================`
   **all the way to** the end of the CSS block (around line 565)

4. **Paste into Discourse Common CSS tab**

### STEP 4: Save

1. Click **"Save"** button in Discourse
2. Visit `https://forum.commonry.app` to see the changes

---

## Visual Guide

Here's what you're looking for in the file:

```
discourse-theme.md
├── Installation Instructions (lines 1-15)
├── 📋 HEADER HTML SECTION (lines 17-102)  ← COPY THIS
│   └── Starts with: <script type="text/discourse-plugin"
│       Ends with: </nav>
├── 📋 COMMON CSS SECTION (lines 104-565)  ← COPY THIS
│   └── Starts with: /* =================================================================
│       Ends with: last closing brace }
└── Additional Options (lines 566+)
```

---

## I'll Create Separate Files for You

To make this easier, let me create two separate files:
