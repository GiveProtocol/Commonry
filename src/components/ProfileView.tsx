import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import {
  api,
  UserProfile,
  ProfileStatistics,
  UserAchievement,
} from "../services/api";
import { CommandHistory } from "./CommandHistory";

interface ProfileViewProps {
  onBack: () => void;
}

export function ProfileView({ onBack }: ProfileViewProps) {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<ProfileStatistics | null>(null);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.username) return;

      setLoading(true);
      setError(null);

      const response = await api.getProfile(user.username);

      if (response.error) {
        setError(response.error);
        setLoading(false);
        return;
      }

      if (response.data) {
        console.log("Profile data received:", response.data);
        setProfile(response.data.profile);
      }

      // Fetch statistics
      const statsResponse = await api.getProfileStats(user.username);
      if (statsResponse.data) {
        console.log("Stats data received:", statsResponse.data);
        setStats(statsResponse.data.stats);
      }

      // Fetch achievements
      const achievementsResponse = await api.getUserAchievements(user.username);
      if (achievementsResponse.data) {
        console.log("Achievements data received:", achievementsResponse.data);
        setAchievements(achievementsResponse.data.achievements);
      }

      setLoading(false);
    };

    fetchProfile();
  }, [user?.username]);

  const handleLogout = () => {
    logout();
    onBack();
  };

  const formatMemberSince = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1 px-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading profile...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center flex-1 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-8 shadow-xl max-w-md w-full text-center"
        >
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Unable to Load Profile
          </h2>
          <p className="text-muted-foreground mb-6">
            {error || "Profile not found"}
          </p>
          <button
            onClick={onBack}
            className="bg-primary hover:bg-primary/90 text-primary-foreground py-3 px-6 rounded-lg transition-all"
          >
            Back to Home
          </button>
        </motion.div>
      </div>
    );
  }

  console.log("Rendering profile:", profile);

  return (
    <div className="flex-1 px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
        >
          {/* Header Section */}
          <div className="bg-gradient-to-br from-cyan/10 to-cyan-dark/10 px-8 py-6 border-b border-border">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.displayName}
                    className="w-24 h-24 rounded-full border-4 border-white dark:border-gray-800 shadow-lg"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-cyan/20 border-4 border-white dark:border-dark-border shadow-lg flex items-center justify-center">
                    <span className="text-4xl font-bold text-cyan">
                      {profile.displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-bold text-foreground mb-1">
                  {profile.displayName}
                </h1>
                <p className="text-muted-foreground mb-2">
                  @{profile.username}
                </p>
                {profile.pronouns && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {profile.pronouns}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {profile.location && (
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      {profile.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Member since {formatMemberSince(profile.memberSince)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bio Section */}
          {profile.bio && (
            <div className="px-8 py-6 border-b border-border">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Bio
              </h2>
              <p className="text-foreground leading-relaxed">{profile.bio}</p>
            </div>
          )}

          {/* Learning Topics Section */}
          {profile.learningTopics && profile.learningTopics.length > 0 && (
            <div className="px-8 py-6 border-b border-border">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Learning Topics
              </h2>
              <div className="flex flex-wrap gap-2">
                {profile.learningTopics.map((topic) => (
                  <span
                    key={topic}
                    className="px-3 py-1.5 bg-cyan/10 text-cyan rounded-full text-sm font-medium border border-cyan/20"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Statistics Section */}
          {stats && (
            <div className="px-8 py-6 border-b border-border">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Study Statistics
              </h2>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {/* Current Streak */}
                <div className="bg-gradient-to-br from-amber/20 to-amber-dark/20 border border-amber/30 rounded-xl p-4 hover:shadow-lg hover:shadow-amber-glow transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🔥</span>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Streak
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-amber">
                    {stats.currentStreak}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {stats.currentStreak === 1 ? "day" : "days"} strong
                  </div>
                </div>

                {/* Cards Reviewed */}
                <div className="bg-gradient-to-br from-cyan/20 to-cyan-dark/20 border border-cyan/30 rounded-xl p-4 hover:shadow-lg hover:shadow-cyan-glow transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">📚</span>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Reviewed
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-cyan">
                    {stats.totalCardsReviewed}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    cards total
                  </div>
                </div>

                {/* Cards Mastered */}
                <div className="bg-gradient-to-br from-cyan/20 to-cyan-dark/20 border border-cyan/30 rounded-xl p-4 hover:shadow-lg hover:shadow-cyan-glow transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">⭐</span>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Mastered
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-cyan">
                    {stats.totalCardsMastered}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    cards learned
                  </div>
                </div>

                {/* Study Days */}
                <div className="bg-gradient-to-br from-amber/20 to-amber-dark/20 border border-amber/30 rounded-xl p-4 hover:shadow-lg hover:shadow-amber-glow transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">📅</span>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Active Days
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-amber">
                    {stats.totalStudyDays}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {stats.totalStudyDays === 1 ? "day" : "days"} learning
                  </div>
                </div>
              </div>

              {/* Additional Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Study Time */}
                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                  <div className="text-sm text-muted-foreground mb-1">
                    Total Study Time
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    {Math.floor(stats.totalStudyTimeMs / 60000)} min
                  </div>
                </div>

                {/* Longest Streak */}
                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                  <div className="text-sm text-muted-foreground mb-1">
                    Longest Streak
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    {stats.longestStreak}{" "}
                    {stats.longestStreak === 1 ? "day" : "days"}
                  </div>
                </div>

                {/* Active Decks */}
                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                  <div className="text-sm text-muted-foreground mb-1">
                    Active Decks
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    {stats.activeDecksCount}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Achievements Section */}
          {achievements.length > 0 && (
            <div className="px-8 py-6 border-b border-border">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Achievements & Badges
              </h2>

              {/* Unlocked Achievements */}
              {achievements.filter((a) => a.unlocked).length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-medium text-muted-foreground mb-3">
                    Unlocked ({achievements.filter((a) => a.unlocked).length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {achievements
                      .filter((a) => a.unlocked)
                      .map((achievement) => (
                        <motion.div
                          key={achievement.userAchievementId}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`
                            relative overflow-hidden rounded-lg p-4 border-2
                            ${achievement.rarity === "legendary" ? "bg-gradient-to-br from-cyan/30 to-amber/30 border-cyan/50 shadow-lg shadow-cyan-glow" : ""}
                            ${achievement.rarity === "epic" ? "bg-gradient-to-br from-amber/20 to-amber-dark/20 border-amber/40 shadow-md shadow-amber-glow" : ""}
                            ${achievement.rarity === "rare" ? "bg-gradient-to-br from-cyan/20 to-cyan-dark/20 border-cyan/40" : ""}
                            ${achievement.rarity === "common" ? "bg-card border-border" : ""}
                          `}
                        >
                          <div className="flex items-start gap-3">
                            <div className="text-3xl flex-shrink-0">
                              {achievement.badgeIcon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-foreground">
                                  {achievement.name}
                                </h4>
                                {achievement.rarity !== "common" && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-xs uppercase tracking-wide">
                                    {achievement.rarity}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {achievement.description}
                              </p>
                              {achievement.unlockedAt && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Unlocked{" "}
                                  {new Date(
                                    achievement.unlockedAt,
                                  ).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                  </div>
                </div>
              )}

              {/* In Progress Achievements */}
              {achievements.filter((a) => !a.unlocked).length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-3">
                    In Progress (
                    {achievements.filter((a) => !a.unlocked).length})
                  </h3>
                  <div className="space-y-3">
                    {achievements
                      .filter((a) => !a.unlocked)
                      .map((achievement) => {
                        const progressPercent =
                          (achievement.progress / achievement.target) * 100;
                        return (
                          <div
                            key={achievement.userAchievementId}
                            className="bg-muted/30 border border-border rounded-lg p-4"
                          >
                            <div className="flex items-start gap-3 mb-3">
                              <div className="text-2xl flex-shrink-0 opacity-50">
                                {achievement.badgeIcon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-foreground mb-1">
                                  {achievement.name}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {achievement.description}
                                </p>
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  Progress: {achievement.progress} /{" "}
                                  {achievement.target}
                                </span>
                                <span className="font-semibold text-foreground">
                                  {Math.round(progressPercent)}%
                                </span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progressPercent}%` }}
                                  transition={{
                                    duration: 0.5,
                                    ease: "easeOut",
                                  }}
                                  className={`h-full rounded-full ${
                                    progressPercent >= 75
                                      ? "bg-gradient-to-r from-cyan to-cyan-dark shadow-sm shadow-cyan-glow"
                                      : progressPercent >= 50
                                        ? "bg-cyan"
                                        : progressPercent >= 25
                                          ? "bg-amber"
                                          : "bg-muted-foreground"
                                  }`}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Command History Section */}
          <div className="px-8 py-6 border-b border-border">
            <CommandHistory maxVisible={10} showSearch={true} />
          </div>

          {/* Actions Section */}
          <div className="px-8 py-6 bg-muted/30">
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onBack}
                className="flex-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground py-3 px-6 rounded-lg transition-all font-medium"
              >
                Back to Home
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-lg transition-all font-medium"
              >
                Sign Out
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
