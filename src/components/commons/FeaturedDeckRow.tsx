import { motion } from "framer-motion";
import { Star, Users, Book } from "lucide-react";
import type { BrowseDeck } from "../../services/api";

interface FeaturedDeckRowProps {
  decks: BrowseDeck[];
  onDeckClick: (deckId: string) => void;
}

export function FeaturedDeckRow({ decks, onDeckClick }: FeaturedDeckRowProps) {
  if (decks.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="font-mono text-lg font-bold text-terminal-primary dark:text-cyan mb-4">
        [FEATURED_PICKS]
      </h2>

      <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 scrollbar-thin scrollbar-thumb-terminal-muted dark:scrollbar-thumb-gray-600">
        {decks.map((deck, index) => (
          <motion.button
            key={deck.id}
            onClick={() => onDeckClick(deck.id)}
            className="flex-shrink-0 w-64 text-left rounded-lg border-2 border-amber-500/50 dark:border-amber-400/50
                       bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20
                       hover:border-amber-500 dark:hover:border-amber-400
                       hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] dark:hover:shadow-[0_0_15px_rgba(251,191,36,0.3)]
                       transition-all duration-200 overflow-hidden"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
          >
            {/* Featured badge */}
            <div className="px-3 py-1 bg-amber-500 dark:bg-amber-600 text-white text-xs font-mono flex items-center gap-1">
              <Star size={12} className="fill-current" />
              FEATURED
            </div>

            <div className="p-4">
              {/* Deck name */}
              <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1">
                {deck.name}
              </h3>

              {/* Author */}
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                by {deck.author.displayName || deck.author.username}
              </p>

              {/* Description */}
              {deck.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                  {deck.description}
                </p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-500">
                <span className="flex items-center gap-1">
                  <Book size={12} />
                  {deck.cardCount}
                </span>
                <span className="flex items-center gap-1">
                  <Users size={12} />
                  {deck.subscriberCount.toLocaleString()}
                </span>
                {deck.averageRating && (
                  <span className="flex items-center gap-1">
                    <Star size={12} className="text-amber-500" />
                    {deck.averageRating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
