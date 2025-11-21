import * as Tooltip from "@radix-ui/react-tooltip";
import { ReactNode } from "react";

interface TerminalTooltipProps {
  content: string | ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delayDuration?: number;
}

export function TerminalTooltip({
  content,
  children,
  side = "top",
  align = "center",
  delayDuration = 200,
}: TerminalTooltipProps) {
  return (
    <Tooltip.Provider delayDuration={delayDuration}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            align={align}
            className="bg-dark-surface border-2 border-cyan rounded px-3 py-2 font-mono text-sm text-cyan shadow-[0_0_20px_rgba(0,217,255,0.4)] z-50 animate-[fadeIn_0.2s_ease-in]"
            sideOffset={5}
          >
            <div className="flex items-center gap-2">
              <span className="text-text-muted">$</span>
              <span>{content}</span>
            </div>
            <Tooltip.Arrow className="fill-cyan" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

// Variant with custom styling
interface TerminalTooltipCustomProps {
  content: string | ReactNode;
  children: ReactNode;
  variant?: "info" | "warning" | "error" | "success";
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delayDuration?: number;
}

export function TerminalTooltipCustom({
  content,
  children,
  variant = "info",
  side = "top",
  align = "center",
  delayDuration = 200,
}: TerminalTooltipCustomProps) {
  const variantStyles = {
    info: "border-cyan text-cyan shadow-[0_0_20px_rgba(0,217,255,0.4)]",
    warning: "border-amber text-amber shadow-[0_0_20px_rgba(251,191,36,0.4)]",
    error: "border-red-500 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)]",
    success:
      "border-green-500 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.4)]",
  };

  const arrowColors = {
    info: "fill-cyan",
    warning: "fill-amber",
    error: "fill-red-500",
    success: "fill-green-500",
  };

  return (
    <Tooltip.Provider delayDuration={delayDuration}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            align={align}
            className={`bg-dark-surface border-2 rounded px-3 py-2 font-mono text-sm z-50 animate-[fadeIn_0.2s_ease-in] ${variantStyles[variant]}`}
            sideOffset={5}
          >
            <div className="flex items-center gap-2">
              <span className="text-text-muted">$</span>
              <span>{content}</span>
            </div>
            <Tooltip.Arrow className={arrowColors[variant]} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
