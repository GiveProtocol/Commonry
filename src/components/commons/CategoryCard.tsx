import { motion } from "framer-motion";
import type { BrowseCategory } from "../../services/api";

interface CategoryCardProps {
  category: BrowseCategory;
  onClick: () => void;
}

export function CategoryCard({ category, onClick }: CategoryCardProps) {
  return (
    <motion.button
      onClick={onClick}
      className="w-full text-left p-6 rounded-lg border-2 border-terminal-muted dark:border-gray-700
                 bg-terminal-surface dark:bg-dark-surface
                 hover:border-terminal-primary dark:hover:border-cyan
                 hover:shadow-terminal-glow dark:hover:shadow-cyan-glow
                 transition-all duration-200 group"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div>
        {/* Category name */}
        <h3
          className="font-mono text-lg font-bold text-terminal-primary dark:text-cyan
                      group-hover:text-shadow-terminal dark:group-hover:[text-shadow:0_0_10px_rgba(0,217,255,0.5)]
                      transition-all"
        >
          [{category.name}]
        </h3>

        {/* Description */}
        {category.description && (
          <p className="mt-1 text-sm text-terminal-muted dark:text-text-muted line-clamp-2">
            {category.description}
          </p>
        )}

        {/* Deck count */}
        <p className="mt-3 font-mono text-xs text-terminal-muted dark:text-text-muted">
          <span className="text-terminal-primary dark:text-cyan font-bold">
            {category.deckCount.toLocaleString()}
          </span>{" "}
          {category.deckCount === 1 ? "deck" : "decks"}
        </p>
      </div>
    </motion.button>
  );
}
