/**
 * Sync Status Indicator Component
 *
 * Displays current sync status, pending changes, and last sync time.
 * Allows users to manually trigger sync operations.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CloudOff, RefreshCw, Check, AlertCircle, Clock } from "lucide-react";
import { syncService } from "../services/sync-service";
import type { SyncStats, SyncResult } from "../types/sync";

export function SyncStatusIndicator() {
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Close dropdown handler
  const closeDropdown = useCallback(() => {
    setShowDetails(false);
  }, []);

  // Close dropdown on Escape key (keyboard accessibility)
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && showDetails) {
        setShowDetails(false);
      }
    },
    [showDetails],
  );

  // Handle keyboard events on backdrop
  const handleBackdropKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setShowDetails(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Poll sync stats every 5 seconds
  useEffect(() => {
    const loadStats = async () => {
      const currentStats = await syncService.getSyncStats();
      setStats(currentStats);
    };

    loadStats();
    const interval = setInterval(loadStats, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      const result = await syncService.triggerManualSync();
      setLastSyncResult(result);

      // Refresh stats after sync
      const updatedStats = await syncService.getSyncStats();
      setStats(updatedStats);
    } catch (error) {
      console.error("Manual sync failed:", error);
    } finally {
      setIsManualSyncing(false);
    }
  };

  if (!stats) {
    return null;
  }

  const getSyncIcon = () => {
    if (!stats.isOnline) return <CloudOff className="w-4 h-4" />;
    if (stats.isSyncing) return <RefreshCw className="w-4 h-4 animate-spin" />;
    if (stats.errorCount > 0) return <AlertCircle className="w-4 h-4" />;
    if (stats.pendingCount > 0) return <Clock className="w-4 h-4" />;
    return <Check className="w-4 h-4" />;
  };

  const getSyncStatus = () => {
    if (!stats.isOnline) return "Offline";
    if (stats.isSyncing) return "Syncing...";
    if (stats.errorCount > 0) return "Sync Error";
    if (stats.pendingCount > 0) return `${stats.pendingCount} pending`;
    return "Synced";
  };

  const getStatusColor = () => {
    if (!stats.isOnline) return "text-terminal-muted dark:text-text-muted";
    if (stats.isSyncing) return "text-terminal-primary dark:text-cyan";
    if (stats.errorCount > 0) return "text-red-500";
    if (stats.pendingCount > 0) return "text-terminal-accent dark:text-amber";
    return "text-green-500";
  };

  const formatLastSync = () => {
    if (!stats.lastSyncAt) return "Never";

    const now = new Date();
    const then = new Date(stats.lastSyncAt);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="relative">
      {/* Main Status Button */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full
                   bg-terminal-surface dark:bg-dark-surface
                   border border-terminal-muted dark:border-dark-border
                   hover:bg-terminal-base dark:hover:bg-dark-border
                   transition-colors font-mono text-sm
                   ${getStatusColor()}`}
        title={`Sync status: ${getSyncStatus()}`}
      >
        {getSyncIcon()}
        <span className="hidden sm:inline">{getSyncStatus()}</span>
      </button>

      {/* Details Dropdown */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 top-full mt-2 w-72
                     bg-terminal-surface dark:bg-dark-surface
                     border-2 border-terminal-primary dark:border-cyan
                     rounded-lg shadow-terminal-glow dark:shadow-cyan-glow
                     z-50 overflow-hidden"
          >
            {/* Header */}
            <div
              className="h-8 bg-terminal-muted dark:bg-dark-border
                          border-b border-terminal-primary/30 dark:border-cyan/30
                          flex items-center px-4 gap-2"
            >
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-orange/50 dark:bg-amber/50" />
              <div className="w-3 h-3 rounded-full bg-green/50 dark:bg-cyan/50" />
              <span className="ml-2 text-xs font-mono text-terminal-muted dark:text-text-muted">
                sync-status
              </span>
            </div>

            <div className="p-4">
              {/* Connection Status */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-mono text-terminal-muted dark:text-text-muted">
                  Connection
                </span>
                <span
                  className={`text-sm font-mono ${stats.isOnline ? "text-green-500" : "text-red-500"}`}
                >
                  {stats.isOnline ? "Online" : "Offline"}
                </span>
              </div>

              {/* Pending Changes */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-mono text-terminal-muted dark:text-text-muted">
                  Pending
                </span>
                <span className="text-sm font-mono text-terminal-accent dark:text-amber">
                  {stats.pendingCount} items
                </span>
              </div>

              {/* Conflicts */}
              {stats.conflictCount > 0 && (
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-mono text-terminal-muted dark:text-text-muted">
                    Conflicts
                  </span>
                  <span className="text-sm font-mono text-red-500">
                    {stats.conflictCount} items
                  </span>
                </div>
              )}

              {/* Errors */}
              {stats.errorCount > 0 && (
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-mono text-terminal-muted dark:text-text-muted">
                    Errors
                  </span>
                  <span className="text-sm font-mono text-red-500">
                    {stats.errorCount} items
                  </span>
                </div>
              )}

              {/* Last Sync */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-mono text-terminal-muted dark:text-text-muted">
                  Last Sync
                </span>
                <span className="text-sm font-mono text-terminal-text dark:text-text">
                  {formatLastSync()}
                </span>
              </div>

              {/* Last Sync Result */}
              {lastSyncResult && (
                <div className="mb-4 p-2 rounded bg-terminal-base dark:bg-dark border border-terminal-muted dark:border-dark-border">
                  <div className="text-xs font-mono text-terminal-muted dark:text-text-muted mb-1">
                    Last sync result:
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-green-500">
                      ✓ {lastSyncResult.itemsSynced} synced
                    </span>
                    {lastSyncResult.itemsFailed > 0 && (
                      <span className="text-red-500">
                        ✗ {lastSyncResult.itemsFailed} failed
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Manual Sync Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleManualSync}
                disabled={!stats.isOnline || stats.isSyncing || isManualSyncing}
                className="w-full bg-terminal-primary dark:bg-cyan
                         hover:bg-terminal-primary/90 dark:hover:bg-cyan-dark
                         disabled:opacity-50 disabled:cursor-not-allowed
                         text-paper dark:text-dark py-2 px-4 rounded
                         border border-terminal-primary dark:border-cyan
                         font-mono font-bold transition-all
                         shadow-terminal-glow dark:shadow-cyan-glow
                         flex items-center justify-center gap-2"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isManualSyncing ? "animate-spin" : ""}`}
                />
                {isManualSyncing ? "Syncing..." : "Sync Now"}
              </motion.button>

              {/* Terminal Prompt */}
              <div className="mt-3 text-xs font-mono text-terminal-muted dark:text-text-muted">
                $ ./sync --manual
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click outside to close (keyboard users can press Escape) */}
      {showDetails && (
        <div
          className="fixed inset-0 z-40"
          onClick={closeDropdown}
          onKeyDown={handleBackdropKeyDown}
          role="button"
          tabIndex={-1}
          aria-label="Close sync status dropdown"
        />
      )}
    </div>
  );
}
