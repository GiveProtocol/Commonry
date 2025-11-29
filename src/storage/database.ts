// src/storage/database.ts
import Dexie, { Table } from "dexie";
import { Card, Deck, ReviewResult, SRSEngine } from "../lib/srs-engine";
import { CardId, DeckId, ReviewId } from "../types/ids";
import { IdService } from "../services/id-service";
import {
  SyncQueueItem,
  SyncStatus,
  SyncOperation,
  SyncEntityType,
} from "../types/sync";

export type ImportSource = "anki" | "commonry" | "other";
export type EntityType = "card" | "deck" | "note" | "media";

export interface ImportMapping {
  id?: number;
  sourceSystem: ImportSource;
  sourceId: string;
  internalId: string;
  entityType: EntityType;
  importedAt: Date;
  updatedAt: Date;
  importBatchId?: string;
}

export interface ImportBatch {
  id: string;
  sourceSystem: ImportSource;
  fileName?: string;
  importedAt: Date;
  status: "in_progress" | "completed" | "failed" | "rolled_back";
  notesImported: number;
  cardsImported: number;
  decksImported: number;
  metadata?: Record<string, unknown>;
}

export interface StudySession {
  id?: ReviewId;
  cardId: CardId;
  rating: number;
  duration: number;
  timestamp: Date;
  // Sync metadata
  serverId?: string;
  lastSyncedAt?: Date;
  syncStatus?: SyncStatus;
  userId?: string;
}

// Extended Card type with sync metadata
export interface SyncableCard extends Card {
  serverId?: string;
  lastSyncedAt?: Date;
  lastModifiedAt: Date;
  syncStatus: SyncStatus;
  version: number;
  isDeleted?: boolean;
  userId?: string;
}

// Extended Deck type with sync metadata
export interface SyncableDeck extends Deck {
  serverId?: string;
  lastSyncedAt?: Date;
  lastModifiedAt: Date;
  syncStatus: SyncStatus;
  version: number;
  isDeleted?: boolean;
  userId?: string;
}

/**
 * SRSDatabase manages storage of spaced repetition cards, decks, and study sessions using IndexedDB via Dexie.
 */
export class SRSDatabase extends Dexie {
  cards!: Table<SyncableCard>;
  decks!: Table<SyncableDeck>;
  sessions!: Table<StudySession>;
  importMappings!: Table<ImportMapping>;
  importBatches!: Table<ImportBatch>;
  syncQueue!: Table<SyncQueueItem>;

  public srsEngine: SRSEngine;

  constructor() {
    super("SRSDatabase");

    // Version 1: Initial schema
    this.version(1).stores({
      cards: "id, deckId, due, status, interval, easeFactor",
      decks: "id, name",
      sessions: "++id, cardId, timestamp",
    });

    // Version 2: Add import mapping support
    this.version(2).stores({
      cards:
        "id, deckId, due, status, interval, easeFactor, importSource, externalId",
      decks: "id, name, importSource, externalId",
      sessions: "++id, cardId, timestamp",
      importMappings:
        "++id, [sourceSystem+sourceId+entityType], internalId, importBatchId",
      importBatches: "id, sourceSystem, importedAt, status",
    });

    // Version 3: Add HTML content fields for formatted Anki cards
    this.version(3).stores({
      cards:
        "id, deckId, due, status, interval, easeFactor, importSource, externalId",
      decks: "id, name, importSource, externalId",
      sessions: "++id, cardId, timestamp",
      importMappings:
        "++id, [sourceSystem+sourceId+entityType], internalId, importBatchId",
      importBatches: "id, sourceSystem, importedAt, status",
    });

    // Version 4: Add sync metadata and sync queue
    this.version(4)
      .stores({
        cards:
          "id, deckId, due, status, interval, easeFactor, importSource, externalId, syncStatus, serverId, lastModifiedAt, isDeleted, userId",
        decks:
          "id, name, importSource, externalId, syncStatus, serverId, lastModifiedAt, isDeleted, userId",
        sessions: "++id, cardId, timestamp, syncStatus, serverId, userId",
        importMappings:
          "++id, [sourceSystem+sourceId+entityType], internalId, importBatchId",
        importBatches: "id, sourceSystem, importedAt, status",
        syncQueue: "id, entityType, entityId, operation, timestamp, userId",
      })
      .upgrade(async (tx) => {
        // Initialize sync metadata for existing records
        await tx
          .table("cards")
          .toCollection()
          .modify((card: SyncableCard) => {
            card.syncStatus = "pending";
            card.version = 1;
            card.lastModifiedAt = new Date();
          });
        await tx
          .table("decks")
          .toCollection()
          .modify((deck: SyncableDeck) => {
            deck.syncStatus = "pending";
            deck.version = 1;
            deck.lastModifiedAt = new Date();
          });
        await tx
          .table("sessions")
          .toCollection()
          .modify((session: StudySession) => {
            session.syncStatus = "pending";
          });
      });

    this.srsEngine = new SRSEngine();
  }

