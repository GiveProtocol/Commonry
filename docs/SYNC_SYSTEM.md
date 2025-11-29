# Commonry Sync System

A production-grade bidirectional synchronization system between client (IndexedDB) and server (PostgreSQL).

## Overview

The sync system ensures that decks, cards, and study sessions are synchronized across devices while supporting offline usage. It implements a **hybrid sync strategy** with field-level conflict resolution.

## Architecture

### Client-Side Components

#### 1. **Sync Types** (`src/types/sync.ts`)
Defines all TypeScript interfaces for sync operations:
- `SyncStatus`: 'synced' | 'pending' | 'conflict' | 'error'
- `SyncOperation`: 'create' | 'update' | 'delete'
- `SyncEntityType`: 'deck' | 'card' | 'session'
- `SyncMetadata`: Version tracking, timestamps, deletion flags
- `SyncableCard` & `SyncableDeck`: Extended types with sync metadata
- `SyncConfig`: Configurable sync settings

#### 2. **Database Layer** (`src/storage/database.ts`)
Updated IndexedDB schema (v4) with:
- Sync metadata fields on all tables
- `syncQueue` table for offline operations
- Soft delete support (tombstones)
- Version tracking for conflict detection
- Helper methods for sync operations

**Key Changes:**
```typescript
// Sync metadata fields added to cards and decks
serverId?: string;
lastSyncedAt?: Date;
lastModifiedAt: Date;
syncStatus: SyncStatus;
version: number;
isDeleted?: boolean;
userId?: string;
```

**New Methods:**
- `queueSyncOperation()`: Adds operations to offline queue
- `getPendingSyncItems()`: Retrieves queued operations
- `getEntitiesNeedingSync()`: Gets pending entities
- `markAsSynced()`: Updates sync status after success
- `filterDeleted()`: Filters out soft-deleted entities

#### 3. **Sync Service** (`src/services/sync-service.ts`)
Orchestrates all sync operations:
- **Auto-sync**: Periodic background syncing (default: 30s)
- **Manual sync**: User-triggered sync
- **Push sync**: Upload local changes to server
- **Pull sync**: Download server changes to client
- **Conflict resolution**: Field-level last-write-wins
- **Offline queue**: Processes pending operations when online
- **Sync statistics**: Real-time sync state tracking

**Configuration Options:**
```typescript
{
  autoSync: true,           // Enable automatic syncing
  syncInterval: 30000,      // Sync every 30 seconds
  batchSize: 50,           // Max items per batch
  maxRetries: 3,           // Retry failed operations
  wifiOnly: false,         // Only sync on WiFi
  syncSessions: true       // Sync study sessions
}
```

#### 4. **Sync Status UI** (`src/components/SyncStatusIndicator.tsx`)
Visual indicator showing:
- Online/offline status
- Pending changes count
- Conflicts and errors
- Last sync timestamp
- Manual sync button

**Integration:**
The sync status indicator is automatically shown in the SharedNavigation component on all authenticated pages.

### Server-Side Components

#### 1. **Sync Routes** (`sync-routes.js`)
Express router handling sync API endpoints:

**POST `/api/sync`**
- Receives batch operations from client
- Processes creates, updates, deletes
- Detects version conflicts
- Returns results and conflicts

**GET `/api/sync/changes`**
- Fetches server changes since timestamp
- Returns modified entities for pull sync

#### 2. **Database Schema Requirements**
PostgreSQL tables need these columns:

```sql
-- For decks table
client_id VARCHAR(255),          -- Client's local ID
version INT DEFAULT 1,           -- Version for conflict detection
last_modified_at TIMESTAMP,      -- Last modification time
is_deleted BOOLEAN DEFAULT false -- Soft delete flag

-- For cards table
client_id VARCHAR(255),
deck_client_id VARCHAR(255),     -- Reference to deck's client ID
version INT DEFAULT 1,
last_modified_at TIMESTAMP,
is_deleted BOOLEAN DEFAULT false

-- For study_sessions table
client_id VARCHAR(255),
card_client_id VARCHAR(255)      -- Reference to card's client ID
```

## Sync Flow

### 1. **Create Operation**
```
User creates deck locally
  ↓
IndexedDB: Store with syncStatus='pending', version=1
  ↓
Queue sync operation
  ↓
[Auto-sync triggers]
  ↓
POST /api/sync with deck data
  ↓
Server: Create deck, assign server_id
  ↓
Client: Update syncStatus='synced', store serverId
```

### 2. **Update Operation**
```
User edits card locally
  ↓
IndexedDB: Increment version, set syncStatus='pending'
  ↓
Queue sync operation
  ↓
[Auto-sync triggers]
  ↓
POST /api/sync with card data + version
  ↓
Server: Check version conflicts
  ↓
If version OK: Update card, increment server version
If conflict: Return conflict for resolution
  ↓
Client: If no conflict, mark as synced
        If conflict, apply field-level LWW
```

### 3. **Delete Operation**
```
User deletes deck
  ↓
IndexedDB: Set isDeleted=true, syncStatus='pending'
  ↓
Queue sync operation
  ↓
[Auto-sync triggers]
  ↓
POST /api/sync with deletion flag
  ↓
Server: Soft delete (set is_deleted=true)
  ↓
Client: Mark as synced
```

