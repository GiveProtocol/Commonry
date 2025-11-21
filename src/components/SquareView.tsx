import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Users, TrendingUp, ExternalLink } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  getLatestTopics,
  getForumStats,
  getTopicUrl,
  type DiscourseTopic,
} from "../services/discourse-api";

interface SquareViewProps {
  onBack: () => void;
}

const DISCOURSE_URL = import.meta.env.VITE_DISCOURSE_URL || 'https://forum.commonry.app';

export function SquareView({ onBack }: SquareViewProps) {
  const { token } = useAuth();
  const [topics, setTopics] = useState<DiscourseTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<{
    topicCount: number;
    postCount: number;
    userCount: number;
    activeUsers: number;
  } | null>(null);

  useEffect(() => {
    const loadForumData = async () => {
      setIsLoading(true);
      try {
        const [latestTopics, forumStats] = await Promise.all([
          getLatestTopics(6),
          getForumStats(),
        ]);
        setTopics(latestTopics);
        setStats(forumStats);
      } catch (error) {
        console.error("Failed to load forum data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadForumData();
  }, []);

  const handleVisitForum = useCallback(async () => {
    if (token) {
      try {
        // Step 1: Establish session with backend by calling prepare-sso endpoint
        const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const response = await fetch(`${apiBaseUrl}/api/discourse/prepare-sso`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include' // Important: include cookies in request
        });

        if (!response.ok) {
          console.error('Failed to prepare SSO session');
          // Fall back to opening Discourse directly
          window.open(DISCOURSE_URL, '_blank');
          return;
        }

        // Step 2: Redirect to Discourse forum
        // Discourse will detect user is not logged in and redirect to our SSO endpoint
        window.location.href = DISCOURSE_URL;
      } catch (error) {
        console.error('Error preparing SSO:', error);
        // Fall back to opening Discourse directly
        window.open(DISCOURSE_URL, '_blank');
      }
    } else {
      // If not logged in, just open Discourse (they'll need to create account there)
      window.open(DISCOURSE_URL, '_blank');
    }
  }, [token]);

  const handleBackClick = useCallback(() => {
    onBack();
  }, [onBack]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-terminal-base dark:bg-dark min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={handleBackClick}
          className="mb-8 flex items-center gap-2 text-terminal-muted dark:text-text-muted hover:terminal-primary dark:hover:text-cyan transition-colors border border-terminal-primary/30 dark:border-cyan/30 rounded px-4 py-2 font-mono hover:shadow-terminal-glow dark:hover:shadow-cyan-glow"
        >
          ← ./back
        </button>

        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold terminal-primary dark:text-cyan mb-4 font-mono text-shadow-terminal dark:[text-shadow:0_0_20px_rgba(0,217,255,0.5)]">
            THE SQUARE
          </h1>
          <p className="text-terminal-muted dark:text-text-muted font-mono text-lg mb-2">
            $ ./community --engage
          </p>
          <p className="text-terminal-base dark:text-text-primary max-w-2xl mx-auto">
            Join the Commonry community forum to discuss learning strategies,
            share knowledge, and connect with fellow lifelong learners.
          </p>
        </motion.div>

        {/* Primary CTA */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <div className="bg-terminal-surface dark:bg-dark-surface border-2 border-terminal-primary dark:border-cyan rounded-lg p-8 text-center shadow-terminal-glow dark:shadow-[0_0_30px_rgba(0,217,255,0.3)]">
            <div className="flex items-center justify-center gap-3 mb-6">
              <MessageCircle className="w-12 h-12 terminal-primary dark:text-cyan" />
              <h2 className="text-3xl font-bold terminal-primary dark:text-cyan font-mono">
                Join the Discussion
              </h2>
            </div>
            <p className="text-terminal-muted dark:text-text-muted mb-6 max-w-xl mx-auto">
              Access the full Commonry forum powered by Discourse. Your account
              syncs automatically—just click to get started.
            </p>
            <button
              onClick={handleVisitForum}
              className="bg-terminal-primary dark:bg-cyan hover:bg-terminal-primary/90 dark:hover:bg-cyan-dark text-paper dark:text-dark py-4 px-8 rounded border border-terminal-primary dark:border-cyan font-mono font-bold text-lg transition-all shadow-terminal-glow dark:shadow-cyan-glow hover:scale-105 inline-flex items-center gap-2"
            >
              ./enter-forum
              <ExternalLink className="w-5 h-5" />
            </button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          <div className="bg-terminal-surface dark:bg-dark-surface border border-terminal-primary/30 dark:border-cyan/30 rounded-lg p-6 text-center hover:border-terminal-primary dark:hover:border-cyan hover:shadow-terminal-glow dark:hover:shadow-cyan-glow transition-all">
            <MessageCircle className="w-10 h-10 terminal-accent dark:text-amber mx-auto mb-3" />
            <p className="text-2xl font-bold terminal-primary dark:text-cyan font-mono">
              {stats?.topicCount.toLocaleString() || '—'}
            </p>
            <p className="text-terminal-muted dark:text-text-muted font-mono text-sm">
              Topics
            </p>
          </div>

          <div className="bg-terminal-surface dark:bg-dark-surface border border-terminal-primary/30 dark:border-cyan/30 rounded-lg p-6 text-center hover:border-terminal-primary dark:hover:border-cyan hover:shadow-terminal-glow dark:hover:shadow-cyan-glow transition-all">
            <Users className="w-10 h-10 terminal-accent dark:text-amber mx-auto mb-3" />
            <p className="text-2xl font-bold terminal-primary dark:text-cyan font-mono">
              {stats?.userCount.toLocaleString() || '—'}
            </p>
            <p className="text-terminal-muted dark:text-text-muted font-mono text-sm">
              Members
            </p>
          </div>

          <div className="bg-terminal-surface dark:bg-dark-surface border border-terminal-primary/30 dark:border-cyan/30 rounded-lg p-6 text-center hover:border-terminal-primary dark:hover:border-cyan hover:shadow-terminal-glow dark:hover:shadow-cyan-glow transition-all">
            <TrendingUp className="w-10 h-10 terminal-accent dark:text-amber mx-auto mb-3" />
            <p className="text-2xl font-bold terminal-primary dark:text-cyan font-mono">
              {stats?.postCount.toLocaleString() || '—'}
            </p>
            <p className="text-terminal-muted dark:text-text-muted font-mono text-sm">
              Posts
            </p>
          </div>
        </motion.div>

        {/* Recent Topics */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-2xl font-bold terminal-primary dark:text-cyan mb-6 font-mono flex items-center gap-3">
            <span className="text-terminal-muted dark:text-text-muted">$</span>
            recent_topics.list()
          </h2>

          {isLoading ? (
            <div className="text-center py-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 border-2 border-terminal-primary dark:border-cyan border-t-transparent rounded-full mx-auto mb-4"
              />
              <p className="text-terminal-muted dark:text-text-muted font-mono">
                Loading forum activity...
              </p>
            </div>
          ) : topics.length === 0 ? (
            <div className="bg-terminal-surface dark:bg-dark-surface border border-terminal-muted dark:border-dark-border rounded-lg p-8 text-center">
              <p className="text-terminal-muted dark:text-text-muted font-mono">
                No recent topics found. Be the first to start a discussion!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topics.map((topic) => (
                <motion.a
                  key={topic.id}
                  href={getTopicUrl(topic.id, topic.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-terminal-surface dark:bg-dark-surface border border-terminal-muted dark:border-dark-border rounded-lg p-5 hover:border-terminal-primary dark:hover:border-cyan hover:shadow-terminal-glow dark:hover:shadow-cyan-glow transition-all group"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <MessageCircle className="w-5 h-5 terminal-primary dark:text-cyan flex-shrink-0 mt-1" />
                    <h3 className="text-terminal-base dark:text-text-primary font-medium leading-tight group-hover:terminal-primary dark:group-hover:text-cyan transition-colors line-clamp-2">
                      {topic.title}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between text-sm font-mono">
                    <div className="flex items-center gap-4 text-terminal-muted dark:text-text-muted">
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" />
                        {topic.posts_count}
                      </span>
                      <span>👁 {topic.views}</span>
                    </div>
                    <span className="text-terminal-muted dark:text-text-muted">
                      {formatTimeAgo(topic.last_posted_at)}
                    </span>
                  </div>
                </motion.a>
              ))}
            </div>
          )}
        </motion.div>

        {/* View All Link */}
        {topics.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 text-center"
          >
            <a
              href={DISCOURSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-terminal-primary dark:text-cyan hover:text-shadow-terminal dark:hover:[text-shadow:0_0_10px_#00d9ff] font-mono transition-all"
            >
              View all topics on the forum
              <ExternalLink className="w-4 h-4" />
            </a>
          </motion.div>
        )}
      </div>
    </div>
  );
}
