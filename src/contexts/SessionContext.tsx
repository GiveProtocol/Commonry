/**
 * Session Context Provider
 *
 * Manages study session lifecycle on the client:
 * - Session start/complete
 * - Heartbeat mechanism (30-second intervals)
 * - Break tracking (visibility change, manual pause)
 * - Tab visibility handling
 * - Browser close handling (beforeunload + sendBeacon)
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { api } from "../services/api";
import { IdService } from "../services/id-service";
import { reviewEventCapture } from "../services/review-event-capture";
import { useAuth } from "./AuthContext";
import type {
  SessionBreak,
  ClientSessionState,
  StartSessionPayload,
  CompleteSessionPayload,
  SessionStatistics,
  SessionConfig,
  SessionStats,
} from "../types/study-sessions";
import type { StudySessionId } from "../types/ids";

// ============================================================
// CONSTANTS
// ============================================================

const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
const CLIENT_VERSION = "1.0.0";
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// ============================================================
// CONTEXT TYPES
// ============================================================

interface SessionContextType {
  // State
  session: ClientSessionState | null;
  isSessionActive: boolean;
  isPaused: boolean;

  // Actions
  startSession: (config: SessionConfig) => Promise<StudySessionId | null>;
  endSession: (wasInterrupted?: boolean) => Promise<SessionStatistics | null>;
  pauseSession: () => void;
  resumeSession: () => void;

  // Card tracking
  recordCardCompleted: (
    rating: 1 | 2 | 3 | 4,
    responseTimeMs: number,
    isNewCard: boolean,
  ) => void;

  // Getters
  getSessionId: () => StudySessionId | null;
  getSessionStats: () => SessionStats;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function detectDeviceType(): "mobile" | "tablet" | "desktop" | "unknown" {
  const width = window.innerWidth;
  const userAgent = navigator.userAgent.toLowerCase();

  if (
    /mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
  ) {
    return "mobile";
  }
  if (/ipad|tablet|playbook|silk/i.test(userAgent)) {
    return "tablet";
  }
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function detectPlatform(): string {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("electron")) return "electron";
  if (/iphone|ipad|ipod/.test(userAgent)) return "ios";
  if (userAgent.includes("android")) return "android";
  return "web";
}

function getTimeContext() {
  const now = new Date();
  return {
    localHour: now.getHours(),
    localDayOfWeek: now.getDay(),
    timezoneOffsetMinutes: -now.getTimezoneOffset(),
  };
}

function createInitialSessionState(
  sessionId: StudySessionId,
): ClientSessionState {
  const now = Date.now();
  return {
    sessionId,
    startedAt: now,
    cardsCompleted: 0,
    cardsCorrect: 0,
    cardsByRating: { again: 0, hard: 0, good: 0, easy: 0 },
    newCardsCompleted: 0,
    reviewCardsCompleted: 0,
    responseTimes: [],
    totalActiveTimeMs: 0,
    lastCardCompletedAt: now,
    breaks: [],
    currentBreak: null,
    totalBreakTimeMs: 0,
    isActive: true,
    isPaused: false,
    isBackgrounded: false,
    lastHeartbeatSentAt: now,
  };
}

// ============================================================
// PROVIDER COMPONENT
// ============================================================

export function SessionProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [session, setSession] = useState<ClientSessionState | null>(null);

  // Refs for intervals and cleanup
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const sessionRef = useRef<ClientSessionState | null>(null);

  // Keep sessionRef in sync
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // ============================================================
  // HEARTBEAT
  // ============================================================

  const sendHeartbeat = useCallback(async () => {
    if (!sessionRef.current?.isActive) return;

    const now = Date.now();

    try {
      await api.sendSessionHeartbeat(sessionRef.current.sessionId, {
        isBackgrounded: sessionRef.current.isBackgrounded,
      });

      setSession((prev) =>
        prev
          ? {
              ...prev,
              lastHeartbeatSentAt: now,
            }
          : null,
      );
    } catch (error) {
      console.warn("[SessionContext] Heartbeat failed:", error);
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) return;

    heartbeatIntervalRef.current = setInterval(
      sendHeartbeat,
      HEARTBEAT_INTERVAL_MS,
    );
    sendHeartbeat(); // Send immediately
  }, [sendHeartbeat]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // ============================================================
  // VISIBILITY HANDLING
  // ============================================================

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!sessionRef.current?.isActive) return;

      const now = Date.now();

      if (document.hidden) {
        // Going to background - start a break
        setSession((prev) => {
          if (!prev) return null;

          const breakStart: SessionBreak = {
            startMs: now - prev.startedAt,
            endMs: null,
            reason: "background",
          };

          return {
            ...prev,
            isBackgrounded: true,
            currentBreak: breakStart,
          };
        });
      } else {
        // Coming back - end the break
        setSession((prev) => {
          if (!prev?.currentBreak) return prev;

          const breakEnd = now - prev.startedAt;
          const breakDuration = prev.currentBreak.startMs
            ? breakEnd - prev.currentBreak.startMs
            : 0;

          const completedBreak: SessionBreak = {
            ...prev.currentBreak,
            endMs: breakEnd,
          };

          return {
            ...prev,
            isBackgrounded: false,
            currentBreak: null,
            breaks: [...prev.breaks, completedBreak],
            totalBreakTimeMs: prev.totalBreakTimeMs + breakDuration,
          };
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // ============================================================
  // BEFOREUNLOAD HANDLING
  // ============================================================

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!sessionRef.current?.isActive) return;

      // Use sendBeacon for reliable delivery
      const beaconUrl = `${API_BASE_URL}/api/sessions/${sessionRef.current.sessionId}/beacon`;

      // Note: sendBeacon doesn't support custom headers for auth tokens
      const data = JSON.stringify({
        finalState: "interrupted",
        totalActiveTimeMs:
          Date.now() -
          sessionRef.current.startedAt -
          sessionRef.current.totalBreakTimeMs,
      });

      // Create a blob with headers for sendBeacon
      const blob = new Blob([data], { type: "application/json" });

      // Note: sendBeacon doesn't support custom headers, so we'll need the server
      // to handle unauthenticated beacon requests or use a different approach
      navigator.sendBeacon(beaconUrl, blob);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // ============================================================
  // SESSION LIFECYCLE
  // ============================================================

  const startSession = useCallback(
    async (config: SessionConfig): Promise<StudySessionId | null> => {
      if (!isAuthenticated) return null;

      // End any existing session
      if (session?.isActive) {
        await endSession(true);
      }

      const sessionId = IdService.generateStudySessionId();
      const timeContext = getTimeContext();

      const payload: StartSessionPayload = {
        sessionId,
        sessionType: config.sessionType,
        deckId: config.deckId,
        cardsPlanned: config.cardsPlanned,
        targetDurationMinutes: config.targetDurationMinutes,
        deviceType: detectDeviceType(),
        clientVersion: CLIENT_VERSION,
        platform: detectPlatform(),
        userAgent: navigator.userAgent,
        ...timeContext,
      };

      try {
        const response = await api.startStudySession(payload);

        if (response.data?.success) {
          const newSession = createInitialSessionState(sessionId);
          setSession(newSession);
          startHeartbeat();

          // Sync session ID with review event capture service
          // This ensures review events are linked to the correct session
          reviewEventCapture.setSessionId(sessionId);

          return sessionId;
        }
      } catch (error) {
        console.error("[SessionContext] Failed to start session:", error);
      }

      return null;
    },
    [isAuthenticated, session, startHeartbeat],
  );

  const endSession = useCallback(
    async (wasInterrupted = false): Promise<SessionStatistics | null> => {
      if (!session?.isActive) return null;

      stopHeartbeat();

      const now = Date.now();
      const totalActiveTimeMs =
        now - session.startedAt - session.totalBreakTimeMs;

      const payload: CompleteSessionPayload = {
        finalState: wasInterrupted ? "interrupted" : "completed",
        cardsCompleted: session.cardsCompleted,
        cardsCorrect: session.cardsCorrect,
        cardsAgain: session.cardsByRating.again,
        cardsHard: session.cardsByRating.hard,
        cardsGood: session.cardsByRating.good,
        cardsEasy: session.cardsByRating.easy,
        newCardsCompleted: session.newCardsCompleted,
        reviewCardsCompleted: session.reviewCardsCompleted,
        breaks: session.breaks,
        totalBreakTimeMs: session.totalBreakTimeMs,
        totalActiveTimeMs,
        responseTimes: session.responseTimes,
      };

      try {
        const response = await api.completeStudySession(
          session.sessionId,
          payload,
        );

        setSession(null);

        if (response.data?.success) {
          return response.data.statistics;
        }
      } catch (error) {
        console.error("[SessionContext] Failed to end session:", error);
      }

      setSession(null);
      return null;
    },
    [session, stopHeartbeat],
  );

  const pauseSession = useCallback(() => {
    if (!session?.isActive || session?.isPaused) return;

    const now = Date.now();

    setSession((prev) => {
      if (!prev) return null;

      const breakStart: SessionBreak = {
        startMs: now - prev.startedAt,
        endMs: null,
        reason: "pause",
      };

      return {
        ...prev,
        isPaused: true,
        currentBreak: breakStart,
      };
    });

    stopHeartbeat();

    // Notify server of break
    api.recordSessionBreak(session.sessionId, {
      action: "start",
      reason: "pause",
    });
  }, [session, stopHeartbeat]);

  const resumeSession = useCallback(() => {
    if (!session?.isActive || !session?.isPaused) return;

    const now = Date.now();

    setSession((prev) => {
      if (!prev?.currentBreak) return prev;

      const breakEnd = now - prev.startedAt;
      const breakDuration = prev.currentBreak.startMs
        ? breakEnd - prev.currentBreak.startMs
        : 0;

      const completedBreak: SessionBreak = {
        ...prev.currentBreak,
        endMs: breakEnd,
      };

      return {
        ...prev,
        isPaused: false,
        currentBreak: null,
        breaks: [...prev.breaks, completedBreak],
        totalBreakTimeMs: prev.totalBreakTimeMs + breakDuration,
      };
    });

    startHeartbeat();

    // Notify server of break end
    api.recordSessionBreak(session.sessionId, {
      action: "end",
      reason: "pause",
    });
  }, [session, startHeartbeat]);

  // ============================================================
  // CARD TRACKING
  // ============================================================

  const recordCardCompleted = useCallback(
    (rating: 1 | 2 | 3 | 4, responseTimeMs: number, isNewCard: boolean) => {
      if (!session?.isActive) return;

      setSession((prev) => {
        if (!prev) return null;

        const ratingKey = ["again", "hard", "good", "easy"][
          rating - 1
        ] as keyof typeof prev.cardsByRating;

        return {
          ...prev,
          cardsCompleted: prev.cardsCompleted + 1,
          cardsCorrect: prev.cardsCorrect + (rating >= 3 ? 1 : 0),
          cardsByRating: {
            ...prev.cardsByRating,
            [ratingKey]: prev.cardsByRating[ratingKey] + 1,
          },
          newCardsCompleted: prev.newCardsCompleted + (isNewCard ? 1 : 0),
          reviewCardsCompleted: prev.reviewCardsCompleted + (isNewCard ? 0 : 1),
          responseTimes: [...prev.responseTimes, responseTimeMs],
          lastCardCompletedAt: Date.now(),
        };
      });
    },
    [session],
  );

  // ============================================================
  // GETTERS
  // ============================================================

  const getSessionId = useCallback((): StudySessionId | null => {
    return session?.sessionId ?? null;
  }, [session]);

  const getSessionStats = useCallback((): SessionStats => {
    if (!session) {
      return {
        cardsCompleted: 0,
        cardsCorrect: 0,
        accuracy: 0,
        elapsedTimeMs: 0,
        averageResponseTimeMs: 0,
      };
    }

    const elapsedTimeMs =
      Date.now() - session.startedAt - session.totalBreakTimeMs;
    const accuracy =
      session.cardsCompleted > 0
        ? session.cardsCorrect / session.cardsCompleted
        : 0;
    const averageResponseTimeMs =
      session.responseTimes.length > 0
        ? session.responseTimes.reduce((a, b) => a + b, 0) /
          session.responseTimes.length
        : 0;

    return {
      cardsCompleted: session.cardsCompleted,
      cardsCorrect: session.cardsCorrect,
      accuracy,
      elapsedTimeMs,
      averageResponseTimeMs,
    };
  }, [session]);

  // ============================================================
  // CLEANUP
  // ============================================================

  useEffect(() => {
    return () => {
      stopHeartbeat();
    };
  }, [stopHeartbeat]);

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  const value: SessionContextType = {
    session,
    isSessionActive: session?.isActive ?? false,
    isPaused: session?.isPaused ?? false,
    startSession,
    endSession,
    pauseSession,
    resumeSession,
    recordCardCompleted,
    getSessionId,
    getSessionStats,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
