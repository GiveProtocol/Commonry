import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  api,
  LeaderboardMetric,
  UserStatistics,
  LeaderboardEntry,
} from "../services/api";
import { useAuth } from "../contexts/AuthContext";

interface StatsViewProps {
  onBack: () => void;
}

type TimePeriod = "today" | "week" | "month" | "all";

export function StatsView({ onBack }: StatsViewProps) {
  const { user } = useAuth();
  const [period, setPeriod] = useState<TimePeriod>("today");
  const [stats, setStats] = useState<UserStatistics | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedMetric, setSelectedMetric] =
    useState<LeaderboardMetric>("total_cards");
  const [userRank, setUserRank] = useState<{
    rank: number | null;
    value: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, [period]);

  useEffect(() => {
    loadLeaderboard();
  }, [selectedMetric]);

  const loadStatistics = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Load user statistics
      const statsResponse = await api.getUserStatistics(user.id, period);
      if (statsResponse.data) {
        setStats(statsResponse.data.stats);
      }

      // Load user rank for selected metric
      const rankResponse = await api.getUserRank(user.id, selectedMetric);
      if (rankResponse.data) {
        setUserRank({
          rank: rankResponse.data.rank,
          value: rankResponse.data.value,
        });
      }
    } catch (error) {
      console.error("Failed to load statistics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const response = await api.getLeaderboard(selectedMetric, 100);
      if (response.data) {
        setLeaderboard(response.data.leaderboard);
      }

      // Also refresh user rank when leaderboard metric changes
      if (user) {
        const rankResponse = await api.getUserRank(user.id, selectedMetric);
        if (rankResponse.data) {
          setUserRank({
            rank: rankResponse.data.rank,
            value: rankResponse.data.value,
          });
        }
      }
    } catch (error) {
      console.error("Failed to load leaderboard:", error);
    }
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const formatValue = (metric: LeaderboardMetric, value: number) => {
    switch (metric) {
      case "total_time":
        return formatTime(value);
      case "retention_rate":
        return `${value.toFixed(1)}%`;
      case "current_streak":
        return `${value} days`;
      default:
        return value.toString();
    }
  };

  const getMetricLabel = (metric: LeaderboardMetric) => {
    switch (metric) {
      case "total_cards":
        return "Cards Studied";
      case "total_time":
        return "Time Spent";
      case "retention_rate":
        return "Retention Rate";
      case "current_streak":
        return "Current Streak";
    }
  };

  const getPeriodLabel = (p: TimePeriod) => {
    switch (p) {
      case "today":
        return "Today";
      case "week":
        return "This Week";
      case "month":
        return "This Month";
      case "all":
        return "All Time";
    }
  };

  const cardsStudied =
    period === "all"
      ? stats?.total_cards_studied || 0
      : stats?.cards_studied || 0;

  const timeSpent =
    period === "all" ? stats?.total_time_ms || 0 : stats?.total_time_ms || 0;

  const retentionRate = stats?.retention_rate || 0;
  const currentStreak = stats?.current_streak || 0;

  return (
    <div className="bg-white dark:bg-black min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-8 border-b border-border">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>

        <h1 className="text-2xl font-bold">Statistics</h1>

        <div></div>
      </div>

      <div className="p-8 max-w-7xl mx-auto">
        {/* Period Selector */}
        <div className="flex gap-2 mb-8 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 max-w-md mx-auto">
          {(["today", "week", "month", "all"] as TimePeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
                period === p
                  ? "bg-white dark:bg-gray-700 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {getPeriodLabel(p)}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"
            />
          </div>
        ) : (
          <>
            {/* Personal Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6"
              >
                <div className="text-center mb-3">
                  <span className="text-blue-900 dark:text-blue-300 text-sm font-medium">
                    {period === "all" ? "Total Cards" : "Cards Studied"}
                  </span>
                </div>
                <div className="text-4xl font-bold text-blue-900 dark:text-blue-100 text-center">
                  {cardsStudied}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6"
              >
                <div className="text-center mb-3">
                  <span className="text-purple-900 dark:text-purple-300 text-sm font-medium">
                    Time Spent
                  </span>
                </div>
                <div className="text-4xl font-bold text-purple-900 dark:text-purple-100 text-center">
                  {formatTime(timeSpent)}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-800 rounded-xl p-6"
              >
                <div className="text-center mb-3">
                  <span className="text-green-900 dark:text-green-300 text-sm font-medium">
                    Retention Rate
                  </span>
                </div>
                <div className="text-4xl font-bold text-green-900 dark:text-green-100 text-center">
                  {retentionRate.toFixed(1)}%
                </div>
              </motion.div>

              {period === "all" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6"
                >
                  <div className="text-center mb-3">
                    <span className="text-orange-900 dark:text-orange-300 text-sm font-medium">
                      Current Streak
                    </span>
                  </div>
                  <div className="text-4xl font-bold text-orange-900 dark:text-orange-100 text-center">
                    {currentStreak}
                    <span className="text-lg ml-1">days</span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Leaderboard Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-card border border-border rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold">Leaderboard</h2>
                </div>

                {/* User Rank Badge */}
                {userRank?.rank && (
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-4 py-2">
                    <div className="text-xs text-muted-foreground mb-1">
                      Your Rank
                    </div>
                    <div className="text-xl font-bold text-yellow-700 dark:text-yellow-400">
                      #{userRank.rank}
                    </div>
                  </div>
                )}
              </div>

              {/* Metric Selector */}
              <div className="flex gap-2 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 overflow-x-auto">
                {(
                  [
                    "total_cards",
                    "total_time",
                    "retention_rate",
                    "current_streak",
                  ] as LeaderboardMetric[]
                ).map((metric) => (
                  <button
                    key={metric}
                    onClick={() => setSelectedMetric(metric)}
                    className={`py-2 px-4 rounded-md font-medium whitespace-nowrap transition-all ${
                      selectedMetric === metric
                        ? "bg-white dark:bg-gray-700 text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {getMetricLabel(metric)}
                  </button>
                ))}
              </div>

              {/* Leaderboard List */}
              <div className="space-y-2">
                {leaderboard.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>
                      No data yet. Start studying to appear on the leaderboard!
                    </p>
                  </div>
                ) : (
                  leaderboard.slice(0, 10).map((entry, index) => (
                    <motion.div
                      key={entry.user_id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-center justify-between p-4 rounded-lg transition-all ${
                        entry.user_id === user?.id
                          ? "bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700"
                          : "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            entry.rank === 1
                              ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white"
                              : entry.rank === 2
                                ? "bg-gradient-to-br from-gray-300 to-gray-500 text-white"
                                : entry.rank === 3
                                  ? "bg-gradient-to-br from-amber-600 to-amber-800 text-white"
                                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {entry.rank}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {entry.display_name || entry.username}
                            </span>
                            {entry.user_id === user?.id && (
                              <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            @{entry.username}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-bold text-foreground">
                          {formatValue(selectedMetric, entry.value)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {getMetricLabel(selectedMetric)}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* View More Button */}
              {leaderboard.length > 10 && (
                <button className="w-full mt-4 py-3 text-center text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg font-medium transition-all">
                  View Full Leaderboard ({leaderboard.length} users)
                </button>
              )}
            </motion.div>

            {/* All-Time Stats (only show when period is "all") */}
            {period === "all" && stats?.longest_streak !== undefined && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-6">
                  <div className="text-center mb-3">
                    <span className="text-indigo-900 dark:text-indigo-300 text-lg font-medium">
                      Longest Streak
                    </span>
                  </div>
                  <div className="text-5xl font-bold text-indigo-900 dark:text-indigo-100 text-center">
                    {stats.longest_streak}
                    <span className="text-2xl ml-2">days</span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 border border-pink-200 dark:border-pink-800 rounded-xl p-6">
                  <div className="text-center mb-3">
                    <span className="text-pink-900 dark:text-pink-300 text-lg font-medium">
                      Last Study Date
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-pink-900 dark:text-pink-100 text-center">
                    {stats.last_study_date
                      ? new Date(stats.last_study_date).toLocaleDateString(
                          "en-US",
                          {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          },
                        )
                      : "Never"}
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