  /**
   * Retrieves cards due for review from a given deck.
   * @param deckId - The ID of the deck to get cards for.
   * @param limit - Maximum number of cards to retrieve.
   * @returns A promise that resolves to an array of cards for review.
   */
  async getCardsForReview(deckId: DeckId, limit = 20): Promise<Card[]> {
    const allCards = await this.cards.where("deckId").equals(deckId).toArray();
    // Filter out soft-deleted cards
    const activeCards = this.filterDeleted(allCards);
    return SRSEngine.getCardsForReview(activeCards, limit);
  }

  /**
   * Records a review session for a card and updates its scheduling info.
   * @param cardId - The ID of the card being reviewed.
   * @param rating - The rating given during review.
   * @param duration - Time taken for review in milliseconds.
   * @returns A promise that resolves to the review result.
   */
  async recordReview(
    cardId: CardId,
    rating: number,
    duration: number,
  ): Promise<ReviewResult> {
    let result: ReviewResult | undefined;
    const now = new Date();

    await this.transaction(
      "rw",
      this.cards,
      this.sessions,
      this.syncQueue,
      async () => {
        const card = await this.cards.get(cardId);
        if (!card) throw new Error("Card not found");

        // Update card with SRS engine
        result = this.srsEngine.calculateNextReview(card, rating);

        // Update card with sync metadata
        await this.cards.update(cardId, {
          ...result.card,
          lastModifiedAt: now,
          syncStatus: "pending",
          version: (card.version || 1) + 1,
        });

        // Record session with sync metadata
        const session: StudySession = {
          cardId,
          rating,
          duration,
          timestamp: now,
          syncStatus: "pending",
        };

        await this.sessions.add(session);

        // Queue sync operations
        await this.queueSyncOperation("update", "card", cardId, result.card);
        if (session.id) {
          await this.queueSyncOperation(
            "create",
            "session",
            session.id,
            session,
          );
        }
      },
    );

    if (!result) {
      throw new Error("Failed to record review");
    }

    return result;
  }

  /**
   * Creates a new card in the database.
   * @param front - The front content of the card.
   * @param back - The back content of the card.
   * @param deckId - The ID of the deck to add the card to.
   * @param frontAudio - Optional audio URL for the front side.
   * @param backAudio - Optional audio URL for the back side.
   * @param frontImage - Optional image URL for the front side.
   * @param backImage - Optional image URL for the back side.
   * @returns A promise that resolves to the new card's ID.
   */
  async createCard(
    front: string,
    back: string,
    deckId: DeckId,
    frontAudio?: string,
    backAudio?: string,
    frontImage?: string,
    backImage?: string,
  ): Promise<CardId> {
    const baseCard = this.srsEngine.createCard(front, back, deckId);
    const now = new Date();

    const newCard: SyncableCard = {
      ...baseCard,
      frontAudio,
      backAudio,
      frontImage,
      backImage,
      // Initialize sync metadata
      syncStatus: "pending",
      version: 1,
      lastModifiedAt: now,
      isDeleted: false,
    };

    await this.cards.add(newCard);

    // Queue sync operation
    await this.queueSyncOperation("create", "card", newCard.id, newCard);

    return newCard.id;
  }

  /**
   * Creates a new deck in the database.
   * @param name - The name of the deck.
   * @param description - Optional description of the deck.
   * @returns A promise that resolves to the new deck's ID.
   */
  async createDeck(name: string, description?: string): Promise<DeckId> {
    const now = new Date();

    const newDeck: SyncableDeck = {
      id: IdService.generateDeckId(),
      name,
      description,
      cardCount: 0,
      dueCount: 0,
      newCount: 0,
      // Initialize sync metadata
      syncStatus: "pending",
      version: 1,
      lastModifiedAt: now,
      isDeleted: false,
    };

    await this.decks.add(newDeck);

    // Queue sync operation
    await this.queueSyncOperation("create", "deck", newDeck.id, newDeck);

    return newDeck.id;
  }

