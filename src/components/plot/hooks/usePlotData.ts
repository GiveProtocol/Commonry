import { useState, useEffect, useCallback } from "react";
import { db } from "../../../storage/database";
import { api, AnalyticsProfile, UserAchievement } from "../../../services/api";
import { useAuth } from "../../../contexts/AuthContext";
import { PlotData, DeckDueInfo } from "../types";
import { DeckId } from "../../../types/ids";

const CACHE_KEY = "plot_data_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedData {
  statistics: PlotData["statistics"];
  analyticsProfile: AnalyticsProfile | null;
  achievements: UserAchievement[] | null;
  timestamp: number;
}

function getCachedData(): CachedData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as CachedData;
    return parsed;
  } catch {
    return null;
  }
}

function setCachedData(data: Omit<CachedData, "timestamp">): void {
  try {
    const cacheEntry: CachedData = {
      ...data,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheEntry));
  } catch {
    // Ignore storage errors
  }
}

function isCacheValid(cached: CachedData | null): boolean {
  if (!cached) return false;
  return Date.now() - cached.timestamp < CACHE_TTL;
}

export function usePlotData(): PlotData & { refetch: () => void } {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isLocalDataLoaded, setIsLocalDataLoaded] = useState(false);
  const [totalDueCards, setTotalDueCards] = useState(0);
  const [deckWithMostDue, setDeckWithMostDue] = useState<DeckDueInfo | null>(
    null,
  );
  const [statistics, setStatistics] = useState<PlotData["statistics"]>(null);
  const [analyticsProfile, setAnalyticsProfile] =
    useState<AnalyticsProfile | null>(null);
  const [achievements, setAchievements] = useState<UserAchievement[] | null>(
    null,
  );

  // Load local data from IndexedDB
  const loadLocalData = useCallback(async () => {
    try {
      const decks = await db.getAllDecks();
      const now = new Date();

      let totalDue = 0;
      let maxDueDeck: DeckDueInfo | null = null;

      for (const deck of decks) {
        // Get cards for this deck and count due ones
        const cards = await db.cards.where("deckId").equals(deck.id).toArray();
        const activeCards = db.filterDeleted(cards);
        const dueCount = activeCards.filter((c) => c.due <= now).length;

        totalDue += dueCount;

        if (dueCount > 0 && (!maxDueDeck || dueCount > maxDueDeck.dueCount)) {
          maxDueDeck = {
            deckId: deck.id as DeckId,
            name: deck.name,
            dueCount,
          };
        }
      }

      setTotalDueCards(totalDue);
      setDeckWithMostDue(maxDueDeck);
      setIsLocalDataLoaded(true);
    } catch (error) {
      console.error("[usePlotData] Error loading local data:", error);
      setIsLocalDataLoaded(true);
    }
  }, []);

  // Load API data with caching
  const loadApiData = useCallback(
    async (useCache = true) => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Check cache first
      const cached = getCachedData();
      if (useCache && isCacheValid(cached) && cached) {
        setStatistics(cached.statistics);
        setAnalyticsProfile(cached.analyticsProfile);
        setAchievements(cached.achievements);
        setIsLoading(false);
        return;
      }

      // Show cached data immediately while fetching fresh data
      if (cached) {
        setStatistics(cached.statistics);
        setAnalyticsProfile(cached.analyticsProfile);
        setAchievements(cached.achievements);
      }

      try {
        // Fetch all data in parallel with graceful failure handling
        const [statsResult, profileResult, achievementsResult] =
          await Promise.allSettled([
            api.getUserStatistics(user.id, "week"),
            api.getAnalyticsProfile(user.id),
            api.getUserAchievements(user.username),
          ]);

        // Process statistics
        let newStats: PlotData["statistics"] = null;
        if (statsResult.status === "fulfilled" && statsResult.value.data) {
          const stats = statsResult.value.data.stats;
          newStats = {
            currentStreak: stats.current_streak || 0,
            lastStudyDate: stats.last_study_date || null,
            cardsStudiedThisWeek: stats.cards_studied || 0,
          };
          setStatistics(newStats);
        }

        // Process analytics profile
        let newProfile: AnalyticsProfile | null = null;
        if (profileResult.status === "fulfilled" && profileResult.value.data) {
          newProfile = profileResult.value.data;
          setAnalyticsProfile(newProfile);
        }

        // Process achievements
        let newAchievements: UserAchievement[] | null = null;
        if (
          achievementsResult.status === "fulfilled" &&
          achievementsResult.value.data
        ) {
          newAchievements = achievementsResult.value.data.achievements;
          setAchievements(newAchievements);
        }

        // Update cache
        setCachedData({
          statistics: newStats,
          analyticsProfile: newProfile,
          achievements: newAchievements,
        });
      } catch (error) {
        console.error("[usePlotData] Error loading API data:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

  // Refetch function for manual refresh
  const refetch = useCallback(() => {
    setIsLoading(true);
    loadLocalData();
    loadApiData(false); // Skip cache on manual refetch
  }, [loadLocalData, loadApiData]);

  // Initial load
  useEffect(() => {
    loadLocalData();
    loadApiData(true);
  }, [loadLocalData, loadApiData]);

  return {
    totalDueCards,
    deckWithMostDue,
    statistics,
    analyticsProfile,
    achievements,
    isLoading,
    isLocalDataLoaded,
    refetch,
  };
}