### 4. **Offline → Online Recovery**
```
User makes changes while offline
  ↓
Changes queued in syncQueue table
  ↓
Connection restored
  ↓
SyncService detects online status
  ↓
Automatically triggers full sync
  ↓
Process all queued operations
  ↓
Resolve any conflicts
  ↓
Update sync status indicators
```

## Conflict Resolution

### Strategy: Field-Level Last-Write-Wins (LWW)

When the same entity is modified on both client and server:

1. **Detect conflict**: Server version > client version
2. **Compare timestamps**: For each conflicted field
3. **Apply LWW**: Keep the most recently modified value
4. **Merge**: Combine client and server data
5. **Sync**: Upload merged version to server

**Example:**
```typescript
// Client has: { name: "Spanish", lastModifiedAt: "2025-11-24T10:00:00" }
// Server has: { name: "Español", lastModifiedAt: "2025-11-24T09:00:00" }

// Resolution: Keep client's "Spanish" (more recent timestamp)
// Merged: { name: "Spanish", version: 3, syncStatus: 'synced' }
```

## Usage

### Initialization

The sync service is automatically initialized in `App.tsx`:

```typescript
useEffect(() => {
  const initializeApp = async () => {
    await db.open();
    await syncService.initialize();  // Starts auto-sync
    setIsInitialized(true);
  };

  initializeApp();

  return () => {
    syncService.cleanup();  // Cleanup on unmount
  };
}, []);
```

### Manual Sync

Users can manually trigger sync via the sync status indicator:

```typescript
const result = await syncService.triggerManualSync();
console.log(`Synced: ${result.itemsSynced}, Failed: ${result.itemsFailed}`);
```

### Configuration

Update sync settings programmatically:

```typescript
syncService.updateConfig({
  autoSync: true,
  syncInterval: 60000,  // Sync every 1 minute
  batchSize: 100,
  wifiOnly: true        // Only sync on WiFi
});
```

### Monitoring

Get real-time sync statistics:

```typescript
const stats = await syncService.getSyncStats();
console.log({
  lastSyncAt: stats.lastSyncAt,
  pendingCount: stats.pendingCount,
  conflictCount: stats.conflictCount,
  isOnline: stats.isOnline,
  isSyncing: stats.isSyncing
});
```

## Testing Scenarios

### Recommended Test Cases

1. **Basic Sync**
   - Create deck → Verify synced to server
   - Edit card → Verify update synced
   - Delete deck → Verify soft delete synced

2. **Offline Mode**
   - Go offline → Create/edit entities
   - Go online → Verify queued operations sync

3. **Conflict Resolution**
   - Edit same card on two devices
   - Sync both → Verify LWW resolution

4. **Multi-Device**
   - Create deck on Device A
   - Sync
   - Open on Device B → Verify deck appears

5. **Large Batches**
   - Import 1000+ cards
   - Verify batched syncing (50 items/batch)
   - Check sync progress indicators

6. **Error Handling**
   - Network interruption during sync
   - Server error responses
   - Verify retry logic and error indicators

7. **Data Integrity**
   - Verify no duplicate cards after sync
   - Verify soft deletes don't reappear
   - Verify version numbers increment correctly

## Implementation Status

✅ **Completed:**
- Sync data models and types
- IndexedDB schema with sync metadata
- SyncService for orchestration
- Server API endpoints
- Push sync (client → server)
- Pull sync (server → client)
- Conflict resolution logic
- Offline queue for sessions
- Sync status UI indicators

⏳ **Pending:**
- Comprehensive testing across scenarios
- Database migration scripts for production
- Performance optimization for large datasets
- Sync analytics and monitoring

## Best Practices

### For Developers

1. **Always use database methods**: Don't bypass the database layer's sync tracking
2. **Test offline scenarios**: Sync is complex when network is unreliable
3. **Monitor sync status**: Use the SyncService statistics in debugging
4. **Handle conflicts gracefully**: User experience during conflicts is critical

### For Database Schema

1. **Index sync fields**: Add indexes on `syncStatus`, `lastModifiedAt`, `userId`
2. **Archive deleted items**: Periodically clean up old soft-deleted records
3. **Backup before migrations**: Schema v4 changes are significant

### For Performance

1. **Batch operations**: Use batch sync for multiple items
2. **Limit sync frequency**: Default 30s is reasonable, don't go below 10s
3. **Monitor network usage**: Disable auto-sync on metered connections

## Troubleshooting

### Sync not happening

**Check:**
1. Is user online? `syncService.getSyncStats().isOnline`
2. Is auto-sync enabled? `syncService.getConfig().autoSync`
3. Any errors? `syncService.getSyncStats().errorCount`

### Conflicts not resolving

**Check:**
1. Are version numbers incrementing?
2. Is `lastModifiedAt` updating correctly?
3. Are conflicts appearing in UI?

### Offline queue not processing

**Check:**
1. Is network back online?
2. Are items in queue? `db.getPendingSyncItems()`
3. Check browser console for errors

## Future Enhancements

**Potential improvements:**
- Real-time sync via WebSockets
- Differential sync (only changed fields)
- Compressed sync payloads
- User-configurable conflict resolution strategies
- Sync activity log for debugging
- Background sync via Service Workers

## Support

For issues or questions about the sync system:
1. Check browser console for sync errors
2. Verify database schema matches requirements
3. Test with manual sync first before relying on auto-sync
4. Review sync statistics for diagnostic info
