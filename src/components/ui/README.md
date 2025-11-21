# Terminal UI Components

This directory contains reusable terminal-themed UI components for the Commonry application.

## Components

### TerminalTooltip

A terminal-styled tooltip component with Radix UI.

**Usage:**

```tsx
import { TerminalTooltip } from './ui/TerminalTooltip';

<TerminalTooltip content="hint: click to edit">
  <button>Edit Deck</button>
</TerminalTooltip>

// With custom variant
<TerminalTooltipCustom content="warning: this will delete data" variant="warning">
  <button>Delete</button>
</TerminalTooltipCustom>
```

**Variants:**

- `info` (cyan, default)
- `warning` (amber)
- `error` (red)
- `success` (green)

---

### TerminalModal

A reusable modal component with terminal window styling.

**Usage:**

```tsx
import { TerminalModal, TerminalModalFooter } from "./ui/TerminalModal";

<TerminalModal
  open={isOpen}
  onOpenChange={setIsOpen}
  title="[CREATE_DECK]"
  commandName="./create-deck"
  variant="cyan"
  maxWidth="md"
>
  <p className="text-text-muted font-mono">Modal content here...</p>

  <TerminalModalFooter>
    <button onClick={handleCancel}>Cancel</button>
    <button onClick={handleConfirm}>Confirm</button>
  </TerminalModalFooter>
</TerminalModal>;
```

**Props:**

- `variant`: "cyan" | "amber" | "red"
- `maxWidth`: "sm" | "md" | "lg" | "xl"
- `commandName`: Optional command shown in header

---

### Toast (Updated)

Terminal-styled toast notifications.

**Usage:**

```tsx
import { useToast } from "../Toast";

const { showToast } = useToast();

showToast("Deck created successfully!", "success");
showToast("Failed to import deck", "error");
showToast("Processing...", "info");
```

**Features:**

- Terminal window header with traffic lights
- Monospace font
- Auto-dismiss after 5 seconds
- Success (✓), Error (✗), Info (ℹ) symbols

---

## Command History

Track user actions as terminal commands.

### useCommandHistory Hook

**Usage:**

```tsx
import {
  useCommandHistory,
  CommandTemplates,
} from "../hooks/useCommandHistory";

const { addCommand, history, clearHistory } = useCommandHistory();

// Add a command
addCommand(CommandTemplates.createDeck("My Deck"), "action", "success");
addCommand('./study --deck="Spanish"', "action", "info", { deckId: "123" });

// Get recent commands
const recent = getRecentCommands(5);

// Search history
const results = searchHistory("create");
```

### CommandHistory Component

Displays command history with search and filters.

**Usage:**

```tsx
import { CommandHistory } from "../CommandHistory";

<CommandHistory maxVisible={10} showSearch={true} />;
```

**Features:**

- Search commands
- Filter by type (action, navigation, system)
- Shows timestamps
- Color-coded results (success/error/info)
- Expandable list
- Clear history

---

## Styling

All components use the terminal design system with:

- Cyan (#00d9ff) and Amber (#fbbf24) primary colors
- IBM Plex Mono font
- Glow effects on borders
- Dark backgrounds
- Traffic light window controls