  /**
   * Updates the statistics for a deck, including counts of total, new, and due cards.
   * @param deckId - The ID of the deck to update.
   * @returns A promise that resolves when the update is complete.
   */
  async updateDeckStats(deckId: DeckId): Promise<void> {
    const now = new Date();
    const allCards = await this.cards.where("deckId").equals(deckId).toArray();
    // Only count active (non-deleted) cards
    const cards = this.filterDeleted(allCards);

    const cardCount = cards.length;
    const newCount = cards.filter((c) => c.status === "new").length;
    const dueCount = cards.filter((c) => c.due <= now).length;

    await this.decks.update(deckId, {
      cardCount,
      newCount,
      dueCount,
      lastModifiedAt: now,
      syncStatus: "pending",
    });
  }

  /**
   * Retrieves all decks from the database (excludes soft-deleted decks).
   * @param includeDeleted - Whether to include soft-deleted decks.
   * @returns A promise that resolves to an array of decks.
   */
  async getAllDecks(includeDeleted = false): Promise<SyncableDeck[]> {
    const allDecks = await this.decks.toArray();
    return includeDeleted ? allDecks : this.filterDeleted(allDecks);
  }

  /**
   * Retrieves a deck by its ID.
   * @param deckId - The ID of the deck to retrieve.
   * @returns A promise that resolves to the deck or undefined if not found.
   */
  async getDeck(deckId: DeckId): Promise<Deck | undefined> {
    return await this.decks.get(deckId);
  }

  /**
   * Retrieves a card by its ID.
   * @param cardId - The ID of the card to retrieve.
   * @returns A promise that resolves to the card or undefined if not found.
   */
  async getCard(cardId: CardId): Promise<Card | undefined> {
    return await this.cards.get(cardId);
  }

  /**
   * Updates a card's properties.
   * @param cardId - The ID of the card to update.
   * @param updates - Partial card properties to update.
   * @returns A promise that resolves when the update is complete.
   */
  async updateCard(
    cardId: CardId,
    updates: Partial<SyncableCard>,
  ): Promise<void> {
    const card = await this.cards.get(cardId);
    if (!card) throw new Error("Card not found");

    const now = new Date();
    const updatedCard = {
      ...updates,
      lastModifiedAt: now,
      syncStatus: "pending" as SyncStatus,
      version: (card.version || 1) + 1,
    };

    await this.cards.update(cardId, updatedCard);
    await this.queueSyncOperation("update", "card", cardId, updatedCard);
  }

  /**
   * Soft deletes a card by marking it as deleted.
   * @param cardId - The ID of the card to delete.
   * @returns A promise that resolves when the deletion is complete.
   */
  async deleteCard(cardId: CardId): Promise<void> {
    const card = await this.cards.get(cardId);
    if (!card) throw new Error("Card not found");

    const now = new Date();
    await this.cards.update(cardId, {
      isDeleted: true,
      lastModifiedAt: now,
      syncStatus: "pending",
      version: (card.version || 1) + 1,
    });

    await this.queueSyncOperation("delete", "card", cardId, {
      isDeleted: true,
    });
  }

  /**
   * Soft deletes a deck and all its cards.
   * @param deckId - The ID of the deck to delete.
   * @returns A promise that resolves when the deletion is complete.
   */
  async deleteDeck(deckId: DeckId): Promise<void> {
    const deck = await this.decks.get(deckId);
    if (!deck) throw new Error("Deck not found");

    const now = new Date();

    await this.transaction(
      "rw",
      this.cards,
      this.decks,
      this.syncQueue,
      async () => {
        // Soft delete all cards in the deck
        const cards = await this.cards.where("deckId").equals(deckId).toArray();
        for (const card of cards) {
          await this.cards.update(card.id, {
            isDeleted: true,
            lastModifiedAt: now,
            syncStatus: "pending",
            version: (card.version || 1) + 1,
          });
          await this.queueSyncOperation("delete", "card", card.id, {
            isDeleted: true,
          });
        }

        // Soft delete the deck
        await this.decks.update(deckId, {
          isDeleted: true,
          lastModifiedAt: now,
          syncStatus: "pending",
          version: (deck.version || 1) + 1,
        });

        await this.queueSyncOperation("delete", "deck", deckId, {
          isDeleted: true,
        });
      },
    );
  }

  /**
   * Gets the next scheduled review time for a card.
   * @param cardId - The ID of the card.
   * @returns A promise that resolves to an ISO string of the next review time or "Unknown".
   */
  async getNextReviewTime(cardId: CardId): Promise<string> {
    const card = await this.getCard(cardId);
    return card ? SRSEngine.getNextReviewTime(card) : "Unknown";
  }

  /**
   * Retrieves the review history for a card.
   * @param cardId - The ID of the card.
   * @param limit - Maximum number of history entries to retrieve.
   * @returns A promise that resolves to an array of study sessions.
   */
  async getReviewHistory(cardId: CardId, limit = 10): Promise<StudySession[]> {
    return await this.sessions
      .where("cardId")
      .equals(cardId)
      .reverse()
      .limit(limit)
      .toArray();
  }

