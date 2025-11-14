import { cn } from "@/lib/utils";

interface FeatureCardProps {
  moduleNumber: string;
  icon: string;
  title: string;
  description: string;
  features: string[];
  className?: string;
}

export function FeatureCard({
  moduleNumber,
  icon,
  title,
  description,
  features,
  className,
}: FeatureCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden",
        "bg-terminal-surface dark:bg-dark-lighter border-2 border-terminal-muted dark:border-dark-border p-8 rounded",
        "hover:border-terminal-primary dark:hover:border-cyan transition-all duration-300",
        "group",
        className,
      )}
    >
      <div className="text-terminal-muted dark:text-text-muted text-xs font-mono mb-4">
        [{moduleNumber}]
      </div>
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="terminal-primary dark:text-cyan text-2xl font-mono font-bold mb-4 whitespace-pre-line group-hover:text-shadow-terminal dark:group-hover:[text-shadow:0_0_10px_#00d9ff] transition-all">
        {title}
      </h3>
      <p className="text-terminal-base dark:text-text-primary mb-6 leading-relaxed">
        {description}
      </p>
      <div className="space-y-2">
        {features.map((feature) => (
          <div
            key={feature}
            className="text-terminal-muted dark:text-text-muted text-sm font-mono"
          >
            → {feature}
          </div>
        ))}
      </div>
    </div>
  );
}
