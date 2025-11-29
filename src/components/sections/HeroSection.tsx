import { useState, useCallback } from "react";
import { TerminalBorder } from "../ui/TerminalBorder";
import { GlowText } from "../ui/GlowText";
import { TerminalButton } from "../ui/TerminalButton";
import { StatDisplay } from "../ui/StatDisplay";
import { TypingText } from "../ui/TypingText";

type View = "home" | "study" | "browse" | "stats" | "square" | "profile";

interface HeroSectionProps {
  onNavigate: (view: View) => void;
}

export function HeroSection({ onNavigate }: HeroSectionProps) {
  const [showContent, setShowContent] = useState(false);

  const handleTypingComplete = useCallback(() => {
    setShowContent(true);
  }, []);

  const handleStudyClick = useCallback(() => {
    onNavigate("study");
  }, [onNavigate]);

  const handleBrowseClick = useCallback(() => {
    onNavigate("browse");
  }, [onNavigate]);

  return (
    <div className="min-h-screen bg-terminal-base flex items-center justify-center px-6 py-20 relative overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 grid-bg opacity-30" />

      <div className="relative z-10 max-w-6xl w-full">
        {/* Terminal Header */}
        <TerminalBorder className="mb-8 p-6">
          <div className="font-mono text-terminal-muted text-sm mb-2">
            <TypingText
              text="commonry@localhost:~$ cat mission.txt"
              speed={30}
              onComplete={handleTypingComplete}
            />
          </div>
          {showContent && (
            <div className="flex gap-4 flex-wrap">
              <span className="px-3 py-1 border border-terminal-primary terminal-primary text-xs font-mono animate-[fadeIn_0.3s_ease-in]">
                [OPEN-SOURCE]
              </span>
              <span className="px-3 py-1 border border-terminal-primary terminal-primary text-xs font-mono animate-[fadeIn_0.3s_ease-in_0.1s] opacity-0 [animation-fill-mode:forwards]">
                [NON-PROFIT]
              </span>
              <span className="px-3 py-1 border border-terminal-primary terminal-primary text-xs font-mono animate-[fadeIn_0.3s_ease-in_0.2s] opacity-0 [animation-fill-mode:forwards]">
                [INFRASTRUCTURE]
              </span>
            </div>
          )}
        </TerminalBorder>

        {/* Main Headline */}
        <div className="text-center mb-12">
          {showContent && (
            <>
              <h1 className="text-6xl md:text-8xl font-mono font-bold mb-6 leading-tight animate-[fadeIn_0.5s_ease-in_0.3s] opacity-0 [animation-fill-mode:forwards]">
                <GlowText color="amber">A COMMONS</GlowText>
                <br />
                <span className="text-terminal-base dark:text-text-primary">
                  FOR
                </span>
                <br />
                <GlowText color="cyan">LIFELONG LEARNING</GlowText>
              </h1>

              <div className="max-w-2xl mx-auto">
                <div className="text-left font-mono text-terminal-muted space-y-2 mb-8">
                  <div className="flex items-start gap-2 animate-[fadeIn_0.5s_ease-in_0.5s] opacity-0 [animation-fill-mode:forwards]">
                    <span className="terminal-primary">&gt;</span>
                    <span>
                      Spaced repetition engineered for sustained focus.
                    </span>
                  </div>
                  <div className="flex items-start gap-2 animate-[fadeIn_0.5s_ease-in_0.6s] opacity-0 [animation-fill-mode:forwards]">
                    <span className="terminal-primary">&gt;</span>
                    <span>Architected for ADHD learners.</span>
                  </div>
                  <div className="flex items-start gap-2 animate-[fadeIn_0.5s_ease-in_0.7s] opacity-0 [animation-fill-mode:forwards]">
                    <span className="terminal-primary">&gt;</span>
                    <span>Built as infrastructure, not a product.</span>
                  </div>
                </div>

                {/* CTAs */}
                <div className="flex gap-4 justify-center mb-12 animate-[fadeIn_0.5s_ease-in_0.8s] opacity-0 [animation-fill-mode:forwards]">
                  <TerminalButton
                    variant="cyan"
                    onClick={handleStudyClick}
                    className="px-8 py-4 text-sm"
                  >
                    $ ./start-learning
                  </TerminalButton>
                  <TerminalButton
                    variant="amber"
                    onClick={handleBrowseClick}
                    className="px-8 py-4 text-sm"
                  >
                    $ ./browse-decks
                  </TerminalButton>
                </div>

                {/* Stats */}
                <div className="mb-8 animate-[fadeIn_0.5s_ease-in_0.9s] opacity-0 [animation-fill-mode:forwards]">
                  <div className="terminal-primary font-mono text-sm mb-4">
                    $ ./fetch-stats --global
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatDisplay
                      label="PUBLIC_DECKS"
                      value="15,247"
                      subtitle="COMMUNITY CURATED"
                    />
                    <StatDisplay
                      label="ACTIVE_LEARNERS"
                      value="8,932"
                      subtitle="THIS MONTH"
                    />
                    <StatDisplay
                      label="CARDS_REVIEWED"
                      value="2.4M"
                      subtitle="TOTAL"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
