import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  FolderOpen,
  Upload,
  Edit2,
  Trash2,
  MoreVertical,
  Play,
  Copy,
  Book,
  Clock,
  Sparkles,
  Loader2,
  Download,
} from "lucide-react";
import { db } from "../storage/database";
import { Deck } from "../lib/srs-engine";
import { IdService } from "../services/id-service";
import { DeckId } from "../types/ids";
// skipcq: JS-C1003 - Radix UI Dialog components require namespace import
import * as Dialog from "@radix-ui/react-dialog";
// skipcq: JS-C1003 - Radix UI DropdownMenu components require namespace import
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { DeckView } from "./DeckView";
import { importAnkiDeck, CardDirection } from "../lib/anki-import";
import { exportAnkiDeck } from "../lib/anki-export";
import { useToast } from "./Toast";

interface DeckBrowserProps {
  onBack: () => void;
  onSelectDeck?: (deckId: DeckId) => void;
  onStartStudy?: (deckId?: DeckId) => void;
}

export function DeckBrowser({
  onBack,
  onSelectDeck,
  onStartStudy,
}: DeckBrowserProps) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<DeckId | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckDescription, setNewDeckDescription] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [editDeckName, setEditDeckName] = useState("");
  const [editDeckDescription, setEditDeckDescription] = useState("");
  const [showCardDirectionDialog, setShowCardDirectionDialog] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [cardDirection, setCardDirection] = useState<CardDirection>("all");
  const { showToast } = useToast();

  const loadDecks = async () => {
    const allDecks = await db.getAllDecks();
    // Update deck stats
    for (const deck of allDecks) {
      await db.updateDeckStats(deck.id);
    }
    const updatedDecks = await db.getAllDecks();
    setDecks(updatedDecks);
  };

  useEffect(() => {
    loadDecks();
  }, []);

  const handleCreateDeck = useCallback(async () => {
    if (!newDeckName.trim()) return;

    await db.createDeck(newDeckName, newDeckDescription);
    setNewDeckName("");
    setNewDeckDescription("");
    setShowCreateDialog(false);
    await loadDecks();
  }, [newDeckName, newDeckDescription]);

  const handleImportDeck = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Store the file and show card direction dialog
      setPendingImportFile(file);
      setShowCardDirectionDialog(true);

      // Reset the input so the same file can be selected again
      event.target.value = "";
    },
    [],
  );

  const handleConfirmImport = useCallback(async () => {
    if (!pendingImportFile) return;

    setIsImporting(true);
    setImportError(null);
    setShowCardDirectionDialog(false);

    try {
      const result = await importAnkiDeck(pendingImportFile, cardDirection);
      console.log(
        `Successfully imported deck: ${result.deckName} with ${result.cardCount} cards`,
      );
      await loadDecks();
      setShowImportDialog(false);
    } catch (error) {
      console.error("Failed to import deck:", error);
      setImportError(
        error instanceof Error ? error.message : "Failed to import deck",
      );
    } finally {
      setIsImporting(false);
      setPendingImportFile(null);
    }
  }, [pendingImportFile, cardDirection]);

  const handleSelectDeck = (deckId: DeckId) => {
    if (onSelectDeck) {
      onSelectDeck(deckId);
    } else {
      setSelectedDeckId(deckId);
    }
  };

  const openEditDialog = (deck: Deck) => {
    setSelectedDeck(deck);
    setEditDeckName(deck.name);
    setEditDeckDescription(deck.description || "");
    setShowEditDialog(true);
  };

  const handleEditDeck = useCallback(async () => {
    if (!selectedDeck || !editDeckName.trim()) return;

    await db.decks.update(selectedDeck.id, {
      name: editDeckName,
      description: editDeckDescription,
    });

    setEditDeckName("");
    setEditDeckDescription("");
    setSelectedDeck(null);
    setShowEditDialog(false);
    await loadDecks();
  }, [selectedDeck, editDeckName, editDeckDescription]);

  const openDeleteDialog = (deck: Deck) => {
    setSelectedDeck(deck);
    setShowDeleteDialog(true);
  };

  const handleDeleteDeck = useCallback(async () => {
    if (!selectedDeck) return;

    await db.deleteDeck(selectedDeck.id);
    setSelectedDeck(null);
    setShowDeleteDialog(false);
    await loadDecks();
  }, [selectedDeck]);

  const handleDuplicateDeck = async (deck: Deck) => {
    const newDeckName = `${deck.name} (Copy)`;
    const newDeckId = await db.createDeck(newDeckName, deck.description);

    // Copy all cards from the original deck to the new deck
    const cards = await db.cards.where("deckId").equals(deck.id).toArray();
    for (const card of cards) {
      // Generate new ID for the duplicated card
      const { id: _id, ...cardWithoutId } = card;
      await db.cards.add({
        ...cardWithoutId,
        id: IdService.generateCardId(),
        deckId: newDeckId,
      });
    }

    await loadDecks();
  };

  const handleExportDeck = async (deck: Deck) => {
    try {
      const result = await exportAnkiDeck(deck.id);

      // Create download link
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`Exported ${result.cardCount} cards to ${result.fileName}`);
      showToast(`Exported ${result.cardCount} cards successfully`, "success");
    } catch (error) {
      console.error("Failed to export deck:", error);
      showToast(
        `Failed to export deck: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
    }
  };

  const handleBackFromDeckView = useCallback(() => {
    setSelectedDeckId(null);
    loadDecks();
  }, []);

  const handleShowCreateDialog = useCallback(() => {
    setShowCreateDialog(true);
  }, []);

  const handleShowImportDialog = useCallback(() => {
    setShowImportDialog(true);
  }, []);

  // Memoized handlers for JSX props
  const handleCardDirectionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCardDirection(e.target.value as CardDirection);
    },
    [],
  );

  const handleNewDeckNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewDeckName(e.target.value);
    },
    [],
  );

  const handleNewDeckDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setNewDeckDescription(e.target.value);
    },
    [],
  );

  const handleEditDeckNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditDeckName(e.target.value);
    },
    [],
  );

  const handleEditDeckDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditDeckDescription(e.target.value);
    },
    [],
  );

  const handleMenuTriggerClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
    },
    [],
  );

  const handleEditMenuClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const deckId = e.currentTarget.dataset.deckId;
      const deck = decks.find((d) => d.id === deckId);
      if (deck) openEditDialog(deck);
    },
    [decks],
  );

  const handleDeleteMenuClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const deckId = e.currentTarget.dataset.deckId;
      const deck = decks.find((d) => d.id === deckId);
      if (deck) openDeleteDialog(deck);
    },
    [decks],
  );

  const handleExportMenuClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const deckId = e.currentTarget.dataset.deckId;
      const deck = decks.find((d) => d.id === deckId);
      if (deck) handleExportDeck(deck);
    },
    [decks],
  );

  const handleDeckClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const deckId = e.currentTarget.dataset.deckId;
    if (deckId) handleSelectDeck(deckId as DeckId);
  }, []);

  const handleDeckKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const deckId = e.currentTarget.dataset.deckId;
        if (deckId) handleSelectDeck(deckId as DeckId);
      }
    },
    [],
  );

  const handleStudyClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      const deckId = e.currentTarget.dataset.deckId;
      if (deckId) {
        if (onStartStudy) {
          onStartStudy(deckId as DeckId);
        } else {
          handleSelectDeck(deckId as DeckId);
        }
      }
    },
    [onStartStudy],
  );

  const handleDuplicateClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const deckIndex = e.currentTarget.dataset.deckIndex;
      if (deckIndex !== undefined) {
        const deck = decks[parseInt(deckIndex)];
        if (deck) handleDuplicateDeck(deck);
      }
    },
    [decks],
  );

  const getGradientClass = (index: number): string => {
    const gradients = [
      "bg-gradient-to-r from-cyan-500 via-cyan-600 to-cyan-700",
      "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500",
      "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500",
      "bg-gradient-to-r from-cyan-400 via-cyan-500 to-cyan-600",
      "bg-gradient-to-r from-pink-500 via-rose-500 to-red-500",
      "bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700",
    ];
    return gradients[index % gradients.length];
  };

  // If a deck is selected, show the DeckView
  if (selectedDeckId) {
    return <DeckView deckId={selectedDeckId} onBack={handleBackFromDeckView} />;
  }

  return (
    <div className="bg-terminal-base h-full">
      {/* Header */}
      <div className="border-b-2 border-terminal-primary dark:border-cyan py-14 shadow-terminal-glow dark:shadow-[0_2px_20px_rgba(0,217,255,0.3)]">
        <div className="flex items-center justify-between px-8 relative">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-terminal-muted dark:text-text-muted hover:terminal-primary dark:hover:text-cyan transition-colors font-mono hover:shadow-terminal-glow dark:hover:shadow-cyan-glow"
          >
            <ArrowLeft size={20} />
            ./back
          </button>

          <h1 className="text-xl font-bold font-mono absolute left-1/2 -translate-x-1/2 terminal-primary dark:text-cyan text-shadow-terminal dark:[text-shadow:0_0_15px_rgba(0,217,255,0.5)]">
            [BROWSE_DECKS]
          </h1>

          <div className="flex gap-6 font-mono">
            <button
              onClick={handleShowCreateDialog}
              className="flex items-center gap-2 text-terminal-muted dark:text-text-muted hover:terminal-accent dark:hover:text-amber transition-colors hover:[text-shadow:0_0_8px_currentColor]"
            >
              <Plus size={20} />
              [Create]
            </button>
            <button
              onClick={handleShowImportDialog}
              className="flex items-center gap-2 text-terminal-muted dark:text-text-muted hover:terminal-primary dark:hover:text-cyan transition-colors hover:[text-shadow:0_0_8px_currentColor]"
            >
              <Upload size={20} />
              [Import]
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {decks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-terminal-surface dark:bg-dark-surface border-2 border-terminal-accent dark:border-amber rounded-lg p-8 text-center shadow-terminal-accent-glow dark:shadow-[0_0_30px_rgba(251,191,36,0.3)]"
          >
            <FolderOpen
              size={48}
              className="mx-auto terminal-accent dark:text-amber mb-4"
            />
            <h2 className="text-xl font-bold terminal-accent dark:text-amber mb-2 font-mono text-shadow-terminal-accent dark:[text-shadow:0_0_15px_rgba(251,191,36,0.5)]">
              NO_DECKS_FOUND
            </h2>
            <p className="text-terminal-muted dark:text-text-muted mb-6 font-mono">
              $ ./create --deck || ./import --anki
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleShowCreateDialog}
                className="px-6 py-3 bg-terminal-primary dark:bg-cyan hover:bg-terminal-primary/90 dark:hover:bg-cyan-dark text-paper dark:text-dark rounded transition-all font-mono font-bold shadow-terminal-glow dark:shadow-cyan-glow border border-terminal-primary dark:border-cyan"
              >
                Create Deck
              </button>
              <button
                onClick={handleShowImportDialog}
                className="px-6 py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-xl transition-colors"
              >
                Import Deck
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {decks.map((deck, index) => (
              <motion.div
                key={deck.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4, scale: 1.02 }}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm hover:shadow-xl transition-all duration-200 overflow-hidden group"
              >
                {/* Gradient Header */}
                <div
                  className={`h-16 ${getGradientClass(index)} relative flex items-center justify-between px-4`}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-white" size={20} />
                    <span className="text-white font-semibold text-sm">
                      Study Deck
                    </span>
                  </div>

                  {/* 3-Dot Menu in Header */}
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        className="p-1.5 rounded-lg text-white hover:bg-white/20 transition-colors"
                        onClick={handleMenuTriggerClick}
                      >
                        <MoreVertical size={18} />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 min-w-[160px] z-50"
                        sideOffset={5}
                      >
                        <DropdownMenu.Item
                          className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer outline-none"
                          onClick={handleEditMenuClick}
                          data-deck-id={deck.id}
                        >
                          <Edit2 size={16} className="text-cyan-500" />
                          Edit Deck
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer outline-none"
                          onClick={handleDuplicateClick}
                          data-deck-index={index}
                        >
                          <Copy size={16} className="text-cyan-500" />
                          Duplicate
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer outline-none"
                          onClick={handleExportMenuClick}
                          data-deck-id={deck.id}
                        >
                          <Download size={16} className="text-green-500" />
                          Export to Anki
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded cursor-pointer outline-none border-t border-gray-200 dark:border-gray-700"
                          onClick={handleDeleteMenuClick}
                          data-deck-id={deck.id}
                        >
                          <Trash2 size={16} />
                          Delete
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>

                {/* Card Content */}
                <div className="p-5">
                  <div
                    onClick={handleDeckClick}
                    onKeyDown={handleDeckKeyDown}
                    data-deck-id={deck.id}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer mb-4"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {deck.name}
                    </h3>
                    {deck.description && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2">
                        {deck.description}
                      </p>
                    )}
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                      <Book
                        className="mx-auto mb-1 text-gray-600 dark:text-gray-400"
                        size={16}
                      />
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {deck.cardCount}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Cards
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                      <Clock
                        className="mx-auto mb-1 text-amber-600 dark:text-amber-400"
                        size={16}
                      />
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {deck.dueCount}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Due
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                      <Sparkles
                        className="mx-auto mb-1 text-cyan-600 dark:text-cyan-400"
                        size={16}
                      />
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {deck.newCount}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        New
                      </p>
                    </div>
                  </div>

                  {/* Study Now Button */}
                  <button
                    onClick={handleStudyClick}
                    data-deck-id={deck.id}
                    className="w-full py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                  >
                    <Play size={18} />
                    Study Now
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Deck Dialog */}
      <Dialog.Root open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-dark-surface rounded-lg p-0 w-full max-w-md border-2 border-cyan shadow-[0_0_40px_rgba(0,217,255,0.3)] overflow-hidden">
            {/* Terminal header */}
            <div className="h-8 bg-dark-border border-b-2 border-cyan/30 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-amber/50" />
              <div className="w-3 h-3 rounded-full bg-cyan/50" />
              <span className="ml-2 text-xs font-mono text-text-muted">./create-deck</span>
            </div>

            <div className="p-6">
              <Dialog.Title className="text-xl font-bold text-cyan mb-4 font-mono [text-shadow:0_0_15px_rgba(0,217,255,0.5)]">
                [CREATE_NEW_DECK]
              </Dialog.Title>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="new-deck-name"
                    className="block text-text-muted text-sm mb-2 font-mono"
                  >
                    $ --name=
                  </label>
                  <input
                    id="new-deck-name"
                    type="text"
                    value={newDeckName}
                    onChange={handleNewDeckNameChange}
                    className="w-full px-4 py-2 bg-dark border-2 border-cyan/30 rounded text-cyan placeholder-text-muted focus:outline-none focus:border-cyan focus:shadow-cyan-glow font-mono transition-all"
                    placeholder="enter deck name..."
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-deck-description"
                    className="block text-text-muted text-sm mb-2 font-mono"
                  >
                    $ --description= (optional)
                  </label>
                  <textarea
                    id="new-deck-description"
                    value={newDeckDescription}
                    onChange={handleNewDeckDescriptionChange}
                    className="w-full px-4 py-2 bg-dark border-2 border-cyan/30 rounded text-cyan placeholder-text-muted focus:outline-none focus:border-cyan focus:shadow-cyan-glow resize-none font-mono transition-all"
                    placeholder="enter description..."
                    rows={3}
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <Dialog.Close asChild>
                    <button className="px-4 py-2 text-text-muted hover:text-amber transition-colors font-mono hover:[text-shadow:0_0_8px_currentColor]">
                      [Cancel]
                    </button>
                  </Dialog.Close>
                  <button
                    onClick={handleCreateDeck}
                    disabled={!newDeckName.trim()}
                    className="px-6 py-2 bg-cyan hover:bg-cyan-dark disabled:bg-dark-border disabled:text-text-muted text-dark rounded font-mono font-bold transition-all shadow-cyan-glow border border-cyan disabled:shadow-none disabled:border-dark-border"
                  >
                    ./create
                  </button>
                </div>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Import Deck Dialog */}
      <Dialog.Root open={showImportDialog} onOpenChange={setShowImportDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-dark-surface rounded-lg p-0 w-full max-w-md border-2 border-amber shadow-[0_0_40px_rgba(251,191,36,0.3)] overflow-hidden">
            {/* Terminal header */}
            <div className="h-8 bg-dark-border border-b-2 border-amber/30 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-amber/50" />
              <div className="w-3 h-3 rounded-full bg-cyan/50" />
              <span className="ml-2 text-xs font-mono text-text-muted">./import-deck</span>
            </div>

            <div className="p-6">
              <Dialog.Title className="text-xl font-bold text-amber mb-4 font-mono [text-shadow:0_0_15px_rgba(251,191,36,0.5)]">
                [IMPORT_ANKI_DECK]
              </Dialog.Title>
              <div className="space-y-4">
                {importError && (
                  <div className="bg-red-900/20 border-2 border-red-500/50 rounded-lg p-4">
                    <p className="text-red-400 text-sm font-mono">
                      ERROR: {importError}
                    </p>
                  </div>
                )}

                {isImporting ? (
                  <div className="border-2 border-amber/30 rounded-lg p-8 text-center bg-dark">
                    <Loader2
                      size={48}
                      className="mx-auto text-amber mb-4 animate-spin"
                    />
                    <p className="text-amber font-semibold text-lg mb-2 font-mono [text-shadow:0_0_15px_rgba(251,191,36,0.5)]">
                      IMPORTING_DECK...
                    </p>
                    <p className="text-text-muted text-sm font-mono">
                      $ processing anki deck...
                    </p>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-amber/30 rounded-lg p-8 text-center hover:border-amber hover:shadow-amber-glow transition-all">
                    <Upload
                      size={48}
                      className="mx-auto text-amber mb-4"
                    />
                    <p className="text-text-muted mb-4 font-mono">
                      $ select .apkg file
                    </p>
                    <label className="inline-block px-6 py-3 bg-amber hover:bg-amber-dark text-dark rounded transition-all cursor-pointer font-mono font-bold shadow-amber-glow border border-amber">
                      ./choose-file
                      <input
                        type="file"
                        accept=".apkg"
                        onChange={handleImportDeck}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <Dialog.Close asChild>
                    <button
                      className="px-4 py-2 text-text-muted hover:text-amber transition-colors font-mono hover:[text-shadow:0_0_8px_currentColor] disabled:opacity-50"
                      disabled={isImporting}
                    >
                      [Cancel]
                    </button>
                  </Dialog.Close>
                </div>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Edit Deck Dialog */}
      <Dialog.Root open={showEditDialog} onOpenChange={setShowEditDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-dark-surface rounded-lg p-0 w-full max-w-md border-2 border-cyan shadow-[0_0_40px_rgba(0,217,255,0.3)] overflow-hidden">
            {/* Terminal header */}
            <div className="h-8 bg-dark-border border-b-2 border-cyan/30 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-amber/50" />
              <div className="w-3 h-3 rounded-full bg-cyan/50" />
              <span className="ml-2 text-xs font-mono text-text-muted">./edit-deck</span>
            </div>

            <div className="p-6">
              <Dialog.Title className="text-xl font-bold text-cyan mb-4 font-mono [text-shadow:0_0_15px_rgba(0,217,255,0.5)]">
                [EDIT_DECK]
              </Dialog.Title>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="edit-deck-name"
                    className="block text-text-muted text-sm mb-2 font-mono"
                  >
                    $ --name=
                  </label>
                  <input
                    id="edit-deck-name"
                    type="text"
                    value={editDeckName}
                    onChange={handleEditDeckNameChange}
                    className="w-full px-4 py-2 bg-dark border-2 border-cyan/30 rounded text-cyan placeholder-text-muted focus:outline-none focus:border-cyan focus:shadow-cyan-glow font-mono transition-all"
                    placeholder="enter deck name..."
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-deck-description"
                    className="block text-text-muted text-sm mb-2 font-mono"
                  >
                    $ --description= (optional)
                  </label>
                  <textarea
                    id="edit-deck-description"
                    value={editDeckDescription}
                    onChange={handleEditDeckDescriptionChange}
                    className="w-full px-4 py-2 bg-dark border-2 border-cyan/30 rounded text-cyan placeholder-text-muted focus:outline-none focus:border-cyan focus:shadow-cyan-glow resize-none font-mono transition-all"
                    placeholder="enter description..."
                    rows={3}
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <Dialog.Close asChild>
                    <button className="px-4 py-2 text-text-muted hover:text-amber transition-colors font-mono hover:[text-shadow:0_0_8px_currentColor]">
                      [Cancel]
                    </button>
                  </Dialog.Close>
                  <button
                    onClick={handleEditDeck}
                    disabled={!editDeckName.trim()}
                    className="px-6 py-2 bg-cyan hover:bg-cyan-dark disabled:bg-dark-border disabled:text-text-muted text-dark rounded font-mono font-bold transition-all shadow-cyan-glow border border-cyan disabled:shadow-none disabled:border-dark-border"
                  >
                    ./save
                  </button>
                </div>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Deck Dialog */}
      <Dialog.Root open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-dark-surface rounded-lg p-0 w-full max-w-md border-2 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.3)] overflow-hidden">
            {/* Terminal header */}
            <div className="h-8 bg-dark-border border-b-2 border-red-500/30 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <span className="ml-2 text-xs font-mono text-text-muted">./delete-deck --confirm</span>
            </div>

            <div className="p-6">
              <Dialog.Title className="text-xl font-bold text-red-400 mb-4 font-mono [text-shadow:0_0_15px_rgba(239,68,68,0.5)]">
                [WARNING_DELETE]
              </Dialog.Title>
              <Dialog.Description className="text-text-muted mb-6 font-mono text-sm">
                <div className="mb-2">$ TARGET: &quot;{selectedDeck?.name}&quot;</div>
                <div className="mb-2">$ CARDS: {selectedDeck?.cardCount}</div>
                <div className="text-red-400">$ ACTION: IRREVERSIBLE</div>
              </Dialog.Description>
              <div className="flex gap-3 justify-end">
                <Dialog.Close asChild>
                  <button className="px-4 py-2 text-text-muted hover:text-cyan transition-colors font-mono hover:[text-shadow:0_0_8px_currentColor]">
                    [Cancel]
                  </button>
                </Dialog.Close>
                <button
                  onClick={handleDeleteDeck}
                  className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded font-mono font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.5)] border border-red-500"
                >
                  ./delete --force
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Card Direction Dialog */}
      <Dialog.Root
        open={showCardDirectionDialog}
        onOpenChange={setShowCardDirectionDialog}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-dark-surface rounded-lg p-0 w-full max-w-md border-2 border-cyan shadow-[0_0_40px_rgba(0,217,255,0.3)] overflow-hidden">
            {/* Terminal header */}
            <div className="h-8 bg-dark-border border-b-2 border-cyan/30 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-amber/50" />
              <div className="w-3 h-3 rounded-full bg-cyan/50" />
              <span className="ml-2 text-xs font-mono text-text-muted">./configure-import</span>
            </div>

            <div className="p-6">
              <Dialog.Title className="text-xl font-bold text-cyan mb-4 font-mono [text-shadow:0_0_15px_rgba(0,217,255,0.5)]">
                [SELECT_DIRECTION]
              </Dialog.Title>
              <Dialog.Description className="text-text-muted mb-6 font-mono text-sm">
                $ --mode=?
              </Dialog.Description>

              <div className="space-y-3 mb-6">
                <label
                  aria-label="Both Directions - Import all cards"
                  className="flex items-start gap-3 p-3 rounded-lg border-2 border-cyan/30 hover:border-cyan hover:shadow-cyan-glow cursor-pointer transition-all bg-dark"
                >
                  <input
                    type="radio"
                    name="cardDirection"
                    value="all"
                    checked={cardDirection === "all"}
                    onChange={handleCardDirectionChange}
                    className="mt-1 accent-cyan"
                  />
                  <div>
                    <div className="font-semibold text-cyan font-mono">
                      [BIDIRECTIONAL]
                    </div>
                    <div className="text-sm text-text-muted font-mono">
                      ↔ all cards (front + back)
                    </div>
                  </div>
                </label>

                <label
                  aria-label="Forward Only - First card template only"
                  className="flex items-start gap-3 p-3 rounded-lg border-2 border-cyan/30 hover:border-cyan hover:shadow-cyan-glow cursor-pointer transition-all bg-dark"
                >
                  <input
                    type="radio"
                    name="cardDirection"
                    value="forward"
                    checked={cardDirection === "forward"}
                    onChange={handleCardDirectionChange}
                    className="mt-1 accent-cyan"
                  />
                  <div>
                    <div className="font-semibold text-cyan font-mono">
                      [FORWARD_ONLY]
                    </div>
                    <div className="text-sm text-text-muted font-mono">
                      → first template (e.g., img → text)
                    </div>
                  </div>
                </label>

                <label
                  aria-label="Reverse Only - Second card template only"
                  className="flex items-start gap-3 p-3 rounded-lg border-2 border-cyan/30 hover:border-cyan hover:shadow-cyan-glow cursor-pointer transition-all bg-dark"
                >
                  <input
                    type="radio"
                    name="cardDirection"
                    value="reverse"
                    checked={cardDirection === "reverse"}
                    onChange={handleCardDirectionChange}
                    className="mt-1 accent-cyan"
                  />
                  <div>
                    <div className="font-semibold text-cyan font-mono">
                      [REVERSE_ONLY]
                    </div>
                    <div className="text-sm text-text-muted font-mono">
                      ← second template (e.g., text → img)
                    </div>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 justify-end">
                <Dialog.Close asChild>
                  <button className="px-4 py-2 text-text-muted hover:text-amber transition-colors font-mono hover:[text-shadow:0_0_8px_currentColor]">
                    [Cancel]
                  </button>
                </Dialog.Close>
                <button
                  onClick={handleConfirmImport}
                  className="px-6 py-2 bg-cyan hover:bg-cyan-dark text-dark rounded font-mono font-bold transition-all shadow-cyan-glow border border-cyan"
                >
                  ./import
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
