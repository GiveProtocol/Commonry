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
        "relative border-2 border-terminal-primary",
        // Light mode: green glow
        "shadow-[0_0_10px_var(--terminal-green-glow),inset_0_0_10px_var(--terminal-green-glow)]",
        // Dark mode: cyan glow
        "dark:shadow-[0_0_10px_rgba(0,217,255,0.3),inset_0_0_10px_rgba(0,217,255,0.1)]",
        glowOnHover && [
          "hover:shadow-[0_0_20px_var(--shadow),inset_0_0_15px_var(--terminal-green-glow)]",
          "dark:hover:shadow-[0_0_20px_rgba(0,217,255,0.5),inset_0_0_15px_rgba(0,217,255,0.2)]",
        ],
        "transition-shadow duration-300",
        className,
      )}
    >
      {children}
    </div>
  );
}
