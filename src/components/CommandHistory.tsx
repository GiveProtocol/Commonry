import { useState, useCallback, ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal,
  Clock,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  useCommandHistory,
  CommandHistoryEntry,
} from "../hooks/useCommandHistory";
import { TerminalBorder } from "./ui/TerminalBorder";

interface CommandHistoryProps {
  maxVisible?: number;
  showSearch?: boolean;
}

// Shared helper functions
function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function getResultColor(result?: "success" | "error" | "info"): string {
  switch (result) {
    case "success":
      return "text-green-400";
    case "error":
      return "text-red-400";
    case "info":
      return "text-cyan";
    default:
      return "text-text-muted";
  }
}

function getResultSymbol(result?: "success" | "error" | "info"): string {
  switch (result) {
    case "success":
      return "✓";
    case "error":
      return "✗";
    case "info":
      return "ℹ";
    default:
      return "→";
  }
}

export function CommandHistory({
  maxVisible = 20,
  showSearch = true,
}: CommandHistoryProps) {
  const { history, clearHistory, searchHistory } = useCommandHistory();
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [filterType, setFilterType] = useState<
    "all" | "action" | "navigation" | "system"
  >("all");

  const filteredHistory = searchQuery
    ? searchHistory(searchQuery)
    : filterType === "all"
      ? history
      : history.filter((entry) => entry.type === filterType);

  const displayHistory = isExpanded
    ? filteredHistory
    : filteredHistory.slice(0, maxVisible);

  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleFilterAll = useCallback(() => setFilterType("all"), []);
  const handleFilterAction = useCallback(() => setFilterType("action"), []);
  const handleFilterNavigation = useCallback(
    () => setFilterType("navigation"),
    [],
  );
  const handleFilterSystem = useCallback(() => setFilterType("system"), []);

  const filterHandlers: Record<
    "all" | "action" | "navigation" | "system",
    () => void
  > = {
    all: handleFilterAll,
    action: handleFilterAction,
    navigation: handleFilterNavigation,
    system: handleFilterSystem,
  };

  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <TerminalBorder className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-cyan" />
          <h2 className="text-xl font-bold text-cyan font-mono [text-shadow:0_0_15px_rgba(0,217,255,0.5)]">
            [COMMAND_HISTORY]
          </h2>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="flex items-center gap-2 text-text-muted hover:text-red-400 transition-colors font-mono text-sm"
          >
            <Trash2 size={16} />
            ./clear
          </button>
        )}
      </div>

      {/* Search and Filters */}
      {showSearch && (
        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="$ grep..."
              className="w-full pl-10 pr-4 py-2 bg-dark border-2 border-cyan/30 rounded text-cyan placeholder-text-muted focus:outline-none focus:border-cyan focus:shadow-cyan-glow font-mono text-sm transition-all"
            />
          </div>

          <div className="flex gap-2">
            {(["all", "action", "navigation", "system"] as const).map(
              (type) => (
                <button
                  key={type}
                  onClick={filterHandlers[type]}
                  className={`px-3 py-1 rounded font-mono text-xs transition-all ${
                    filterType === type
                      ? "bg-cyan text-dark border-2 border-cyan shadow-cyan-glow"
                      : "bg-dark border-2 border-cyan/30 text-text-muted hover:border-cyan"
                  }`}
                >
                  [{type.toUpperCase()}]
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {/* History List */}
      {filteredHistory.length === 0 ? (
        <div className="text-center py-8 text-text-muted font-mono text-sm">
          {searchQuery ? "$ no matches found" : "$ history is empty"}
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-4">
            <AnimatePresence>
              {displayHistory.map((entry, index) => (
                <HistoryEntry key={entry.id} entry={entry} index={index} />
              ))}
            </AnimatePresence>
          </div>

          {filteredHistory.length > maxVisible && (
            <button
              onClick={handleToggleExpand}
              className="w-full py-2 text-cyan hover:text-cyan-dark transition-colors font-mono text-sm flex items-center justify-center gap-2"
            >
              {isExpanded ? (
                <>
                  <ChevronUp size={16} />
                  ./show-less
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  ./show-more ({filteredHistory.length - maxVisible} more)
                </>
              )}
            </button>
          )}
        </>
      )}
    </TerminalBorder>
  );
}

interface HistoryEntryProps {
  entry: CommandHistoryEntry;
  index: number;
}

function HistoryEntry({ entry, index }: HistoryEntryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.02 }}
      className="bg-dark border border-cyan/20 rounded p-3 hover:border-cyan/40 transition-all group"
    >
      <div className="flex items-start gap-3">
        <span
          className={`font-mono text-sm font-bold ${getResultColor(entry.result)}`}
        >
          {getResultSymbol(entry.result)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm text-cyan break-all">
            $ {entry.command}
          </div>
          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <div className="text-xs text-text-muted font-mono mt-1">
              {JSON.stringify(entry.metadata)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted font-mono flex-shrink-0">
          <Clock size={12} />
          {formatTimestamp(entry.timestamp)}
        </div>
      </div>
    </motion.div>
  );
}
