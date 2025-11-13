import { ulid } from "ulid";
import {
  NoteId,
  CardId,
  DeckId,
  ReviewId,
  MediaId,
  UserId,
  CardModelId,
  CardTemplateId,
  EntityId,
  EntityType,
  ENTITY_PREFIXES,
  PREFIX_TO_ENTITY,
} from "../types/ids";

/**
 * Service for generating and managing entity IDs
 * Uses prefixed ULIDs for type safety and chronological sorting
 */
export class IdService {
  // ===== Generation Methods =====

  static generateNoteId(): NoteId {
    return this.generate("note") as NoteId;
  }

  /**
   * Generates a unique identifier for a card.
   * @returns {CardId} A unique card identifier.
   */
  static generateCardId(): CardId {
    return this.generate("card") as CardId;
  }

  /**
   * Generates a unique identifier for a deck.
   * @returns {DeckId} The generated deck identifier.
   */
  static generateDeckId(): DeckId {
    return this.generate("deck") as DeckId;
  }

  /**
   * Generates a unique review identifier.
   * @returns {ReviewId} A newly generated review ID.
   */
  static generateReviewId(): ReviewId {
    return this.generate("review") as ReviewId;
  }

  /**
   * Generates a unique media identifier.
   *
   * @returns {MediaId} A unique MediaId for media resources.
   */
  static generateMediaId(): MediaId {
    return this.generate("media") as MediaId;
  }

  /**
   * Generates a unique identifier for a user.
   * @returns {UserId} A new user ID.
   */
  static generateUserId(): UserId {
    return this.generate("user") as UserId;
  }

  /**
   * Generates a unique identifier for a card model.
   * @returns {CardModelId} The generated CardModelId.
   */
  static generateCardModelId(): CardModelId {
    return this.generate("cardModel") as CardModelId;
  }

  /**
   * Generates a new CardTemplateId.
   *
   * @returns A unique CardTemplateId.
   */
  static generateCardTemplateId(): CardTemplateId {
    return this.generate("cardTemplate") as CardTemplateId;
  }

  /**
   * Generic ID generation
   * @param type - Entity type
   * @returns Prefixed ULID
   */
  private static generate(type: EntityType): string {
    const prefix = ENTITY_PREFIXES[type];
    const ulidValue = ulid();
    return `${prefix}_${ulidValue}`;
  }

  // ===== Validation Methods =====

  static isValidId(id: string): boolean {
    const parts = id.split("_");
    if (parts.length !== 2) return false;

    const [prefix, ulidPart] = parts;

    // Check if prefix is valid
    if (!(prefix in PREFIX_TO_ENTITY)) return false;

    // Check if ULID part is valid (26 characters, Base32)
    const ulidRegex = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;
    return ulidRegex.test(ulidPart);
  }

  /**
   * Determines whether the provided string is a NoteId.
   * Checks if the id starts with the note entity prefix and is valid.
   * @param id - The id string to evaluate.
   * @returns True if the id is a valid NoteId, otherwise false.
   */
  static isNoteId(id: string): id is NoteId {
    return id.startsWith(ENTITY_PREFIXES.note + "_") && this.isValidId(id);
  }

  /**
   * Determines whether the provided id is a valid CardId.
   *
   * @param id - The identifier to test as a CardId.
   * @returns True if the id starts with the card prefix and is a valid id.
   */
  static isCardId(id: string): id is CardId {
    return id.startsWith(ENTITY_PREFIXES.card + "_") && this.isValidId(id);
  }

  /**
   * Checks if the given id is a valid DeckId.
   * @param id - The id to check.
   * @returns True if the id starts with the deck prefix and is a valid id.
   */
  static isDeckId(id: string): id is DeckId {
    return id.startsWith(ENTITY_PREFIXES.deck + "_") && this.isValidId(id);
  }

  /**
   * Checks if the provided id is a ReviewId.
   * @param id - The identifier string to check.
   * @returns True if the id starts with the review entity prefix and is a valid id.
   */
  static isReviewId(id: string): id is ReviewId {
    return id.startsWith(ENTITY_PREFIXES.review + "_") && this.isValidId(id);
  }

  /**
   * Checks if the given id is a MediaId.
   * @param {string} id - The identifier to check.
   * @returns {boolean} True if the id starts with the media prefix and is valid.
   */
  static isMediaId(id: string): id is MediaId {
    return id.startsWith(ENTITY_PREFIXES.media + "_") && this.isValidId(id);
  }

  /**
   * Checks if the given id is a valid UserId.
   * @param id - The id string to validate.
   * @returns True if the id is a UserId; otherwise, false.
   */
  static isUserId(id: string): id is UserId {
    return id.startsWith(ENTITY_PREFIXES.user + "_") && this.isValidId(id);
  }

  // ===== Parsing Methods =====

