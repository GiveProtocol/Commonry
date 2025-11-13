import { useState, useEffect, useCallback } from 'react';

export interface CommandHistoryEntry {
  id: string;
  command: string;
  timestamp: Date;
  type: 'action' | 'navigation' | 'system';
  result?: 'success' | 'error' | 'info';
  metadata?: Record<string, any>;
}

const STORAGE_KEY = 'commonry_command_history';
const MAX_HISTORY_ENTRIES = 100;

export function useCommandHistory() {
  const [history, setHistory] = useState<CommandHistoryEntry[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        const historyWithDates = parsed.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }));
        setHistory(historyWithDates);
      } catch (error) {
        console.error('Failed to load command history:', error);
      }
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }
  }, [history]);

  const addCommand = useCallback((
    command: string,
    type: 'action' | 'navigation' | 'system' = 'action',
    result?: 'success' | 'error' | 'info',
    metadata?: Record<string, any>
  ) => {
    const entry: CommandHistoryEntry = {
      id: crypto.randomUUID(),
      command,
      timestamp: new Date(),
      type,
      result,
      metadata,
    };

    setHistory((prev) => {
      const newHistory = [entry, ...prev];
      // Keep only the most recent MAX_HISTORY_ENTRIES
      return newHistory.slice(0, MAX_HISTORY_ENTRIES);
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const getRecentCommands = useCallback((count = 10) => {
    return history.slice(0, count);
  }, [history]);

  const getCommandsByType = useCallback((type: 'action' | 'navigation' | 'system') => {
    return history.filter(entry => entry.type === type);
  }, [history]);

  const searchHistory = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return history.filter(entry =>
      entry.command.toLowerCase().includes(lowerQuery)
    );
  }, [history]);

  return {
    history,
    addCommand,
    clearHistory,
    getRecentCommands,
    getCommandsByType,
    searchHistory,
  };
}

// Helper functions for common commands
export const CommandTemplates = {
  navigation: (view: string) => `cd /${view}`,
  study: (deckName?: string) => deckName ? `./study --deck="${deckName}"` : './study',
  createDeck: (deckName: string) => `./create-deck --name="${deckName}"`,
  importDeck: (filename: string) => `./import-deck "${filename}"`,
  deleteDeck: (deckName: string) => `./delete-deck --force "${deckName}"`,
  reviewCard: (rating: number) => `./review --rating=${rating}`,
  exportStats: () => './export-stats --format=json',
  login: (username: string) => `./auth login ${username}`,
  logout: () => './auth logout',
  signup: (username: string) => `./auth signup ${username}`,
};
