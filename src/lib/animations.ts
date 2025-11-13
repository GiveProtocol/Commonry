export const terminalAnimations = {
  // Typing effect
  typing: (text: string, speed = 50) => {
    return new Promise<void>((resolve) => {
      let index = 0;
      const interval = setInterval(() => {
        index++;
        if (index >= text.length) {
          clearInterval(interval);
          resolve();
        }
      }, speed);
    });
  },

  // Command line prompt
  commandPrompt: "commonry@localhost:~$",

  // Status indicators
  statusDots: (status: "loading" | "success" | "error") => {
    const styles = {
      loading: "animate-pulse text-amber",
      success: "text-cyan",
      error: "text-red-500",
    };
    return styles[status];
  },

  // Terminal status symbols
  statusSymbols: {
    loading: "⣾⣽⣻⢿⡿⣟⣯⣷",
    success: "✓",
    error: "✗",
    warning: "⚠",
    info: "ℹ",
  },

  // Animation sequences
  sequences: {
    fadeIn: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.3 },
    },
    slideUp: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.5 },
    },
    glitchIn: {
      initial: { opacity: 0, x: -10 },
      animate: { opacity: 1, x: 0 },
      transition: { duration: 0.2, ease: "easeOut" },
    },
    scanLine: {
      initial: { y: "-100%" },
      animate: { y: "100%" },
      transition: { duration: 8, repeat: Infinity, ease: "linear" },
    },
  },

  // Terminal color codes (ANSI-style)
  colors: {
    cyan: "#00d9ff",
    amber: "#fbbf24",
    green: "#10b981",
    red: "#ef4444",
    yellow: "#eab308",
    blue: "#3b82f6",
    purple: "#a855f7",
    gray: "#6b7280",
  },

  // Utility for creating typing effect hook
  useTypingEffect: (text: string, speed = 50) => {
    // This would be implemented as a custom React hook
    // For now, returning a simple implementation guide
    return {
      displayText: text,
      isTyping: false,
    };
  },
};

// Helper function for creating loading spinner
export const getLoadingSpinner = (frame: number): string => {
  const spinners = ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"];
  return spinners[frame % spinners.length];
};

// Helper function for creating progress bar
export const createProgressBar = (
  progress: number,
  width = 20,
  filled = "█",
  empty = "░",
): string => {
  const filledWidth = Math.round((progress / 100) * width);
  const emptyWidth = width - filledWidth;
  return `${filled.repeat(filledWidth)}${empty.repeat(emptyWidth)}`;
};

// Terminal-style timestamp
export const getTerminalTimestamp = (): string => {
  const now = new Date();
  return now.toISOString().replace("T", " ").split(".")[0];
};

// Command builder
export const buildCommand = (command: string, args: string[] = []): string => {
  return `$ ${command} ${args.join(" ")}`.trim();
};

// Status message formatter
export const formatStatusMessage = (
  status: "success" | "error" | "warning" | "info",
  message: string,
): { symbol: string; color: string; message: string } => {
  const config = {
    success: { symbol: "✓", color: "text-cyan" },
    error: { symbol: "✗", color: "text-red-500" },
    warning: { symbol: "⚠", color: "text-amber" },
    info: { symbol: "ℹ", color: "text-blue-500" },
  };

  return {
    ...config[status],
    message,
  };
};
