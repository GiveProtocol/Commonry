/**
 * Type definitions for The Commons browse functionality
 */

// Category (field of study)
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  iconEmoji?: string;
  displayOrder: number;
  deckCount: number;
}

// Author information
export interface Author {
  username: string;
  displayName?: string;
}

// Tag for filtering
export interface Tag {
  id: string;
  name: string;
  slug: string;
  usageCount?: number;
}

// Public deck in browse listings
export interface PublicDeck {
  id: string;
  name: string;
  description?: string;
  cardCount: number;
  subscriberCount: number;
  averageRating?: number;
  lastActivityAt?: string;
  createdAt: string;
  trendingScore?: number;
  isFeatured: boolean;
  author: Author;
  isSubscribed?: boolean; // Only present if user is logged in
}

// Deck detail with full information
export interface PublicDeckDetail extends PublicDeck {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    isPrimary: boolean;
  }>;
  tags: Tag[];
  sampleCards: Array<{
    id: string;
    frontContent: unknown;
    backContent: unknown;
  }>;
}

// Sort options for deck listings
export type SortOption =
  | "community"
  | "newest"
  | "popular"
  | "rating"
  | "updated"
  | "cards";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "community", label: "Community Favorites" },
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most Popular" },
  { value: "rating", label: "Highest Rated" },
  { value: "updated", label: "Recently Updated" },
  { value: "cards", label: "Most Cards" },
];

// Options for fetching decks in a category
export interface BrowseOptions {
  sort?: SortOption;
  tags?: string[];
  page?: number;
  limit?: number;
}

// Response from category decks endpoint
export interface CategoryDecksResponse {
  category: Category;
  decks: PublicDeck[];
  tags: Tag[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Flag reason options
export const FLAG_REASONS = [
  "Inappropriate or offensive content",
  "Copyright violation",
  "Spam or misleading",
  "Incorrect or harmful information",
  "Other",
] as const;

export type FlagReason = (typeof FLAG_REASONS)[number];
