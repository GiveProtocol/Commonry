import { motion } from "framer-motion";
import { Book, Users, Star, Clock, Flag } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreVertical } from "lucide-react";
import type { BrowseDeck } from "../../services/api";

interface PublicDeckCardProps {
  deck: BrowseDeck;
  onClick: () => void;
  onSubscribe?: () => void;
  onFlag?: () => void;
  isSubscribed?: boolean;
}

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return "recently";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1d ago";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function formatSubscriberCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

export function PublicDeckCard({
  deck,
  onClick,
  onSubscribe,
  onFlag,
  isSubscribed,
}: PublicDeckCardProps) {
  return (
    <motion.div
      className="rounded-lg border-2 border-terminal-muted dark:border-gray-700
                 bg-terminal-surface dark:bg-dark-surface
                 hover:border-terminal-primary dark:hover:border-cyan
                 hover:shadow-terminal-glow dark:hover:shadow-cyan-glow
                 transition-all duration-200 overflow-hidden"
      whileHover={{ y: -2 }}
    >
      {/* Header with gradient */}
      <div
        className={`px-4 py-3 flex items-center justify-between
                    ${deck.isFeatured ? "bg-gradient-to-r from-amber-500 to-amber-600" : "bg-gradient-to-r from-cyan-600 to-cyan-700 dark:from-cyan-700 dark:to-cyan-800"}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-mono">
            {deck.isFeatured ? "Featured Deck" : "Study Deck"}
          </span>
        </div>

        {/* Menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded hover:bg-white/20 transition-colors"
            >
              <MoreVertical size={16} className="text-white" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[150px] p-2 rounded-lg shadow-lg
                         bg-terminal-surface dark:bg-dark-surface
                         border-2 border-terminal-primary dark:border-cyan
                         z-50"
              sideOffset={5}
              align="end"
            >
              {onSubscribe && (
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer
                             font-mono text-sm text-gray-700 dark:text-gray-300 outline-none
                             hover:bg-terminal-muted/20 dark:hover:bg-white/5"
                  onSelect={(e) => {
                    e.preventDefault();
                    onSubscribe();
                  }}
                >
                  <Users size={14} />
                  {isSubscribed ? "Unsubscribe" : "Subscribe"}
                </DropdownMenu.Item>
              )}
              {onFlag && (
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer
                             font-mono text-sm text-red-600 dark:text-red-400 outline-none
                             hover:bg-terminal-muted/20 dark:hover:bg-white/5"
                  onSelect={(e) => {
                    e.preventDefault();
                    onFlag();
                  }}
                >
                  <Flag size={14} />
                  Report
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Content */}
      <button onClick={onClick} className="w-full text-left p-4">
        {/* Deck name */}
        <h3 className="font-bold text-lg text-gray-900 dark:text-white line-clamp-1">
          {deck.name}
        </h3>

        {/* Author */}
        <p className="text-xs text-terminal-muted dark:text-text-muted mt-1">
          by {deck.author.displayName || deck.author.username}
        </p>

        {/* Description */}
        {deck.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
            {deck.description}
          </p>
        )}

        {/* Social metrics */}
        <div className="flex items-center gap-4 mt-4 text-xs font-mono text-terminal-muted dark:text-text-muted">
          <span
            className="flex items-center gap-1"
            title={`${deck.subscriberCount} subscribers`}
          >
            <Users size={12} className="text-terminal-primary dark:text-cyan" />
            {formatSubscriberCount(deck.subscriberCount)}
          </span>

          {deck.averageRating && (
            <span
              className="flex items-center gap-1"
              title={`${deck.averageRating.toFixed(1)} rating`}
            >
              <Star size={12} className="text-amber-500 fill-amber-500" />
              {deck.averageRating.toFixed(1)}
            </span>
          )}

          <span className="flex items-center gap-1" title="Last activity">
            <Clock size={12} />
            {formatRelativeTime(deck.lastActivityAt)}
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
            <Book
              className="mx-auto mb-1 text-gray-600 dark:text-gray-400"
              size={16}
            />
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {deck.cardCount}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Cards</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
            <Users
              className="mx-auto mb-1 text-cyan-600 dark:text-cyan-400"
              size={16}
            />
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {formatSubscriberCount(deck.subscriberCount)}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Subscribers
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
            <Star className="mx-auto mb-1 text-amber-500" size={16} />
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {deck.averageRating?.toFixed(1) || "-"}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Rating</p>
          </div>
        </div>

        {/* Subscribe button */}
        {onSubscribe && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSubscribe();
            }}
            className={`w-full mt-4 py-2 rounded-lg font-mono text-sm font-bold
                       transition-all duration-200
                       ${
                         isSubscribed
                           ? "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600"
                           : "bg-terminal-primary dark:bg-cyan text-white hover:shadow-terminal-glow dark:hover:shadow-cyan-glow"
                       }`}
          >
            {isSubscribed ? "Subscribed" : "Subscribe"}
          </button>
        )}
      </button>
    </motion.div>
  );
}