  /**
   * Adds a set of sample cards to a default or existing deck and updates deck stats.
   * @returns A promise that resolves when sample cards are added.
   */
  async addSampleCards(): Promise<void> {
    const sampleCards = [
      { front: "What is the capital of France?", back: "Paris" },
      { front: "What is 2 + 2?", back: "4" },
      {
        front: "What is the largest planet in our solar system?",
        back: "Jupiter",
      },
      { front: "Who painted the Mona Lisa?", back: "Leonardo da Vinci" },
      {
        front: "What is the speed of light?",
        back: "299,792,458 meters per second",
      },
    ];

    // Create or get default deck
    const existingDecks = await this.getAllDecks();
    let defaultDeckId: DeckId;

    if (existingDecks.length === 0) {
      defaultDeckId = await this.createDeck(
        "Default Deck",
        "Sample flashcards for testing",
      );
    } else {
      defaultDeckId = existingDecks[0].id;
    }

    // Add sample cards to the deck
    for (const card of sampleCards) {
      await this.createCard(card.front, card.back, defaultDeckId);
    }

    await this.updateDeckStats(defaultDeckId);
  }

  /**
   * Queues a sync operation for offline processing.
   * @param operation - The type of operation (create, update, delete).
   * @param entityType - The type of entity being synced.
   * @param entityId - The ID of the entity.
   * @param data - The entity data to sync.
   * @returns A promise that resolves when the operation is queued.
   */
  private async queueSyncOperation(
    operation: SyncOperation,
    entityType: SyncEntityType,
    entityId: string,
    data: unknown,
  ): Promise<void> {
    const queueItem: SyncQueueItem = {
      id: IdService.generateCardId(), // Reuse ID generation
      operation,
      entityType,
      entityId,
      data,
      timestamp: new Date(),
      retryCount: 0,
      userId: "", // Will be set by SyncService
    };

    await this.syncQueue.add(queueItem);
  }

  /**
   * Gets all pending sync operations from the queue.
   * @param limit - Maximum number of items to retrieve.
   * @returns A promise that resolves to an array of sync queue items.
   */
  async getPendingSyncItems(limit = 50): Promise<SyncQueueItem[]> {
    return await this.syncQueue.orderBy("timestamp").limit(limit).toArray();
  }

  /**
   * Removes a sync operation from the queue after successful sync.
   * @param itemId - The ID of the sync queue item to remove.
   * @returns A promise that resolves when the item is removed.
   */
  async removeSyncQueueItem(itemId: string): Promise<void> {
    await this.syncQueue.delete(itemId);
  }

  /**
   * Clears all items from the sync queue.
   * @returns A promise that resolves when the queue is cleared.
   */
  async clearSyncQueue(): Promise<void> {
    await this.syncQueue.clear();
  }

  /**
   * Gets entities that need to be synced (status is 'pending').
   * @returns A promise that resolves to an object with pending decks, cards, and sessions.
   */
  async getEntitiesNeedingSync(): Promise<{
    decks: SyncableDeck[];
    cards: SyncableCard[];
    sessions: StudySession[];
  }> {
    const decks = await this.decks
      .where("syncStatus")
      .equals("pending")
      .toArray();

    const cards = await this.cards
      .where("syncStatus")
      .equals("pending")
      .toArray();

    const sessions = await this.sessions
      .where("syncStatus")
      .equals("pending")
      .toArray();

    return { decks, cards, sessions };
  }

  /**
   * Updates sync status for an entity after successful sync.
   * @param entityType - The type of entity.
   * @param entityId - The ID of the entity.
   * @param serverId - The server's ID for this entity.
   * @returns A promise that resolves when the status is updated.
   */
  async markAsSynced(
    entityType: SyncEntityType,
    entityId: string,
    serverId?: string,
  ): Promise<void> {
    const now = new Date();
    const updates = {
      syncStatus: "synced" as SyncStatus,
      lastSyncedAt: now,
      ...(serverId && { serverId }),
    };

    switch (entityType) {
      case "deck":
        await this.decks.update(entityId, updates);
        break;
      case "card":
        await this.cards.update(entityId, updates);
        break;
      case "session":
        await this.sessions.update(entityId, updates);
        break;
    }
  }

  /**
   * Filters out soft-deleted entities from a list.
   * @param entities - Array of entities to filter.
   * @returns Array with deleted entities removed.
   */
  filterDeleted<T extends { isDeleted?: boolean }>(entities: T[]): T[] {
    return entities.filter((entity) => !entity.isDeleted);
  }
}

export const db = new SRSDatabase();
