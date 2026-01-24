/**
 * Review Event Capture Service
 *
 * Client-side service for capturing enriched review event data.
 * Handles the full lifecycle: start → interaction → complete
 *
 * Design principles:
 * - Fail gracefully: capture errors should never break the review experience
 * - Capture generously: collect all available signals
 * - Stream when possible: send interaction data as it happens
 * - Queue for resilience: buffer data when offline
 */

import { CardId } from "../types/ids";
import { Card } from "../lib/srs-engine";
import {
  ReviewEventBuilder,
  StartReviewEventPayload,
  CompleteReviewEventPayload,
  InteractionPayload,
  InteractionEvent,
  PrecedingReview,
  ResponseType,
  DeviceType,
  CardState,
  InputMethod,
  Platform,
  StudySession,
} from "../types/review-events";
import { api } from "./api";
import { IdService } from "./id-service";

// ============================================================
// CONSTANTS
// ============================================================

const CLIENT_VERSION = "1.0.0";
const INTERACTION_BATCH_SIZE = 10;
const INTERACTION_FLUSH_INTERVAL_MS = 5000;

// ============================================================
// DEVICE DETECTION
// ============================================================

function detectDeviceType(): DeviceType {
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

function detectInputMethod(): InputMethod {
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const hasFinePointer = window.matchMedia("(pointer: fine)").matches;

  if (hasTouch && !hasFinePointer) return "touch";
  if (hasFinePointer) return "mouse";
  return "keyboard";
}

function detectPlatform(): Platform {
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

// ============================================================
// FSRS RECALL PROBABILITY
// ============================================================

/**
 * Calculate predicted recall probability using FSRS forgetting curve.
 * Formula: P(recall) = e^(-t/S) where t = time elapsed, S = stability
 *
 * For cards without explicit stability, we estimate from interval:
 * At the scheduled review time (t = interval), P should be ~0.9 (FSRS default)
 * So: 0.9 = e^(-interval/S) => S = -interval / ln(0.9) ≈ interval / 0.105
 */
function calculateRecallProbability(card: Card): number | undefined {
  if (!card.lastReview || !card.interval) return undefined;

  const lastReviewMs = new Date(card.lastReview).getTime();
  const elapsedDays = (Date.now() - lastReviewMs) / (1000 * 60 * 60 * 24);

  // Estimate stability from interval (at interval, P ≈ 0.9)
  const stability = card.interval / 0.105;

  // FSRS forgetting curve: P = e^(-t/S)
  const probability = Math.exp(-elapsedDays / stability);

  // Clamp to valid range [0, 1]
  return Math.max(0, Math.min(1, probability));
}

// ============================================================
// SIMILARITY CALCULATION
// ============================================================

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matrix: number[][] = [];
  for (let i = 0; i <= s1.length; i++) matrix[i] = [i];
  for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  const distance = matrix[s1.length][s2.length];
  return 1 - distance / Math.max(s1.length, s2.length);
}

// ============================================================
// STUDY SESSION MANAGER
// ============================================================

export class StudySessionManager {
  private session: StudySession;

  constructor() {
    this.session = this.createNewSession();
  }

  private createNewSession(): StudySession {
    return {
      sessionId: IdService.generateStudySessionId(),
      startedAt: performance.now(),
      reviewCount: 0,
      precedingReviews: [],
    };
  }

  startNewSession(): void {
    this.session = this.createNewSession();
  }

  /**
   * Set an external session ID (from SessionContext).
   * This allows coordination with the new session tracking system.
   */
  setSessionId(sessionId: StudySession["sessionId"]): void {
    this.session.sessionId = sessionId;
    this.session.startedAt = performance.now();
    this.session.reviewCount = 0;
    this.session.precedingReviews = [];
  }

  recordCompletedReview(
    cardId: CardId,
    rating: number,
    durationMs: number,
  ): void {
    this.session.reviewCount++;

    const review: PrecedingReview = {
      cardId,
      rating,
      durationMs,
      wasCorrect: rating >= 3,
    };

    this.session.precedingReviews.unshift(review);
    if (this.session.precedingReviews.length > 5) {
      this.session.precedingReviews.pop();
    }
  }

  getSession(): StudySession {
    return this.session;
  }

  getPositionInSession(): number {
    return this.session.reviewCount + 1;
  }

  getTimeSinceSessionStart(): number {
    return Math.round(performance.now() - this.session.startedAt);
  }

  getPrecedingReviews(): PrecedingReview[] {
    return [...this.session.precedingReviews];
  }
}

// ============================================================
// REVIEW EVENT CAPTURE SERVICE
// ============================================================

interface QueuedCompletion {
  eventId: string;
  payload: CompleteReviewEventPayload;
  retryCount: number;
  queuedAt: number;
}

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_QUEUE_KEY = "commonry_review_retry_queue";

export class ReviewEventCaptureService {
  private currentBuilder: ReviewEventBuilder | null = null;
  private sessionManager: StudySessionManager;
  private interactionBuffer: InteractionEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private isOnline: boolean = navigator.onLine;
  private retryQueue: QueuedCompletion[] = [];

  constructor() {
    this.sessionManager = new StudySessionManager();
    this.loadRetryQueue();
    this.setupEventListeners();
  }

  private loadRetryQueue(): void {
    try {
      const stored = localStorage.getItem(RETRY_QUEUE_KEY);
      if (stored) {
        this.retryQueue = JSON.parse(stored);
      }
    } catch {
      this.retryQueue = [];
    }
  }

  private saveRetryQueue(): void {
    try {
      localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(this.retryQueue));
    } catch {
      // Storage quota exceeded or unavailable
    }
  }

  private queueForRetry(eventId: string, payload: CompleteReviewEventPayload): void {
    this.retryQueue.push({
      eventId,
      payload,
      retryCount: 0,
      queuedAt: Date.now(),
    });
    this.saveRetryQueue();
  }

  private async flushRetryQueue(): Promise<void> {
    if (!this.isOnline || this.retryQueue.length === 0) return;

    const queue = [...this.retryQueue];
    this.retryQueue = [];

    for (const item of queue) {
      if (item.retryCount >= MAX_RETRY_ATTEMPTS) {
        console.warn(`[ReviewEventCapture] Dropping event ${item.eventId} after ${MAX_RETRY_ATTEMPTS} retries`);
        continue;
      }

      try {
        await api.completeReviewEvent(item.eventId, item.payload);
      } catch {
        item.retryCount++;
        this.retryQueue.push(item);
      }
    }

    this.saveRetryQueue();
  }

  private setupEventListeners(): void {
    // Visibility tracking
    document.addEventListener("visibilitychange", () => {
      if (!this.currentBuilder) return;

      const now = performance.now();
      const timestampMs = Math.round(now - this.currentBuilder.cardShownAt);

      if (document.hidden) {
        this.currentBuilder.isInBackground = true;
        this.currentBuilder.backgroundStartedAt = now;
        this.recordInteraction({ type: "background", timestampMs });
      } else {
        if (this.currentBuilder.backgroundStartedAt !== null) {
          const backgroundDuration =
            now - this.currentBuilder.backgroundStartedAt;
          this.currentBuilder.totalBackgroundMs += backgroundDuration;
        }
        this.currentBuilder.isInBackground = false;
        this.currentBuilder.backgroundStartedAt = null;
        this.recordInteraction({ type: "foreground", timestampMs });
      }
    });

    // Online/offline tracking
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.flushInteractionBuffer();
      this.flushRetryQueue();
    });
    window.addEventListener("offline", () => {
      this.isOnline = false;
    });
  }

  // ============================================================
  // SESSION MANAGEMENT
  // ============================================================

  startSession(): void {
    this.sessionManager.startNewSession();
  }

  /**
   * Set an external session ID (from SessionContext).
   * This allows the ReviewEventCaptureService to use the same session ID
   * as the new robust session tracking system.
   */
  setSessionId(sessionId: StudySession["sessionId"]): void {
    this.sessionManager.setSessionId(sessionId);
  }

  getSessionId() {
    return this.sessionManager.getSession().sessionId;
  }

  // ============================================================
  // START REVIEW
  // ============================================================

  async startCardReview(
    card: Card,
    responseType: ResponseType = "self_rating",
  ): Promise<string | null> {
    // Generate event ID
    const eventId = IdService.generateReviewEventId();

    // Capture device context at start
    const deviceContext = {
      deviceType: detectDeviceType(),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      inputMethod: detectInputMethod(),
      platform: detectPlatform(),
      clientVersion: CLIENT_VERSION,
      userAgent: navigator.userAgent,
    };

    const timeContext = getTimeContext();
    const session = this.sessionManager.getSession();

    // Initialize builder
    this.currentBuilder = {
      eventId,
      cardId: card.id,
      deckId: card.deckId,
      sessionId: session.sessionId,
      status: "started",
      cardShownAt: performance.now(),
      firstInteractionAt: null,
      answerShownAt: null,
      ratingSelectedAt: null,
      interactions: [],
      keystrokeCount: 0,
      backspaceCount: 0,
      pasteCount: 0,
      currentResponse: "",
      responseSnapshots: [],
      isInBackground: false,
      backgroundStartedAt: null,
      totalBackgroundMs: 0,
      blurEvents: [],
      optionHovers: new Map(),
      deviceContext,
      timeContext,
    };

    // Build start payload
    const payload: StartReviewEventPayload = {
      eventId,
      cardId: card.id,
      deckId: card.deckId,
      sessionId: session.sessionId,
      clientCreatedAt: new Date().toISOString(),
      ...deviceContext,
      ...timeContext,
      positionInSession: this.sessionManager.getPositionInSession(),
      timeSinceSessionStartMs: this.sessionManager.getTimeSinceSessionStart(),
      precedingReviews: this.sessionManager.getPrecedingReviews(),
      cardStateBefore: card.status as CardState,
      responseType,
      predictedRecallProbability: calculateRecallProbability(card),
      actualIntervalDays: card.lastReview
        ? (Date.now() - new Date(card.lastReview).getTime()) /
          (1000 * 60 * 60 * 24)
        : undefined,
      scheduledIntervalDays: card.interval || undefined,
      overdueDays: undefined, // Calculated server-side
      easeFactorBefore: card.easeFactor,
      intervalBeforeDays: card.interval || undefined,
      repetitionCount: card.repetitions || 0,
      lapseCount: card.lapses || 0,
      frontContentLength:
        (card.front?.length || 0) + (card.frontHtml?.length || 0),
      backContentLength:
        (card.back?.length || 0) + (card.backHtml?.length || 0),
      hasMedia: !!(
        card.frontImage ||
        card.backImage ||
        card.frontAudio ||
        card.backAudio
      ),
      mediaTypes: this.getMediaTypes(card),
      cardTags: [], // Card.tags not yet implemented in schema
    };

    // Send to server (fire and forget - don't block the review)
    try {
      const response = await api.startReviewEvent(payload);
      if (response.data?.success) {
        this.currentBuilder.status = "started";
      }
    } catch (error) {
      console.warn(
        "[ReviewEventCapture] Failed to start event, will complete locally:",
        error,
      );
    }

    return eventId;
  }

  private getMediaTypes(card: Card): string[] {
    const types: string[] = [];
    if (card.frontImage || card.backImage) types.push("image");
    if (card.frontAudio || card.backAudio) types.push("audio");
    return types;
  }

  // ============================================================
  // INTERACTION TRACKING
  // ============================================================

  recordInteraction(event: InteractionEvent): void {
    if (!this.currentBuilder) return;

    this.currentBuilder.interactions.push(event);
    this.interactionBuffer.push(event);

    // Track first interaction
    if (this.currentBuilder.firstInteractionAt === null) {
      this.currentBuilder.firstInteractionAt = performance.now();
    }

    // Flush if buffer is full or set timer
    if (this.interactionBuffer.length >= INTERACTION_BATCH_SIZE) {
      this.flushInteractionBuffer();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushInteractionBuffer();
      }, INTERACTION_FLUSH_INTERVAL_MS);
    }
  }

  recordFirstInteraction(): void {
    if (!this.currentBuilder) return;

    if (this.currentBuilder.firstInteractionAt === null) {
      this.currentBuilder.firstInteractionAt = performance.now();
      const timestampMs = Math.round(
        this.currentBuilder.firstInteractionAt -
          this.currentBuilder.cardShownAt,
      );
      this.recordInteraction({ type: "focus", timestampMs });
    }
  }

  recordKeystroke(key: string): void {
    if (!this.currentBuilder) return;

    this.recordFirstInteraction();
    this.currentBuilder.keystrokeCount++;

    const isBackspace = key === "Backspace" || key === "Delete";
    if (isBackspace) {
      this.currentBuilder.backspaceCount++;
    }

    const timestampMs = Math.round(
      performance.now() - this.currentBuilder.cardShownAt,
    );
    this.recordInteraction({
      type: isBackspace ? "backspace" : "keystroke",
      timestampMs,
      data: { key: isBackspace ? key : undefined },
    });
  }

  recordPaste(): void {
    if (!this.currentBuilder) return;

    this.recordFirstInteraction();
    this.currentBuilder.pasteCount++;

    const timestampMs = Math.round(
      performance.now() - this.currentBuilder.cardShownAt,
    );
    this.recordInteraction({ type: "paste", timestampMs });
  }

  recordAnswerShown(): void {
    if (!this.currentBuilder) return;

    this.currentBuilder.answerShownAt = performance.now();
    const timestampMs = Math.round(
      this.currentBuilder.answerShownAt - this.currentBuilder.cardShownAt,
    );
    this.recordInteraction({ type: "flip", timestampMs });
  }

  updateResponse(response: string): void {
    if (!this.currentBuilder) return;
    this.currentBuilder.currentResponse = response;
  }

  snapshotResponse(): void {
    if (!this.currentBuilder) return;
    this.currentBuilder.responseSnapshots.push(
      this.currentBuilder.currentResponse,
    );
  }

  /**
   * Record hover time on a multiple choice option
   * @param optionIndex - Index of the option being hovered
   * @param durationMs - Duration of the hover in milliseconds
   */
  recordOptionHover(optionIndex: number, durationMs: number): void {
    if (!this.currentBuilder) return;

    const current = this.currentBuilder.optionHovers.get(optionIndex) || 0;
    this.currentBuilder.optionHovers.set(optionIndex, current + durationMs);

    const timestampMs = Math.round(
      performance.now() - this.currentBuilder.cardShownAt,
    );
    this.recordInteraction({
      type: "hover",
      timestampMs,
      data: { optionIndex, durationMs },
    });
  }

  /**
   * Flush buffered interactions to the server
   * Called periodically or when buffer is full
   */
  private async flushInteractionBuffer(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (
      this.interactionBuffer.length === 0 ||
      !this.currentBuilder ||
      !this.isOnline
    ) {
      return;
    }

    const interactions = [...this.interactionBuffer];
    this.interactionBuffer = [];

    const payload: InteractionPayload = {
      interactions,
      timeToFirstInteractionMs: this.currentBuilder.firstInteractionAt
        ? Math.round(
            this.currentBuilder.firstInteractionAt -
              this.currentBuilder.cardShownAt,
          )
        : undefined,
      wasBackgrounded: this.currentBuilder.totalBackgroundMs > 0,
      timeBackgroundedMs: Math.round(this.currentBuilder.totalBackgroundMs),
    };

    try {
      // Use async mode for fire-and-forget
      await api.recordReviewInteraction(
        this.currentBuilder.eventId,
        payload,
        true,
      );
    } catch (error) {
      // Re-add to buffer for retry
      this.interactionBuffer.unshift(...interactions);
      console.warn("[ReviewEventCapture] Failed to flush interactions:", error);
    }
  }

  // ============================================================
  // COMPLETE REVIEW
  // ============================================================

  async completeReview(
    card: Card,
    rating: 1 | 2 | 3 | 4,
    userResponse?: string,
    expectedResponse?: string,
  ): Promise<boolean> {
    if (!this.currentBuilder) {
      console.warn("[ReviewEventCapture] No active review to complete");
      return false;
    }

    const builder = this.currentBuilder;
    const now = performance.now();
    builder.ratingSelectedAt = now;

    // Flush any remaining interactions
    await this.flushInteractionBuffer();

    // Calculate timing
    const totalDurationMs = Math.round(now - builder.cardShownAt);
    const timeToFirstInteractionMs = builder.firstInteractionAt
      ? Math.round(builder.firstInteractionAt - builder.cardShownAt)
      : undefined;
    const timeToAnswerMs =
      builder.answerShownAt && builder.firstInteractionAt
        ? Math.round(builder.answerShownAt - builder.firstInteractionAt)
        : undefined;
    const hesitationBeforeRatingMs = builder.answerShownAt
      ? Math.round(now - builder.answerShownAt)
      : undefined;

    // Calculate background time
    let totalBackgroundMs = builder.totalBackgroundMs;
    if (builder.backgroundStartedAt !== null) {
      totalBackgroundMs += now - builder.backgroundStartedAt;
    }

    // Calculate similarity for typed responses
    let responseSimilarityScore: number | undefined;
    if (userResponse && expectedResponse) {
      responseSimilarityScore = calculateSimilarity(
        userResponse,
        expectedResponse,
      );
    }

    // Build option interactions
    const optionInteractions =
      builder.optionHovers.size > 0
        ? Array.from(builder.optionHovers.entries()).map(
            ([optionIndex, hoverMs]) => ({
              optionIndex,
              hoverMs: Math.round(hoverMs),
            }),
          )
        : undefined;

    // Calculate edit count
    const editCount =
      builder.responseSnapshots.length > 1
        ? builder.responseSnapshots.length - 1
        : undefined;

    // Determine card state after review
    const cardStateAfter = ReviewEventCaptureService.determineStateAfter(card, rating);

    // Build completion payload
    const payload: CompleteReviewEventPayload = {
      rating,
      totalDurationMs,
      timeToFirstInteractionMs,
      timeToAnswerMs,
      hesitationBeforeRatingMs,
      userResponseText: userResponse,
      expectedResponseText: expectedResponse,
      responseSimilarityScore,
      keystrokeCount: builder.keystrokeCount || undefined,
      backspaceCount: builder.backspaceCount || undefined,
      pasteCount: builder.pasteCount || undefined,
      editCount,
      optionInteractions,
      interactionLog: builder.interactions,
      wasBackgrounded: totalBackgroundMs > 0,
      timeBackgroundedMs: Math.round(totalBackgroundMs) || undefined,
      cardStateAfter,
      easeFactorAfter: ReviewEventCaptureService.calculateNewEaseFactor(card.easeFactor, rating),
      intervalAfterDays: ReviewEventCaptureService.calculateNewInterval(card, rating),
    };

    // Record in session manager
    this.sessionManager.recordCompletedReview(
      builder.cardId,
      rating,
      totalDurationMs,
    );

    // Clear current builder
    this.currentBuilder = null;

    // Send to server
    try {
      const response = await api.completeReviewEvent(builder.eventId, payload);
      return response.data?.success ?? false;
    } catch (error) {
      console.error(
        "[ReviewEventCapture] Failed to complete review event, queuing for retry:",
        error,
      );
      this.queueForRetry(builder.eventId, payload);
      return false;
    }
  }

  /**
   * Determine the card state after a review based on rating
   * @param card - The card being reviewed
   * @param rating - User rating (1-4)
   * @returns New card state
   */
  private static determineStateAfter(card: Card, rating: number): CardState {
    if (rating === 1) return "relearning";
    if (card.status === "new" || card.status === "learning") {
      return rating >= 3 ? "review" : "learning";
    }
    return "review";
  }

  /**
   * Calculate new ease factor after a review using SM-2 adjustments
   * @param currentEase - Current ease factor
   * @param rating - User rating (1-4)
   * @returns Adjusted ease factor (minimum 1.3)
   */
  private static calculateNewEaseFactor(currentEase: number, rating: number): number {
    const MIN_EASE = 1.3;
    const adjustments = [0, -0.2, -0.15, 0, 0.15];
    return Math.max(MIN_EASE, currentEase + (adjustments[rating] || 0));
  }

  /**
   * Calculate new interval after a review using SM-2 algorithm
   * @param card - The card being reviewed
   * @param rating - User rating (1-4)
   * @returns New interval in days
   */
  private static calculateNewInterval(card: Card, rating: number): number {
    if (rating === 1) return 1;
    if (card.status === "new" || card.status === "learning") {
      return rating === 4 ? 4 : 1;
    }
    if (card.repetitions === 0) return 1;
    if (card.repetitions === 1) return 6;

    let newInterval = card.interval * card.easeFactor;
    if (rating === 2) newInterval *= 0.8;
    if (rating === 4) newInterval *= 1.3;

    return Math.round(newInterval);
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  /**
   * Cancel the current review without completing it
   */
  cancelReview(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.interactionBuffer = [];
    this.currentBuilder = null;
  }

  /**
   * Check if there's an active review in progress
   */
  hasActiveReview(): boolean {
    return this.currentBuilder !== null;
  }

  /**
   * Get the current event ID if there's an active review
   */
  getCurrentEventId(): string | null {
    return this.currentBuilder?.eventId ?? null;
  }
}

// Export singleton instance
export const reviewEventCapture = new ReviewEventCaptureService();
