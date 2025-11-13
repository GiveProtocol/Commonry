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
  const [period, _setPeriod] = useState<TimePeriod>("today");
  const [stats, setStats] = useState<UserStatistics | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedMetric, _setSelectedMetric] =
    useState<LeaderboardMetric>("total_cards");
  const [userRank, setUserRank] = useState<{
    rank: number | null;
    value: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    loadStatistics();
  }, [period]);

  useEffect(() => {
    loadLeaderboard();
  }, [selectedMetric]);

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
    <div className="bg-dark min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-8 border-b-2 border-cyan shadow-[0_2px_20px_rgba(0,217,255,0.3)]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-text-muted hover:text-cyan transition-colors font-mono hover:shadow-cyan-glow"
        >
          ← ./back
        </button>

        <h1 className="text-2xl font-bold text-cyan font-mono [text-shadow:0_0_15px_rgba(0,217,255,0.5)]">
          [STATISTICS]
        </h1>

        <div />
      </div>

      <div className="p-8 max-w-7xl mx-auto">
        {/* Period Selector */}
        <div className="flex gap-2 mb-8 bg-dark-surface border border-cyan/30 rounded-lg p-1 max-w-md mx-auto">
          {(["today", "week", "month", "all"] as TimePeriod[]).map((p) => (
            <button
              key={p}
              onClick={clickHandlers[p]}
              className={`flex-1 py-2 px-4 rounded-md font-medium font-mono transition-all ${
                period === p
                  ? "bg-cyan text-dark shadow-cyan-glow border border-cyan"
                  : "text-text-muted hover:text-cyan hover:shadow-cyan-glow"
              }`}
            >
              {getPeriodLabel(p)}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 border-2 border-cyan border-t-transparent rounded-full mx-auto mb-4"
              />
              <p className="text-text-muted font-mono text-sm">
                Loading stats...
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Personal Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-dark-surface border-2 border-cyan/30 hover:border-cyan rounded-lg p-6 hover:shadow-cyan-glow transition-all"
              >
                <div className="flex flex-col items-center mb-3">
                  <img
                    src="/icons/target_white.png"
                    alt="Target"
                    className="w-12 h-12 mb-2 dark:hidden"
                  />
                  <img
                    src="/icons/target_black.png"
                    alt="Target"
                    className="w-12 h-12 mb-2 hidden dark:block"
                  />
                  <span className="text-cyan text-sm font-medium font-mono">
                    {period === "all" ? "Total Cards" : "Cards Studied"}
                  </span>
                </div>
                <div className="text-4xl font-bold text-cyan text-center font-mono">
                  {cardsStudied}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-dark-surface border-2 border-amber/30 hover:border-amber rounded-lg p-6 hover:shadow-amber-glow transition-all"
              >
                <div className="flex flex-col items-center mb-3">
                  <img
                    src="/icons/sundial_white.png"
                    alt="Sundial"
                    className="w-12 h-12 mb-2 dark:hidden"
                  />
                  <img
                    src="/icons/sundial_black.png"
                    alt="Sundial"
                    className="w-12 h-12 mb-2 hidden dark:block"
                  />
                  <span className="text-amber text-sm font-medium font-mono">
                    Time Spent
                  </span>
                </div>
                <div className="text-4xl font-bold text-amber text-center font-mono">
                  {formatTime(timeSpent)}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-dark-surface border-2 border-cyan/30 hover:border-cyan rounded-lg p-6 hover:shadow-cyan-glow transition-all"
              >
                <div className="flex flex-col items-center mb-3">
                  <img
                    src="/icons/chart_white.png"
                    alt="Chart"
                    className="w-12 h-12 mb-2 dark:hidden"
                  />
                  <img
                    src="/icons/chart_black.png"
                    alt="Chart"
                    className="w-12 h-12 mb-2 hidden dark:block"
                  />
                  <span className="text-cyan text-sm font-medium font-mono">
                    Retention Rate
                  </span>
                </div>
                <div className="text-4xl font-bold text-cyan text-center font-mono">
                  {retentionRate.toFixed(1)}%
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-dark-surface border-2 border-amber/30 hover:border-amber rounded-lg p-6 hover:shadow-amber-glow transition-all"
              >
                <div className="flex flex-col items-center mb-3">
                  <img
                    src="/icons/fire_white.png"
                    alt="Fire"
                    className="w-12 h-12 mb-2 dark:hidden"
                  />
                  <img
                    src="/icons/fire_black.png"
                    alt="Fire"
                    className="w-12 h-12 mb-2 hidden dark:block"
                  />
                  <span className="text-amber text-sm font-medium font-mono">
                    Current Streak
                  </span>
                </div>
                <div className="text-4xl font-bold text-amber text-center font-mono">
                  {currentStreak}
                  <span className="text-lg ml-1">days</span>
                </div>
              </motion.div>
            </div>

            {/* Leaderboard Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-dark-surface border-2 border-amber rounded-lg p-6 shadow-[0_0_30px_rgba(251,191,36,0.2)]"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-amber font-mono [text-shadow:0_0_15px_rgba(251,191,36,0.5)]">
                    [LEADERBOARD]
                  </h2>
                </div>

                {/* User Rank Badge */}
                {userRank?.rank && (
                  <div className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-4 py-2">
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
              <div className="flex gap-2 mb-6 bg-dark border border-cyan/30 rounded-lg p-1 overflow-x-auto">
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
                    onClick={handleMetricClick(metric)}
                    className={`py-2 px-4 rounded-md font-medium font-mono whitespace-nowrap transition-all ${
                      selectedMetric === metric
                        ? "bg-cyan text-dark shadow-cyan-glow border border-cyan"
                        : "text-text-muted hover:text-cyan"
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
                          ? "bg-cyan-50 dark:bg-cyan-900/20 border-2 border-cyan-300 dark:border-cyan-700"
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
                              <span className="text-xs bg-cyan-600 text-white px-2 py-0.5 rounded-full">
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
                <button className="w-full mt-4 py-3 text-center text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg font-medium transition-all">
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
                <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20 border border-cyan-200 dark:border-cyan-800 rounded-xl p-6">
                  <div className="text-center mb-3">
                    <span className="text-cyan-900 dark:text-cyan-300 text-lg font-medium">
                      Longest Streak
                    </span>
                  </div>
                  <div className="text-5xl font-bold text-cyan-900 dark:text-cyan-100 text-center">
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
