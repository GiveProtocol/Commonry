import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  /**
   * When true, shows "Commonry" as the first item linking to the main site
   * Use this on Discourse to link back to Commonry
   */
  showCommonryHome?: boolean;
}

/**
 * Breadcrumb Component
 *
 * Provides visual continuity across Commonry and Discourse by showing
 * the current location within the site hierarchy.
 *
 * Example usage on Commonry:
 * <Breadcrumb items={[
 *   { label: "The Square", current: true }
 * ]} />
 *
 * Example usage on Discourse:
 * <Breadcrumb
 *   showCommonryHome
 *   items={[
 *     { label: "The Square", href: "https://commonry.app/square" },
 *     { label: "General Discussion", current: true }
 *   ]}
 * />
 */
export function Breadcrumb({ items, showCommonryHome = false }: BreadcrumbProps) {
  const allItems = showCommonryHome
    ? [{ label: "Commonry", href: "https://commonry.app" }, ...items]
    : items;

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex items-center gap-2 font-mono text-sm">
        {showCommonryHome && (
          <>
            <li>
              <a
                href="https://commonry.app"
                className="flex items-center gap-2 text-terminal-muted dark:text-text-muted hover:terminal-primary dark:hover:text-cyan transition-colors"
                aria-label="Return to Commonry homepage"
              >
                <Home className="w-4 h-4" />
                <span>Commonry</span>
              </a>
            </li>
            <ChevronRight className="w-3 h-3 text-terminal-muted dark:text-text-muted" aria-hidden="true" />
          </>
        )}

        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          // Use a stable key based on content, not index
          const itemKey = item.href || item.label;

          return (
            <li key={itemKey} className="flex items-center gap-2">
              {item.href && !isLast ? (
                <a
                  href={item.href}
                  className="text-terminal-muted dark:text-text-muted hover:terminal-primary dark:hover:text-cyan transition-colors"
                >
                  {item.label}
                </a>
              ) : (
                <span
                  className={isLast ? "terminal-primary dark:text-cyan font-bold" : "text-terminal-muted dark:text-text-muted"}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}

              {!isLast && (
                <ChevronRight className="w-3 h-3 text-terminal-muted dark:text-text-muted" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
