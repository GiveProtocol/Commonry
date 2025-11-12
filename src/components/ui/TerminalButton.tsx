import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface TerminalButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'cyan' | 'amber';
}

export const TerminalButton = forwardRef<HTMLButtonElement, TerminalButtonProps>(
  ({ className, variant = 'cyan', children, ...props }, ref) => {
    const variantStyles = {
      cyan: cn(
        'border-terminal-primary terminal-primary',
        'hover:shadow-terminal-glow',
        'dark:border-cyan dark:text-cyan dark:hover:shadow-[0_0_20px_rgba(0,217,255,0.6)]'
      ),
      amber: cn(
        'border-terminal-accent terminal-accent',
        'hover:shadow-terminal-accent-glow',
        'dark:border-amber dark:text-amber dark:hover:shadow-[0_0_20px_rgba(251,191,36,0.6)]'
      ),
    };

    return (
      <button
        ref={ref}
        className={cn(
          "relative overflow-hidden",
          "border-2 bg-transparent font-mono font-bold uppercase tracking-wider",
          "transition-all duration-300",
          "before:content-[''] before:absolute before:top-0 before:left-[-100%]",
          "before:w-full before:h-full before:transition-all before:duration-300",
          "before:z-[-1]",
          variant === 'cyan' && "before:bg-terminal-primary hover:text-paper dark:before:bg-cyan dark:hover:text-dark",
          variant === 'amber' && "before:bg-terminal-accent hover:text-paper dark:before:bg-amber dark:hover:text-dark",
          "hover:before:left-0",
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

TerminalButton.displayName = 'TerminalButton';
