/**
 * Sync API Routes
 *
 * Handles bidirectional sync between client IndexedDB and server PostgreSQL.
 * Supports batch operations, conflict detection, and offline queue processing.
 */

import express from "express";
import pool from "./db.js";
import { ulid } from "ulid";

const router = express.Router();

/**
 * Generate ULID with prefix
 */
function generateULID(prefix) {
  return `${prefix}_${ulid()}`;
}

/**
 * POST /api/sync
 *
 * Main sync endpoint that receives local changes and returns conflicts.
 * Processes creates, updates, and deletes for decks, cards, and sessions.
 */
router.post("/", async (req, res) => {
  const { decks, cards, sessions, lastSyncAt } = req.body;
  const userId = req.userId; // Set by authenticateToken middleware

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const response = {
      success: true,
      timestamp: new Date(),
      decks: {
        created: [],
        updated: [],
        deleted: [],
        conflicts: [],
      },
      cards: {
        created: [],
        updated: [],
        deleted: [],
        conflicts: [],
      },
      sessions: {
        created: [],
        errors: [],
      },
      errors: [],
    };

    // Process deck operations
    if (decks && Array.isArray(decks)) {
      for (const { operation, data } of decks) {
        try {
          if (operation === "create") {
            // Create new deck on server
            const serverId = generateULID("deck");
            await client.query(
              `INSERT INTO decks (deck_id, user_id, client_id, name, description,
                                 card_count, version, last_modified_at, is_deleted)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                serverId,
                userId,
                data.id,
                data.name,
                data.description,
                data.cardCount || 0,
                data.version || 1,
                data.lastModifiedAt || new Date(),
                data.isDeleted || false,
              ],
            );
            response.decks.created.push(data.id);
          } else if (operation === "update") {
            // Check for conflicts
            const existing = await client.query(
              "SELECT version, last_modified_at FROM decks WHERE client_id = $1 AND user_id = $2",
              [data.id, userId],
            );

            if (existing.rows.length > 0) {
              const serverVersion = existing.rows[0].version;
              const serverModified = new Date(
                existing.rows[0].last_modified_at,
              );
              const clientModified = new Date(data.lastModifiedAt);

              // Check for version conflict
              if (data.version && data.version < serverVersion) {
                response.decks.conflicts.push({
                  entityType: "deck",
                  entityId: data.id,
                  localVersion: data.version,
                  serverVersion: serverVersion,
                  localData: data,
                  serverData: existing.rows[0],
                  conflictedFields: ["version"],
                });
                continue;
              }

              // Update deck
              await client.query(
                `UPDATE decks
                 SET name = $1, description = $2, card_count = $3,
                     version = $4, last_modified_at = $5, is_deleted = $6
                 WHERE client_id = $7 AND user_id = $8`,
                [
                  data.name,
                  data.description,
                  data.cardCount || 0,
                  (serverVersion || 0) + 1,
                  data.lastModifiedAt || new Date(),
                  data.isDeleted || false,
                  data.id,
                  userId,
                ],
              );
              response.decks.updated.push(data.id);
            } else {
              // Deck doesn't exist, treat as create
              const serverId = generateULID("deck");
              await client.query(
                `INSERT INTO decks (deck_id, user_id, client_id, name, description,
                                   card_count, version, last_modified_at, is_deleted)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                  serverId,
                  userId,
                  data.id,
                  data.name,
                  data.description,
                  data.cardCount || 0,
                  data.version || 1,
                  data.lastModifiedAt || new Date(),
                  data.isDeleted || false,
                ],
              );
              response.decks.created.push(data.id);
            }
          } else if (operation === "delete") {
            // Soft delete deck
            await client.query(
              `UPDATE decks
               SET is_deleted = true, last_modified_at = $1, version = version + 1
               WHERE client_id = $2 AND user_id = $3`,
              [new Date(), data.id, userId],
            );
            response.decks.deleted.push(data.id);
          }
        } catch (error) {
          response.errors.push({
            entityType: "deck",
            entityId: data.id,
            operation,
            error: error.message,
            timestamp: new Date(),
            retryable: true,
          });
        }
      }
    }

    // Process card operations
    if (cards && Array.isArray(cards)) {
      for (const { operation, data } of cards) {
        try {
          if (operation === "create") {
            // Create new card on server
            const serverId = generateULID("card");
            await client.query(
              `INSERT INTO cards (card_id, user_id, client_id, deck_client_id, front, back,
                                 due, interval, repetitions, ease_factor, status,
                                 version, last_modified_at, is_deleted)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
              [
                serverId,
                userId,
                data.id,
                data.deckId,
                data.front,
                data.back,
                data.due || new Date(),
                data.interval || 0,
                data.repetitions || 0,
                data.easeFactor || 2.5,
                data.status || "new",
                data.version || 1,
                data.lastModifiedAt || new Date(),
                data.isDeleted || false,
              ],
            );
            response.cards.created.push(data.id);
          } else if (operation === "update") {
            // Check for conflicts
            const existing = await client.query(
              "SELECT version FROM cards WHERE client_id = $1 AND user_id = $2",
              [data.id, userId],
            );

            if (existing.rows.length > 0) {
              const serverVersion = existing.rows[0].version;

              // Check for version conflict
              if (data.version && data.version < serverVersion) {
                response.cards.conflicts.push({
                  entityType: "card",
                  entityId: data.id,
                  localVersion: data.version,
                  serverVersion: serverVersion,
                  localData: data,
                  serverData: existing.rows[0],
                  conflictedFields: ["version"],
                });
                continue;
              }

              // Update card
              await client.query(
                `UPDATE cards
                 SET front = $1, back = $2, due = $3, interval = $4,
                     repetitions = $5, ease_factor = $6, status = $7,
                     version = $8, last_modified_at = $9, is_deleted = $10
                 WHERE client_id = $11 AND user_id = $12`,
                [
                  data.front,
                  data.back,
                  data.due,
                  data.interval,
                  data.repetitions,
                  data.easeFactor,
                  data.status,
                  (serverVersion || 0) + 1,
                  data.lastModifiedAt || new Date(),
                  data.isDeleted || false,
                  data.id,
                  userId,
                ],
              );
              response.cards.updated.push(data.id);
            } else {
              // Card doesn't exist, treat as create
              const serverId = generateULID("card");
              await client.query(
                `INSERT INTO cards (card_id, user_id, client_id, deck_client_id, front, back,
                                   due, interval, repetitions, ease_factor, status,
                                   version, last_modified_at, is_deleted)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                [
                  serverId,
                  userId,
                  data.id,
                  data.deckId,
                  data.front,
                  data.back,
                  data.due || new Date(),
                  data.interval || 0,
                  data.repetitions || 0,
                  data.easeFactor || 2.5,
                  data.status || "new",
                  data.version || 1,
                  data.lastModifiedAt || new Date(),
                  data.isDeleted || false,
                ],
              );
              response.cards.created.push(data.id);
            }
          } else if (operation === "delete") {
            // Soft delete card
            await client.query(
              `UPDATE cards
               SET is_deleted = true, last_modified_at = $1, version = version + 1
               WHERE client_id = $2 AND user_id = $3`,
              [new Date(), data.id, userId],
            );
            response.cards.deleted.push(data.id);
          }
        } catch (error) {
          response.errors.push({
            entityType: "card",
            entityId: data.id,
            operation,
            error: error.message,
            timestamp: new Date(),
            retryable: true,
          });
        }
      }
    }

    // Process study session operations
    if (sessions && Array.isArray(sessions)) {
      for (const { operation, data } of sessions) {
        try {
          if (operation === "create") {
            const serverId = generateULID("rev");
            await client.query(
              `INSERT INTO study_sessions (session_id, user_id, client_id, card_client_id,
                                          rating, time_spent_ms, studied_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                serverId,
                userId,
                data.id,
                data.cardId,
                data.rating,
                data.duration,
                data.timestamp || new Date(),
              ],
            );
            response.sessions.created.push(data.id);
          }
        } catch (error) {
          response.sessions.errors.push({
            entityType: "session",
            entityId: data.id,
            operation,
            error: error.message,
            timestamp: new Date(),
            retryable: true,
          });
        }
      }
    }

    await client.query("COMMIT");

    res.json(response);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Sync error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date(),
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/sync/changes
 *
 * Fetches changes from server since a given timestamp.
 * Returns decks, cards, and sessions that have been modified on the server.
 */
router.get("/changes", async (req, res) => {
  const { since } = req.query;
  const userId = req.userId;

  try {
    const response = {
      success: true,
      timestamp: new Date(),
      decks: {
        created: [],
        updated: [],
        deleted: [],
        conflicts: [],
      },
      cards: {
        created: [],
        updated: [],
        deleted: [],
        conflicts: [],
      },
      errors: [],
    };

    const sinceDate = since ? new Date(since) : new Date(0);

    // Fetch deck changes
    const deckChanges = await pool.query(
      `SELECT deck_id, client_id, name, description, card_count,
              version, last_modified_at, is_deleted
       FROM decks
       WHERE user_id = $1 AND last_modified_at > $2
       ORDER BY last_modified_at ASC`,
      [userId, sinceDate],
    );

    for (const deck of deckChanges.rows) {
      if (deck.is_deleted) {
        response.decks.deleted.push(deck.client_id || deck.deck_id);
      } else if (deck.version === 1) {
        response.decks.created.push(deck.client_id || deck.deck_id);
      } else {
        response.decks.updated.push(deck.client_id || deck.deck_id);
      }
    }

    // Fetch card changes
    const cardChanges = await pool.query(
      `SELECT card_id, client_id, deck_client_id, front, back, due,
              interval, repetitions, ease_factor, status,
              version, last_modified_at, is_deleted
       FROM cards
       WHERE user_id = $1 AND last_modified_at > $2
       ORDER BY last_modified_at ASC`,
      [userId, sinceDate],
    );

    for (const card of cardChanges.rows) {
      if (card.is_deleted) {
        response.cards.deleted.push(card.client_id || card.card_id);
      } else if (card.version === 1) {
        response.cards.created.push(card.client_id || card.card_id);
      } else {
        response.cards.updated.push(card.client_id || card.card_id);
      }
    }

    res.json(response);
  } catch (error) {
    console.error("Fetch changes error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date(),
    });
  }
});

export default router;