  /**
   * Extract entity type from ID
   * @param id - Any entity ID
   * @returns Entity type or null if invalid
   */
  static getEntityType(id: string): EntityType | null {
    const prefix = id.split("_")[0];
    return PREFIX_TO_ENTITY[prefix] || null;
  }

  /**
   * Extract ULID portion from ID
   * @param id - Any entity ID
   * @returns ULID string without prefix
   */
  static getUlid(id: EntityId): string {
    return id.split("_")[1];
  }

  /**
   * Extract timestamp from ID
   * @param id - Any entity ID
   * @returns Date object representing when ID was created
   */
  static getTimestamp(id: EntityId): Date {
    const ulidPart = this.getUlid(id);

    // Decode ULID timestamp (first 10 characters)
    const timestampStr = ulidPart.substring(0, 10);
    const timestamp = this.decodeBase32(timestampStr);

    return new Date(timestamp);
  }

  /**
   * Decode Base32 string to number
   * @param str - Base32 encoded string
   * @returns Decoded number
   */
  private static decodeBase32(str: string): number {
    const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    let result = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const value = alphabet.indexOf(char);
      result = result * 32 + value;
    }

    return result;
  }

  // ===== Sync Utilities =====

  /**
   * Create a cursor ID for pagination/sync
   * Useful for getting all entities created after a certain time
   * @param timestamp - Cutoff timestamp
   * @param type - Entity type
   * @returns Cursor ID that can be used in >= comparisons
   */
  static createSyncCursor(timestamp: Date, type: EntityType): string {
    const prefix = ENTITY_PREFIXES[type];
    const ulidValue = ulid(timestamp.getTime());
    return `${prefix}_${ulidValue}`;
  }

  /**
   * Compare two IDs chronologically
   * @param id1 - First ID
   * @param id2 - Second ID
   * @returns -1 if id1 < id2, 0 if equal, 1 if id1 > id2
   */
  static compare(id1: EntityId, id2: EntityId): number {
    return id1.localeCompare(id2);
  }

  /**
   * Check if ID was created after a given timestamp
   * @param id - Entity ID
   * @param timestamp - Comparison timestamp
   * @returns True if ID was created after timestamp
   */
  static isCreatedAfter(id: EntityId, timestamp: Date): boolean {
    const idTimestamp = this.getTimestamp(id);
    return idTimestamp > timestamp;
  }

  // ===== Import/Export Utilities =====

  /**
   * Generate a mapping between external IDs and new internal IDs
   * Used when importing from other systems (Anki, Quizlet, etc.)
   * @param externalIds - Array of external IDs
   * @param type - Entity type to generate
   * @returns Map of external ID -> internal ID
   */
  static createImportMapping(
    externalIds: string[],
    type: EntityType,
  ): Map<string, EntityId> {
    const mapping = new Map<string, EntityId>();

    for (const externalId of externalIds) {
      const internalId = this.generate(type) as EntityId;
      mapping.set(externalId, internalId);
    }

    return mapping;
  }

  /**
   * Parse an ID from a potentially untrusted source
   * @param id - ID string to parse
   * @param expectedType - Expected entity type (optional)
   * @returns Validated ID or null if invalid
   */
  static parseId(id: string, expectedType?: EntityType): EntityId | null {
    if (!this.isValidId(id)) {
      return null;
    }

    const actualType = this.getEntityType(id);
    if (expectedType && actualType !== expectedType) {
      return null;
    }

    return id as EntityId;
  }

  // ===== Batch Operations =====

  /**
   * Generate multiple IDs at once
   * @param type - Entity type
   * @param count - Number of IDs to generate
   * @returns Array of generated IDs
   */
  static generateBatch(type: EntityType, count: number): EntityId[] {
    const ids: EntityId[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(this.generate(type) as EntityId);
    }
    return ids;
  }

  // ===== Debugging Utilities =====

  /**
   * Get human-readable info about an ID
   * @param id - Entity ID
   * @returns Debug information
   */
  static debug(id: EntityId): {
    valid: boolean;
    type: EntityType | null;
    prefix: string;
    ulid: string;
    timestamp: Date | null;
    age: string | null;
  } {
    const valid = this.isValidId(id);
    const parts = id.split("_");
    const prefix = parts[0];
    const ulidPart = parts[1] || "";
    const type = this.getEntityType(id);

    let timestamp: Date | null = null;
    let age: string | null = null;

    if (valid) {
      timestamp = this.getTimestamp(id);
      const ageMs = Date.now() - timestamp.getTime();
      age = this.formatAge(ageMs);
    }

    return { valid, type, prefix, ulid: ulidPart, timestamp, age };
  }

  /**
   * Formats a duration given in milliseconds into a human-readable age string.
   * @param ms - The duration in milliseconds.
   * @returns A string representing the time elapsed (e.g., "5m ago").
   */
  private static formatAge(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  }
}

// Export singleton instance for convenience
export const ids = IdService;
