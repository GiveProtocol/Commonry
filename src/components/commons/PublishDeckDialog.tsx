import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Globe, Tag, Loader2 } from "lucide-react";
import { api, type BrowseCategory } from "../../services/api";

interface PublishDeckDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPublish: (categoryId: string, tags: string[]) => Promise<void>;
  deckName: string;
  deckDescription?: string;
  cardCount: number;
}

export function PublishDeckDialog({
  isOpen,
  onClose,
  onPublish,
  deckName,
  deckDescription,
  cardCount,
}: PublishDeckDialogProps) {
  const [categories, setCategories] = useState<BrowseCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  const loadCategories = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.getCategories();
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setCategories(result.data);
      }
    } catch (err) {
      setError("Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTag = () => {
    const newTag = tagInput.trim().toLowerCase();
    if (newTag && !tags.includes(newTag) && tags.length < 5) {
      setTags([...tags, newTag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async () => {
    if (!selectedCategory) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onPublish(selectedCategory, tags);
      handleClose();
    } catch (err) {
      setError("Failed to publish deck");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedCategory("");
    setTags([]);
    setTagInput("");
    setError(null);
    onClose();
  };

  const selectedCategoryData = categories.find(
    (c) => c.id === selectedCategory,
  );

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                     w-full max-w-lg p-6 rounded-lg
                     bg-terminal-surface dark:bg-dark-surface
                     border-2 border-terminal-primary dark:border-cyan
                     shadow-terminal-glow dark:shadow-cyan-glow
                     z-50 max-h-[90vh] overflow-y-auto"
        >
          <Dialog.Title className="font-mono text-lg font-bold text-terminal-primary dark:text-cyan flex items-center gap-2">
            <Globe size={20} />
            [PUBLISH_TO_COMMONS]
          </Dialog.Title>

          <Dialog.Description className="mt-2 font-mono text-sm text-terminal-muted dark:text-text-muted">
            Make your deck available for the community to discover and study
          </Dialog.Description>

          {/* Preview card */}
          <div className="mt-4 p-4 rounded-lg border-2 border-terminal-muted dark:border-gray-600 bg-terminal-base dark:bg-dark">
            <p className="font-mono text-xs text-terminal-muted dark:text-text-muted mb-2">
              Preview:
            </p>
            <h3 className="font-bold text-gray-900 dark:text-white">
              {deckName}
            </h3>
            {deckDescription && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                {deckDescription}
              </p>
            )}
            <p className="text-xs text-terminal-muted dark:text-text-muted mt-2">
              {cardCount} cards
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2
                className="animate-spin text-terminal-primary dark:text-cyan"
                size={24}
              />
            </div>
          ) : (
            <>
              {/* Category selection */}
              <div className="mt-6">
                <label className="block font-mono text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Category <span className="text-red-500">*</span>
                </label>
                <p className="font-mono text-xs text-terminal-muted dark:text-text-muted mb-3">
                  Choose the field of study that best fits your deck
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`p-3 rounded-lg border-2 text-left transition-all
                                ${
                                  selectedCategory === category.id
                                    ? "border-terminal-primary dark:border-cyan bg-terminal-primary/10 dark:bg-cyan/10"
                                    : "border-terminal-muted dark:border-gray-600 hover:border-terminal-primary/50 dark:hover:border-cyan/50"
                                }`}
                    >
                      <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                        {category.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags input */}
              <div className="mt-6">
                <label className="block font-mono text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Tags (optional)
                </label>
                <p className="font-mono text-xs text-terminal-muted dark:text-text-muted mb-3">
                  Add up to 5 tags to help people find your deck
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter a tag..."
                    disabled={tags.length >= 5}
                    className="flex-1 px-3 py-2 rounded-lg border-2
                             border-terminal-muted dark:border-gray-600
                             bg-terminal-base dark:bg-dark
                             font-mono text-sm text-gray-700 dark:text-gray-300
                             focus:border-terminal-primary dark:focus:border-cyan
                             focus:outline-none
                             disabled:opacity-50"
                  />
                  <button
                    onClick={handleAddTag}
                    disabled={!tagInput.trim() || tags.length >= 5}
                    className="px-4 py-2 rounded-lg font-mono text-sm
                             border-2 border-terminal-primary dark:border-cyan
                             text-terminal-primary dark:text-cyan
                             hover:bg-terminal-primary/10 dark:hover:bg-cyan/10
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-all"
                  >
                    Add
                  </button>
                </div>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full
                                 bg-terminal-primary/10 dark:bg-cyan/10
                                 text-terminal-primary dark:text-cyan
                                 font-mono text-xs"
                      >
                        <Tag size={12} />
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-red-500 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Final preview */}
              {selectedCategoryData && (
                <div className="mt-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
                  <p className="font-mono text-sm text-green-800 dark:text-green-300">
                    Your deck will be published to{" "}
                    <span className="font-bold">
                      {selectedCategoryData.name}
                    </span>
                    {tags.length > 0 && (
                      <>
                        {" "}
                        with tags:{" "}
                        <span className="font-bold">{tags.join(", ")}</span>
                      </>
                    )}
                  </p>
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
                  <p className="font-mono text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 font-mono text-sm
                           text-terminal-muted dark:text-text-muted
                           hover:text-gray-700 dark:hover:text-gray-300
                           transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!selectedCategory || isSubmitting}
                  className="px-6 py-2 font-mono text-sm font-bold
                           bg-terminal-primary dark:bg-cyan text-white
                           rounded-lg hover:shadow-terminal-glow dark:hover:shadow-cyan-glow
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all"
                >
                  {isSubmitting ? "Publishing..." : "Publish Deck"}
                </button>
              </div>
            </>
          )}

          <Dialog.Close asChild>
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1 rounded
                       text-terminal-muted dark:text-text-muted
                       hover:text-terminal-primary dark:hover:text-cyan
                       transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
