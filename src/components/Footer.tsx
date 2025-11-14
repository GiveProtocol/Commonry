interface FooterProps {
  onNavigate?: (view: "home") => void;
}

export function Footer({ onNavigate: _onNavigate }: FooterProps) {
  return (
    <footer className="border-t-2 border-terminal-muted dark:border-dark-border bg-terminal-base mt-auto">
      <div className="max-w-7xl mx-auto px-8 py-6">
        <div className="text-center">
          <div className="font-mono text-terminal-muted dark:text-text-muted text-sm mb-2">
            $ echo &quot;Infrastructure, not a product&quot; |
            ./commit-to-commons
          </div>
          <div className="font-mono text-terminal-muted dark:text-text-muted text-xs">
            └─ Operated by Give Protocol Foundation • MIT License
          </div>
        </div>
      </div>
    </footer>
  );
}
