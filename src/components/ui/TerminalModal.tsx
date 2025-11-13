import * as Dialog from "@radix-ui/react-dialog";
import { ReactNode } from "react";
import { X } from "lucide-react";

interface TerminalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  commandName?: string;
  children: ReactNode;
  variant?: "cyan" | "amber" | "red";
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

export function TerminalModal({
  open,
  onOpenChange,
  title,
  commandName,
  children,
  variant = "cyan",
  maxWidth = "md",
}: TerminalModalProps) {
  const borderColors = {
    cyan: "border-terminal-primary shadow-terminal-glow dark:border-cyan dark:shadow-[0_0_40px_rgba(0,217,255,0.3)]",
    amber:
      "border-terminal-accent shadow-terminal-accent-glow dark:border-amber dark:shadow-[0_0_40px_rgba(251,191,36,0.3)]",
    red: "border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.3)]",
  };

  const titleColors = {
    cyan: "terminal-primary text-shadow-terminal dark:text-cyan dark:[text-shadow:0_0_15px_rgba(0,217,255,0.5)]",
    amber:
      "terminal-accent text-shadow-terminal-accent dark:text-amber dark:[text-shadow:0_0_15px_rgba(251,191,36,0.5)]",
    red: "text-red-400 [text-shadow:0_0_15px_rgba(239,68,68,0.5)]",
  };

  const headerBorderColors = {
    cyan: "border-terminal-primary/30 dark:border-cyan/30",
    amber: "border-terminal-accent/30 dark:border-amber/30",
    red: "border-red-500/30",
  };

  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  };

  const dotColors = {
    cyan: {
      main: "bg-green/50 dark:bg-cyan/50",
      secondary: "bg-orange/50 dark:bg-amber/50",
      close: "bg-red-500/50",
    },
    amber: {
      main: "bg-orange/50 dark:bg-amber/50",
      secondary: "bg-green/50 dark:bg-cyan/50",
      close: "bg-red-500/50",
    },
    red: {
      main: "bg-red-500",
      secondary: "bg-red-500/50",
      close: "bg-red-500/50",
    },
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-in]" />
        <Dialog.Content
          className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-terminal-surface dark:bg-dark-surface rounded-lg p-0 w-full ${maxWidthClasses[maxWidth]} border-2 ${borderColors[variant]} overflow-hidden animate-[fadeIn_0.2s_ease-in]`}
        >
          {/* Terminal header */}
          <div
            className={`h-8 bg-terminal-muted dark:bg-dark-border border-b-2 ${headerBorderColors[variant]} flex items-center justify-between px-4`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${dotColors[variant].close}`}
              />
              <div
                className={`w-3 h-3 rounded-full ${dotColors[variant].secondary}`}
              />
              <div
                className={`w-3 h-3 rounded-full ${dotColors[variant].main}`}
              />
              {commandName && (
                <span className="ml-2 text-xs font-mono text-terminal-muted dark:text-text-muted">
                  {commandName}
                </span>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                className="text-terminal-muted dark:text-text-muted hover:text-red-400 transition-colors"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-6">
            <Dialog.Title
              className={`text-xl font-bold mb-4 font-mono ${titleColors[variant]}`}
            >
              {title}
            </Dialog.Title>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Footer component for consistent button layout
interface TerminalModalFooterProps {
  children: ReactNode;
  align?: "left" | "center" | "right";
}

export function TerminalModalFooter({
  children,
  align = "right",
}: TerminalModalFooterProps) {
  const alignClasses = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  };

  return (
    <div className={`flex gap-3 mt-6 ${alignClasses[align]}`}>{children}</div>
  );
}
