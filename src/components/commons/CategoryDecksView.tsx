import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, ChevronRight } from "lucide-react";
import {
  api,
  type BrowseCategory,
  type BrowseDeck,
  type BrowseTag,
} from "../../services/api";
import { PublicDeckCard } from "./PublicDeckCard";
import { SortDropdown, type SortOption } from "./SortDropdown";
import { TagFilter } from "./TagFilter";
import { FlagDeckDialog } from "./FlagDeckDialog";

interface CategoryDecksViewProps {
  categorySlug: string;
  onBack: () => void;
  onDeckSelect: (deckId: string) => void;
}

export function CategoryDecksView({
  categorySlug,
  onBack,
  onDeckSelect,
}: CategoryDecksViewProps) {
  const [category, setCategory] = useState<BrowseCategory | null>(null);
  const [decks, setDecks] = useState<BrowseDeck[]>([]);
  const [tags, setTags] = useState<BrowseTag[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [sortBy, setSortBy] = useState<SortOption>("community");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const limit = 12;

  // Flag dialog state
  const [flagDeckId, setFlagDeckId] = useState<string | null>(null);
  const [flagDeckName, setFlagDeckName] = useState<string>("");

  const loadDecks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.getCategoryDecks(categorySlug, {
        sort: sortBy,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        page,
        limit,
      });

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setCategory(result.data.category);
        setDecks(result.data.decks);
        setTags(result.data.tags);
        setTotal(result.data.total);
      }
    } catch (err) {
      setError("Failed to load decks");
      console.error("Error loading category decks:", err);
    } finally {
      setIsLoading(false);
    }
  }, [categorySlug, sortBy, selectedTags, page, limit]);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [sortBy, selectedTags]);

  const handleTagToggle = useCallback((tagSlug: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagSlug)
        ? prev.filter((t) => t !== tagSlug)
        : [...prev, tagSlug],
    );
  }, []);

  const handleClearTags = useCallback(() => {
    setSelectedTags([]);
  }, []);

  const handleSubscribe = useCallback(
    async (deckId: string, isSubscribed: boolean) => {
      try {
        if (isSubscribed) {
          await api.unsubscribeFromDeck(deckId);
        } else {
          await api.subscribeToDeck(deckId);
        }
        // Refresh decks to get updated subscription status
        loadDecks();
      } catch (err) {
        console.error("Failed to update subscription:", err);
      }
    },
    [loadDecks],
  );

  const handleFlag = useCallback((deckId: string, deckName: string) => {
    setFlagDeckId(deckId);
    setFlagDeckName(deckName);
  }, []);

  const handleFlagSubmit = useCallback(
    async (reason: string) => {
      if (!flagDeckId) return;

      try {
        const result = await api.flagDeck(flagDeckId, reason);
        if (result.error) {
          console.error("Failed to flag deck:", result.error);
        }
      } catch (err) {
        console.error("Failed to flag deck:", err);
      } finally {
        setFlagDeckId(null);
        setFlagDeckName("");
      }
    },
    [flagDeckId],
  );

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="bg-terminal-base dark:bg-dark min-h-screen">
      {/* Header */}
      <div className="border-b-2 border-terminal-primary dark:border-cyan py-6 px-8">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-2 font-mono text-sm">
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-terminal-muted dark:text-text-muted
                         hover:text-terminal-primary dark:hover:text-cyan transition-colors"
            >
              <ArrowLeft size={14} />
              [THE_COMMONS]
            </button>
            <ChevronRight
              size={14}
              className="text-terminal-muted dark:text-text-muted"
            />
            <span className="text-terminal-primary dark:text-cyan font-bold">
              [{category?.name?.toUpperCase().replace(/\s+/g, "_") || "..."}]
            </span>
          </div>

          {/* Title */}
          <h1
            className="font-mono text-3xl font-bold text-terminal-primary dark:text-cyan
                        text-shadow-terminal dark:text-shadow-cyan"
          >
            {category?.name || "Loading..."}
          </h1>
          {category?.description && (
            <p className="font-mono text-sm text-terminal-muted dark:text-text-muted mt-2">
              {category.description}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-8">
        {/* Filters row */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <TagFilter
              tags={tags}
              selectedTags={selectedTags}
              onTagToggle={handleTagToggle}
              onClearAll={handleClearTags}
            />
          </div>
          <SortDropdown value={sortBy} onChange={setSortBy} />
        </div>

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
              onClick={loadDecks}
              className="font-mono text-terminal-primary dark:text-cyan hover:underline"
            >
              [RETRY]
            </button>
          </div>
        ) : decks.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-terminal-muted dark:text-text-muted font-mono">
              {selectedTags.length > 0
                ? "No decks match the selected filters"
                : "No public decks in this category yet"}
            </p>
            {selectedTags.length > 0 && (
              <button
                onClick={handleClearTags}
                className="mt-4 font-mono text-terminal-primary dark:text-cyan hover:underline"
              >
                [CLEAR_FILTERS]
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Results count */}
            <p className="font-mono text-xs text-terminal-muted dark:text-text-muted mb-4">
              Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)}{" "}
              of {total} decks
            </p>

            {/* Deck grid */}
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
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
              {decks.map((deck, index) => (
                <motion.div
                  key={deck.id}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ delay: index * 0.03 }}
                >
                  <PublicDeckCard
                    deck={deck}
                    onClick={() => onDeckSelect(deck.id)}
                    onSubscribe={() =>
                      handleSubscribe(deck.id, deck.isSubscribed || false)
                    }
                    onFlag={() => handleFlag(deck.id, deck.name)}
                    isSubscribed={deck.isSubscribed}
                  />
                </motion.div>
              ))}
            </motion.div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 font-mono text-sm rounded-lg border-2
                             border-terminal-muted dark:border-gray-600
                             hover:border-terminal-primary dark:hover:border-cyan
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors"
                >
                  ← Prev
                </button>
                <span className="font-mono text-sm text-terminal-muted dark:text-text-muted px-4">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 font-mono text-sm rounded-lg border-2
                             border-terminal-muted dark:border-gray-600
                             hover:border-terminal-primary dark:hover:border-cyan
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Flag dialog */}
      <FlagDeckDialog
        isOpen={flagDeckId !== null}
        onClose={() => {
          setFlagDeckId(null);
          setFlagDeckName("");
        }}
        onSubmit={handleFlagSubmit}
        deckName={flagDeckName}
      />
    </div>
  );
}
