import { cn } from "@/lib/utils";

interface StatDisplayProps {
  label: string;
  value: string | number;
  subtitle?: string;
  className?: string;
}

export function StatDisplay({
  label,
  value,
  subtitle,
  className,
}: StatDisplayProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden",
        "bg-terminal-surface dark:bg-dark-lighter border-2 border-terminal-muted dark:border-dark-border p-6 rounded",
        "after:content-[''] after:absolute after:top-0 after:left-[-100%]",
        "after:w-full after:h-full",
        "after:bg-gradient-to-r after:from-transparent after:via-green/10 after:to-transparent",
        "dark:after:via-cyan/10",
        "after:animate-shimmer",
        className,
      )}
    >
      <div className="text-terminal-muted dark:text-text-muted text-sm font-mono mb-2">
        [{label}]
      </div>
      <div className="terminal-primary dark:text-cyan text-3xl font-mono font-bold mb-1">
        {value}
      </div>
      {subtitle && (
        <div className="text-terminal-muted dark:text-text-muted text-xs font-mono">
          └─ {subtitle}
        </div>
      )}
    </div>
  );
}
