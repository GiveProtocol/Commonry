import { cn } from '@/lib/utils';

interface GlowTextProps {
  children: React.ReactNode;
  className?: string;
  color?: 'cyan' | 'amber';
}

export function GlowText({ children, className, color = 'cyan' }: GlowTextProps) {
  const glowStyles = {
    cyan: cn(
      // Light mode: green
      'text-green [text-shadow:0_0_10px_var(--terminal-green),0_0_20px_var(--terminal-green),0_0_30px_var(--terminal-green-glow)]',
      // Dark mode: cyan
      'dark:text-cyan dark:[text-shadow:0_0_10px_#00d9ff,0_0_20px_#00d9ff,0_0_30px_#00d9ff]'
    ),
    amber: cn(
      // Light mode: orange
      'text-orange [text-shadow:0_0_10px_var(--terminal-orange),0_0_20px_var(--terminal-orange)]',
      // Dark mode: amber
      'dark:text-amber dark:[text-shadow:0_0_10px_#fbbf24,0_0_20px_#fbbf24]'
    ),
  };

  return (
    <span className={cn("font-mono font-bold", glowStyles[color], className)}>
      {children}
    </span>
  );
}
