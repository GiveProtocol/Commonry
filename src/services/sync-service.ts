/**
 * Sync Service
 *
 * Orchestrates bidirectional synchronization between client (IndexedDB)
 * and server (PostgreSQL). Handles conflict resolution, offline queue,
 * and sync status tracking.
 */

import { db } from "../storage/database";
import {
  SyncConfig,
  SyncResult,
  SyncStats,
  SyncConflict,
  SyncError,
  SyncRequest,
  SyncResponse,
  SyncOperation,
  SyncableSession,
  DEFAULT_SYNC_CONFIG,
} from "../types/sync";
import type { StudySession } from "../storage/database";

export class SyncService {
  private config: SyncConfig;
  private syncInterval: number | null = null;
  private isSyncing = false;
  private lastSyncAt?: Date;
  private onlineStatusListener?: () => void;

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    this.setupOnlineStatusListener();
  }

  /**
   * Initializes the sync service and starts auto-sync if enabled.
   */
  async initialize(): Promise<void> {
    if (this.config.autoSync) {
      this.startAutoSync();
    }
  }

  /**
   * Starts automatic periodic syncing.
   */
  startAutoSync(): void {
    if (this.syncInterval) return;

    this.syncInterval = window.setInterval(async () => {
      if (this.shouldSync()) {
        await this.performSync();
      }
    }, this.config.syncInterval);
  }

  /**
   * Stops automatic syncing.
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Checks if sync should proceed based on configuration.
   */
  private shouldSync(): boolean {
    if (this.isSyncing) return false;
    if (!navigator.onLine) return false;

    // Check WiFi-only setting (currently just checks online status)
    // In a real app, you'd check the connection type
    if (this.config.wifiOnly && !this.isOnWiFi()) {
      return false;
    }

    return true;
  }

  /**
   * Placeholder for WiFi detection.
   * In a real implementation, use Network Information API.
   */
  private isOnWiFi(): boolean {
    // For now, assume any online connection is acceptable
    // Real implementation would check navigator.connection.type
    return true;
  }

  /**
   * Sets up listener for online/offline status changes.
   */
  private setupOnlineStatusListener(): void {
    this.onlineStatusListener = () => {
      if (navigator.onLine && this.config.autoSync) {
        this.performSync().catch((error) => {
          console.error("Auto-sync after reconnection failed:", error);
        });
      }
    };

    window.addEventListener("online", this.onlineStatusListener);
  }

  /**
   * Cleans up listeners and intervals.
   */
  cleanup(): void {
    this.stopAutoSync();
    if (this.onlineStatusListener) {
      window.removeEventListener("online", this.onlineStatusListener);
    }
  }

  /**
   * Performs a full sync cycle: push then pull.
   */
  async performSync(): Promise<SyncResult> {
    if (!navigator.onLine) {
      return {
        success: false,
        itemsSynced: 0,
        itemsFailed: 0,
        conflicts: [],
        errors: [
          {
            entityType: "deck",
            entityId: "",
            operation: "update",
            error: "No internet connection",
            timestamp: new Date(),
            retryable: true,
          },
        ],
        timestamp: new Date(),
      };
    }

    this.isSyncing = true;

    try {
      // Step 1: Push local changes to server
      const pushResult = await this.pushToServer();

      // Step 2: Pull server changes to client
      const pullResult = await this.pullFromServer();

      // Combine results
      const result: SyncResult = {
        success: pushResult.success && pullResult.success,
        itemsSynced: pushResult.itemsSynced + pullResult.itemsSynced,
        itemsFailed: pushResult.itemsFailed + pullResult.itemsFailed,
        conflicts: [...pushResult.conflicts, ...pullResult.conflicts],
        errors: [...pushResult.errors, ...pullResult.errors],
        timestamp: new Date(),
      };

      this.lastSyncAt = result.timestamp;
      return result;
    } catch (error) {
      console.error("Sync failed:", error);
      return {
        success: false,
        itemsSynced: 0,
        itemsFailed: 0,
        conflicts: [],
        errors: [
          {
            entityType: "deck",
            entityId: "",
            operation: "update",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date(),
            retryable: true,
          },
        ],
        timestamp: new Date(),
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pushes local changes to the server.
   */
  private async pushToServer(): Promise<SyncResult> {
    const entities = await db.getEntitiesNeedingSync();
    const conflicts: SyncConflict[] = [];
    const errors: SyncError[] = [];
    let itemsSynced = 0;
    let itemsFailed = 0;

    // Build sync request
    const request: SyncRequest = {
      lastSyncAt: this.lastSyncAt,
    };

    // Process decks
    if (entities.decks.length > 0) {
      request.decks = entities.decks
        .slice(0, this.config.batchSize)
        .map((deck) => ({
          operation: this.determineOperation(deck),
          data: deck,
        }));
    }

    // Process cards
    if (entities.cards.length > 0) {
      request.cards = entities.cards
        .slice(0, this.config.batchSize)
        .map((card) => ({
          operation: this.determineOperation(card),
          data: card,
        }));
    }

    // Process sessions (if enabled)
    if (this.config.syncSessions && entities.sessions.length > 0) {
      request.sessions = entities.sessions
        .slice(0, this.config.batchSize)
        .filter(
          (session): session is StudySession & { id: string } =>
            session.id !== undefined,
        )
        .map((session) => ({
          operation: "create" as SyncOperation,
          data: {
            id: session.id,
            cardId: session.cardId,
            rating: session.rating,
            duration: session.duration,
            timestamp: session.timestamp,
            serverId: session.serverId,
            lastSyncedAt: session.lastSyncedAt,
            syncStatus: session.syncStatus || "pending",
            userId: session.userId,
          } as SyncableSession,
        }));
    }

    try {
      const response = await this.sendSyncRequest(request);

      if (response.success) {
        // Mark successfully synced items
        if (response.decks) {
          for (const deckId of response.decks.created) {
            await db.markAsSynced("deck", deckId);
            itemsSynced++;
          }
          for (const deckId of response.decks.updated) {
            await db.markAsSynced("deck", deckId);
            itemsSynced++;
          }
          conflicts.push(...response.decks.conflicts);
        }

        if (response.cards) {
          for (const cardId of response.cards.created) {
            await db.markAsSynced("card", cardId);
            itemsSynced++;
          }
          for (const cardId of response.cards.updated) {
            await db.markAsSynced("card", cardId);
            itemsSynced++;
          }
          conflicts.push(...response.cards.conflicts);
        }

        if (response.sessions) {
          for (const sessionId of response.sessions.created) {
            await db.markAsSynced("session", sessionId);
            itemsSynced++;
          }
          if (response.sessions.errors) {
            errors.push(...response.sessions.errors);
            itemsFailed += response.sessions.errors.length;
          }
        }

        if (response.errors) {
          errors.push(...response.errors);
          itemsFailed += response.errors.length;
        }
      }
    } catch (error) {
      console.error("Push sync failed:", error);
      itemsFailed =
        (request.decks?.length || 0) +
        (request.cards?.length || 0) +
        (request.sessions?.length || 0);
      errors.push({
        entityType: "deck",
        entityId: "",
        operation: "update",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
        retryable: true,
      });
    }

    return {
      success: itemsFailed === 0,
      itemsSynced,
      itemsFailed,
      conflicts,
      errors,
      timestamp: new Date(),
    };
  }

  /**
   * Pulls server changes to the client.
   */
  private async pullFromServer(): Promise<SyncResult> {
    const conflicts: SyncConflict[] = [];
    const errors: SyncError[] = [];
    let itemsSynced = 0;
    let itemsFailed = 0;

    try {
      // Fetch changes from server since last sync
      const response = await this.fetchServerChanges(this.lastSyncAt);

      if (response.success) {
        // Apply server changes locally
        // This is a simplified version - real implementation would handle conflicts
        itemsSynced += response.decks?.created.length || 0;
        itemsSynced += response.decks?.updated.length || 0;
        itemsSynced += response.cards?.created.length || 0;
        itemsSynced += response.cards?.updated.length || 0;

        conflicts.push(...(response.decks?.conflicts || []));
        conflicts.push(...(response.cards?.conflicts || []));
        errors.push(...(response.errors || []));
      }
    } catch (error) {
      console.error("Pull sync failed:", error);
      errors.push({
        entityType: "deck",
        entityId: "",
        operation: "update",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
        retryable: true,
      });
      itemsFailed++;
    }

    return {
      success: itemsFailed === 0,
      itemsSynced,
      itemsFailed,
      conflicts,
      errors,
      timestamp: new Date(),
    };
  }

  /**
   * Determines the operation type for an entity based on its state.
   */
  private determineOperation(entity: {
    isDeleted?: boolean;
    serverId?: string;
  }): SyncOperation {
    if (entity.isDeleted) return "delete";
    if (!entity.serverId) return "create";
    return "update";
  }

  /**
   * Sends sync request to server.
   */
  private async sendSyncRequest(request: SyncRequest): Promise<SyncResponse> {
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Sync request failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Fetches changes from server since last sync.
   */
  private async fetchServerChanges(since?: Date): Promise<SyncResponse> {
    const url = since
      ? `/api/sync/changes?since=${since.toISOString()}`
      : "/api/sync/changes";

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Fetch changes failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Resolves a conflict using field-level last-write-wins strategy.
   */
  async resolveConflict(conflict: SyncConflict): Promise<void> {
    const { entityType, entityId, localData, serverData } = conflict;

    // Field-level LWW: Compare timestamps for each field
    const merged = { ...serverData };

    for (const field of conflict.conflictedFields) {
      const localTime = localData.lastModifiedAt;
      const serverTime = serverData.lastModifiedAt;

      if (localTime > serverTime) {
        merged[field] = localData[field];
      }
    }

    // Apply merged data locally
    switch (entityType) {
      case "deck":
        await db.decks.update(entityId, merged);
        break;
      case "card":
        await db.cards.update(entityId, merged);
        break;
      case "session":
        await db.sessions.update(entityId, merged);
        break;
    }

    // Mark as synced
    await db.markAsSynced(entityType, entityId, serverData.serverId);
  }

  /**
   * Gets current sync statistics.
   */
  async getSyncStats(): Promise<SyncStats> {
    const entities = await db.getEntitiesNeedingSync();
    const pendingCount =
      entities.decks.length + entities.cards.length + entities.sessions.length;

    // Count conflicts (entities with 'conflict' status)
    const conflictCount = await this.countConflicts();

    // Count errors (entities with 'error' status)
    const errorCount = await this.countErrors();

    return {
      lastSyncAt: this.lastSyncAt,
      pendingCount,
      conflictCount,
      errorCount,
      isOnline: navigator.onLine,
      isSyncing: this.isSyncing,
    };
  }

  /**
   * Counts entities with conflict status.
   */
  private async countConflicts(): Promise<number> {
    const decksWithConflicts = await db.decks
      .where("syncStatus")
      .equals("conflict")
      .count();
    const cardsWithConflicts = await db.cards
      .where("syncStatus")
      .equals("conflict")
      .count();
    return decksWithConflicts + cardsWithConflicts;
  }

  /**
   * Counts entities with error status.
   */
  private async countErrors(): Promise<number> {
    const decksWithErrors = await db.decks
      .where("syncStatus")
      .equals("error")
      .count();
    const cardsWithErrors = await db.cards
      .where("syncStatus")
      .equals("error")
      .count();
    return decksWithErrors + cardsWithErrors;
  }

  /**
   * Manually triggers a sync operation.
   */
  async triggerManualSync(): Promise<SyncResult> {
    return await this.performSync();
  }

  /**
   * Updates sync configuration.
   */
  updateConfig(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart auto-sync if interval changed
    if (config.syncInterval || config.autoSync !== undefined) {
      this.stopAutoSync();
      if (this.config.autoSync) {
        this.startAutoSync();
      }
    }
  }

  /**
   * Gets current sync configuration.
   */
  getConfig(): SyncConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const syncService = new SyncService();
