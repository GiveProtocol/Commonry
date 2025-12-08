import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api, type BrowseCategory, type BrowseDeck } from "../../services/api";
import { CategoryCard } from "./CategoryCard";
import { FeaturedDeckRow } from "./FeaturedDeckRow";

interface CommonsViewProps {
  onBack: () => void;
  onCategorySelect: (categorySlug: string) => void;
  onDeckSelect?: (deckId: string) => void;
}

export function CommonsView({
  onBack,
  onCategorySelect,
  onDeckSelect,
}: CommonsViewProps) {
  const [categories, setCategories] = useState<BrowseCategory[]>([]);
  const [featuredDecks, setFeaturedDecks] = useState<BrowseDeck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load categories and featured decks in parallel
      const [categoriesResult, featuredResult] = await Promise.all([
        api.getCategories(),
        api.getFeaturedDecks(),
      ]);

      if (categoriesResult.error) {
        setError(categoriesResult.error);
      } else if (categoriesResult.data) {
        setCategories(categoriesResult.data);
      }

      if (featuredResult.data) {
        setFeaturedDecks(featuredResult.data);
      }
    } catch (err) {
      setError("Failed to load categories");
      console.error("Error loading commons data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCategoryClick = useCallback(
    (category: BrowseCategory) => {
      onCategorySelect(category.slug);
    },
    [onCategorySelect],
  );

  const handleFeaturedDeckClick = useCallback(
    (deckId: string) => {
      if (onDeckSelect) {
        onDeckSelect(deckId);
      }
    },
    [onDeckSelect],
  );

  return (
    <div className="bg-terminal-base dark:bg-dark min-h-screen">
      {/* Header */}
      <div className="border-b-2 border-terminal-primary dark:border-cyan py-6 px-8">
        <div className="max-w-6xl mx-auto">
          {/* Back button and title */}
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-terminal-muted dark:text-text-muted
                         hover:text-terminal-primary dark:hover:text-cyan transition-colors font-mono text-sm"
            >
              <ArrowLeft size={16} />
              ./back
            </button>
          </div>

          <h1
            className="font-mono text-3xl font-bold text-terminal-primary dark:text-cyan
                        text-shadow-terminal dark:text-shadow-cyan"
          >
            [THE_COMMONS]
          </h1>
          <p className="font-mono text-sm text-terminal-muted dark:text-text-muted mt-2">
            Discover and study public decks from the community
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2
              className="animate-spin text-terminal-primary dark:text-cyan"
              size={32}
            />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-500 dark:text-red-400 font-mono mb-4">
              {error}
            </p>
            <button
              onClick={loadData}
              className="font-mono text-terminal-primary dark:text-cyan hover:underline"
            >
              [RETRY]
            </button>
          </div>
        ) : (
          <>
            {/* Featured decks row */}
            <FeaturedDeckRow
              decks={featuredDecks}
              onDeckClick={handleFeaturedDeckClick}
            />

            {/* Categories section */}
            <div>
              <h2 className="font-mono text-lg font-bold text-terminal-primary dark:text-cyan mb-6">
                [FIELDS_OF_STUDY]
              </h2>

              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                initial="hidden"
                animate="visible"
                variants={{
                  visible: {
                    transition: {
                      staggerChildren: 0.05,
                    },
                  },
                }}
              >
                {categories.map((category, index) => (
                  <motion.div
                    key={category.id}
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <CategoryCard
                      category={category}
                      onClick={() => handleCategoryClick(category)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Stats footer */}
            <div className="mt-12 pt-6 border-t border-terminal-muted dark:border-gray-700">
              <p className="font-mono text-xs text-terminal-muted dark:text-text-muted text-center">
                {categories
                  .reduce((sum, cat) => sum + cat.deckCount, 0)
                  .toLocaleString()}{" "}
                public decks across {categories.length} fields of study
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
