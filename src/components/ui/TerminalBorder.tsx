import { cn } from "@/lib/utils";

interface TerminalBorderProps {
  children: React.ReactNode;
  className?: string;
  glowOnHover?: boolean;
}

export function TerminalBorder({
  children,
  className,
  glowOnHover = false,
}: TerminalBorderProps) {
  return (
    <div
      className={cn(
        "relative border-2 border-terminal-primary dark:border-cyan",
        // Glow effect using CSS variables
        "shadow-[0_0_10px_var(--glow-primary),inset_0_0_10px_var(--glow-primary)]",
        glowOnHover && [
          "hover:shadow-[0_0_20px_var(--glow-primary-strong),inset_0_0_15px_var(--glow-primary)]",
        ],
        "transition-shadow duration-300",
        className,
      )}
    >
      {children}
    </div>
  );
}
