import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { BrowseTag } from "../../services/api";

interface TagFilterProps {
  tags: BrowseTag[];
  selectedTags: string[];
  onTagToggle: (tagSlug: string) => void;
  onClearAll?: () => void;
}

export function TagFilter({
  tags,
  selectedTags,
  onTagToggle,
  onClearAll,
}: TagFilterProps) {
  if (tags.length === 0) return null;

  const hasSelectedTags = selectedTags.length > 0;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-mono text-xs text-terminal-muted dark:text-text-muted">
          Filter by tags:
        </span>
        {hasSelectedTags && onClearAll && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 text-xs text-terminal-muted dark:text-text-muted
                       hover:text-terminal-primary dark:hover:text-cyan transition-colors font-mono"
          >
            <X size={12} />
            Clear all
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 -mx-2 px-2">
        {tags.map((tag) => {
          const isSelected = selectedTags.includes(tag.slug);
          return (
            <motion.button
              key={tag.id}
              onClick={() => onTagToggle(tag.slug)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full font-mono text-xs
                         border-2 transition-all duration-200
                         ${
                           isSelected
                             ? "border-terminal-primary dark:border-cyan bg-terminal-primary/10 dark:bg-cyan/10 text-terminal-primary dark:text-cyan font-bold shadow-terminal-glow dark:shadow-cyan-glow"
                             : "border-terminal-muted dark:border-gray-600 text-terminal-muted dark:text-text-muted hover:border-terminal-primary dark:hover:border-cyan hover:text-terminal-primary dark:hover:text-cyan"
                         }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {tag.name}
              {tag.usageCount !== undefined && tag.usageCount > 0 && (
                <span className="ml-1 opacity-60">({tag.usageCount})</span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
