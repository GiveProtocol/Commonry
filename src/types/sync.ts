/**
 * Sync Types and Interfaces
 *
 * Core types for the bidirectional sync system between client (IndexedDB)
 * and server (PostgreSQL).
 */

export type SyncStatus = "synced" | "pending" | "conflict" | "error";
export type SyncOperation = "create" | "update" | "delete";
export type SyncEntityType = "deck" | "card" | "session";

/**
 * Sync metadata attached to all syncable entities
 */
export interface SyncMetadata {
  /** Server's UUID (null if not yet synced) */
  serverId?: string;

  /** When this entity was last successfully synced to server */
  lastSyncedAt?: Date;

  /** When this entity was last modified locally */
  lastModifiedAt: Date;

  /** Current sync status */
  syncStatus: SyncStatus;

  /** Version number, incremented on each change (for conflict detection) */
  version: number;

  /** Soft delete flag - marked true instead of hard deleting */
  isDeleted?: boolean;

  /** User who owns this entity */
  userId?: string;
}

/**
 * Syncable Deck - extends base Deck with sync metadata
 */
export interface SyncableDeck {
  // Base deck fields
  id: string;
  name: string;
  description?: string;
  cardCount: number;
  dueCount?: number;
  newCount?: number;

  // Sync metadata
  serverId?: string;
  lastSyncedAt?: Date;
  lastModifiedAt: Date;
  syncStatus: SyncStatus;
  version: number;
  isDeleted?: boolean;
  userId?: string;
}

/**
 * Syncable Card - extends base Card with sync metadata
 */
export interface SyncableCard {
  // Base card fields
  id: string;
  deckId: string;
  front: string;
  back: string;
  frontHtml?: string;
  backHtml?: string;
  frontAudio?: string;
  backAudio?: string;
  frontImage?: string;
  backImage?: string;
  tags?: string[];

  // SRS fields
  due: Date;
  interval: number;
  repetitions: number;
  easeFactor: number;
  status: "new" | "learning" | "review" | "relearning";
  lastReview?: Date;
  totalReviews: number;

  // Import tracking
  importSource?: string;
  externalId?: string;

  // Sync metadata
  serverId?: string;
  lastSyncedAt?: Date;
  lastModifiedAt: Date;
  syncStatus: SyncStatus;
  version: number;
  isDeleted?: boolean;
  userId?: string;
}

/**
 * Syncable Study Session
 */
export interface SyncableSession {
  id: string;
  cardId: string;
  rating: number;
  duration: number;
  timestamp: Date;

  // Sync metadata
  serverId?: string;
  lastSyncedAt?: Date;
  syncStatus: SyncStatus;
  userId?: string;
}

/**
 * Sync Queue Item - represents a pending operation
 */
export interface SyncQueueItem {
  id: string;
  operation: SyncOperation;
  entityType: SyncEntityType;
  entityId: string;
  data: unknown;
  timestamp: Date;
  retryCount: number;
  lastError?: string;
  userId: string;
}

/**
 * Sync Result - returned after sync operation
 */
export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  itemsFailed: number;
  conflicts: SyncConflict[];
  errors: SyncError[];
  timestamp: Date;
}

/**
 * Sync Conflict - when local and server versions diverge
 */
export interface SyncConflict {
  entityType: SyncEntityType;
  entityId: string;
  localVersion: number;
  serverVersion: number;
  localData: unknown;
  serverData: unknown;
  conflictedFields: string[];
}

/**
 * Sync Error - when sync operation fails
 */
export interface SyncError {
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  error: string;
  timestamp: Date;
  retryable: boolean;
}

/**
 * Sync Statistics - current sync state
 */
export interface SyncStats {
  lastSyncAt?: Date;
  pendingCount: number;
  conflictCount: number;
  errorCount: number;
  isOnline: boolean;
  isSyncing: boolean;
}

/**
 * Sync Configuration
 */
export interface SyncConfig {
  /** Auto-sync enabled */
  autoSync: boolean;

  /** Sync interval in milliseconds (for batched updates) */
  syncInterval: number;

  /** Maximum items per batch sync */
  batchSize: number;

  /** Maximum retry attempts for failed syncs */
  maxRetries: number;

  /** Only sync on WiFi (mobile optimization) */
  wifiOnly: boolean;

  /** Enable sync for study sessions */
  syncSessions: boolean;
}

/**
 * Default sync configuration
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  autoSync: true,
  syncInterval: 30000, // 30 seconds
  batchSize: 50,
  maxRetries: 3,
  wifiOnly: false,
  syncSessions: true,
};

/**
 * Server sync request - batch of changes to sync
 */
export interface SyncRequest {
  decks?: Array<{
    operation: SyncOperation;
    data: SyncableDeck;
  }>;
  cards?: Array<{
    operation: SyncOperation;
    data: SyncableCard;
  }>;
  sessions?: Array<{
    operation: SyncOperation;
    data: SyncableSession;
  }>;
  lastSyncAt?: Date;
}

/**
 * Server sync response - results and conflicts
 */
export interface SyncResponse {
  success: boolean;
  timestamp: Date;
  decks?: {
    created: string[];
    updated: string[];
    deleted: string[];
    conflicts: SyncConflict[];
  };
  cards?: {
    created: string[];
    updated: string[];
    deleted: string[];
    conflicts: SyncConflict[];
  };
  sessions?: {
    created: string[];
    errors: SyncError[];
  };
  errors?: SyncError[];
}
