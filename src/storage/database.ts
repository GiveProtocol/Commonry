// src/storage/database.ts
import Dexie, { Table } from "dexie";
import { Card, Deck, ReviewResult, SRSEngine } from "../lib/srs-engine";
import { CardId, DeckId, ReviewId } from "../types/ids";
import { IdService } from "../services/id-service";

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
}

/**
 * SRSDatabase manages storage of spaced repetition cards, decks, and study sessions using IndexedDB via Dexie.
 */
export class SRSDatabase extends Dexie {
  cards!: Table<Card>;
  decks!: Table<Deck>;
  sessions!: Table<StudySession>;
  importMappings!: Table<ImportMapping>;
  importBatches!: Table<ImportBatch>;

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
    return SRSEngine.getCardsForReview(allCards, limit);
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

    await this.transaction("rw", this.cards, this.sessions, async () => {
      const card = await this.cards.get(cardId);
      if (!card) throw new Error("Card not found");

      // Update card with SRS engine
      result = this.srsEngine.calculateNextReview(card, rating);
      await this.cards.update(cardId, result.card);

      // Record session
      await this.sessions.add({
        cardId,
        rating,
        duration,
        timestamp: new Date(),
      });
    });

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
    const newCard = this.srsEngine.createCard(front, back, deckId);
    if (frontAudio) newCard.frontAudio = frontAudio;
    if (backAudio) newCard.backAudio = backAudio;
    if (frontImage) newCard.frontImage = frontImage;
    if (backImage) newCard.backImage = backImage;
    await this.cards.add(newCard);
    return newCard.id;
  }

  /**
   * Creates a new deck in the database.
   * @param name - The name of the deck.
   * @param description - Optional description of the deck.
   * @returns A promise that resolves to the new deck's ID.
   */
  async createDeck(name: string, description?: string): Promise<DeckId> {
    const newDeck: Deck = {
      id: IdService.generateDeckId(),
      name,
      description,
      cardCount: 0,
      dueCount: 0,
      newCount: 0,
    };

    await this.decks.add(newDeck);
    return newDeck.id;
  }

  /**
   * Updates the statistics for a deck, including counts of total, new, and due cards.
   * @param deckId - The ID of the deck to update.
   * @returns A promise that resolves when the update is complete.
   */
  async updateDeckStats(deckId: DeckId): Promise<void> {
    const now = new Date();
    const cards = await this.cards.where("deckId").equals(deckId).toArray();

    const cardCount = cards.length;
    const newCount = cards.filter((c) => c.status === "new").length;
    const dueCount = cards.filter((c) => c.due <= now).length;

    await this.decks.update(deckId, {
      cardCount,
      newCount,
      dueCount,
    });
  }

  /**
   * Retrieves all decks from the database.
   * @returns A promise that resolves to an array of decks.
   */
  async getAllDecks(): Promise<Deck[]> {
    return await this.decks.toArray();
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
  async updateCard(cardId: CardId, updates: Partial<Card>): Promise<void> {
    await this.cards.update(cardId, updates);
  }

  /**
   * Deletes a card by its ID.
   * @param cardId - The ID of the card to delete.
   * @returns A promise that resolves when the deletion is complete.
   */
  async deleteCard(cardId: CardId): Promise<void> {
    await this.cards.delete(cardId);
  }

  /**
   * Deletes a deck and all its cards.
   * @param deckId - The ID of the deck to delete.
   * @returns A promise that resolves when the deletion is complete.
   */
  async deleteDeck(deckId: DeckId): Promise<void> {
    // Delete all cards in the deck first
    await this.cards.where("deckId").equals(deckId).delete();
    // Then delete the deck
    await this.decks.delete(deckId);
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
}

export const db = new SRSDatabase();
