/**
 * Review Events - Type definitions for the capture pipeline
 *
 * These types mirror the database schema and provide type safety
 * from client capture through API to database storage.
 *
 * Naming conventions:
 * - *Payload: Data sent from client to server
 * - *Response: Data returned from server to client
 * - *Event: Complete database record
 * - *Builder: Mutable state during capture
 */

import { CardId, DeckId, ReviewEventId, StudySessionId } from "./ids";

// ============================================================
// ENUMS (match database)
// ============================================================

export type ResponseType =
  | "self_rating"
  | "typed_response"
  | "multiple_choice"
  | "cloze_fill";
export type DeviceType = "mobile" | "tablet" | "desktop" | "unknown";
export type CardState = "new" | "learning" | "review" | "relearning";
export type ReviewEventStatus =
  | "started"
  | "interacting"
  | "completed"
  | "abandoned";
export type InputMethod = "touch" | "mouse" | "keyboard" | "stylus";
export type Platform = "web" | "ios" | "android" | "electron";

// ============================================================
// JSONB COLUMN TYPES
// ============================================================

/**
 * Record of a preceding review in the same session
 */
export interface PrecedingReview {
  cardId: string;
  rating: number;
  durationMs: number;
  wasCorrect: boolean;
}

/**
 * Interaction with a multiple choice option
 */
export interface OptionInteraction {
  optionIndex: number;
  hoverMs: number;
  clickCount?: number;
}

/**
 * Single interaction event in the streaming log
 */
export interface InteractionEvent {
  type:
    | "keystroke"
    | "backspace"
    | "paste"
    | "focus"
    | "blur"
    | "scroll"
    | "flip" // Card flipped to show answer
    | "hover"
    | "touch_start"
    | "touch_end"
    | "background" // App went to background
    | "foreground"; // App came back to foreground
  timestampMs: number; // Relative to review start
  data?: Record<string, unknown>;
}

// ============================================================
// API PAYLOADS - What the client sends
// ============================================================

/**
 * Payload for POST /api/reviews/events/start
 * Sent when a review begins (card is shown)
 */
export interface StartReviewEventPayload {
  // Client-generated event ID
  eventId: ReviewEventId;

  // Core identifiers
  cardId: CardId;
  deckId: DeckId;
  sessionId?: StudySessionId;

  // Client timestamp
  clientCreatedAt: string; // ISO 8601

  // Device context (captured once at start)
  deviceType: DeviceType;
  viewportWidth: number;
  viewportHeight: number;
  inputMethod: InputMethod;
  platform: Platform;
  clientVersion: string;
  userAgent?: string;

  // Time context
  localHour: number;
  localDayOfWeek: number;
  timezoneOffsetMinutes: number;

  // Session context
  positionInSession?: number;
  timeSinceSessionStartMs?: number;
  precedingReviews?: PrecedingReview[];

  // Card state at review start
  cardStateBefore: CardState;
  responseType: ResponseType;

  // FSRS predictions at review time
  predictedRecallProbability?: number;
  actualIntervalDays?: number;
  scheduledIntervalDays?: number;
  overdueDays?: number;
  easeFactorBefore?: number;
  intervalBeforeDays?: number;
  repetitionCount?: number;
  lapseCount?: number;

  // Content context
  frontContentLength?: number;
  backContentLength?: number;
  hasMedia?: boolean;
  mediaTypes?: string[];
  cardTags?: string[];

  // For request tracing
  clientRequestId?: string;
}

/**
 * Payload for PATCH /api/reviews/events/:id/interaction
 * Sent to append interaction data during a review
 */
export interface InteractionPayload {
  // Single interaction or batch
  interactions: InteractionEvent[];

  // Optional: first interaction timestamp if not sent before
  timeToFirstInteractionMs?: number;

  // Background tracking
  wasBackgrounded?: boolean;
  timeBackgroundedMs?: number;

  // For request tracing
  clientRequestId?: string;
}

/**
 * Payload for POST /api/reviews/events/:id/complete
 * Sent when the review finishes
 */
export interface CompleteReviewEventPayload {
  // Required outcome
  rating: 1 | 2 | 3 | 4;
  totalDurationMs: number;

  // Timing details
  timeToFirstInteractionMs?: number;
  timeToAnswerMs?: number;
  hesitationBeforeRatingMs?: number;

  // Response data (for typed responses)
  userResponseText?: string;
  expectedResponseText?: string;
  responseSimilarityScore?: number;

  // Keystroke metrics
  keystrokeCount?: number;
  backspaceCount?: number;
  pasteCount?: number;
  editCount?: number;

  // Multiple choice data
  optionInteractions?: OptionInteraction[];

  // Final interaction log (if not streamed)
  interactionLog?: InteractionEvent[];

  // Background tracking
  wasBackgrounded?: boolean;
  timeBackgroundedMs?: number;

  // Post-review state
  cardStateAfter: CardState;
  easeFactorAfter?: number;
  intervalAfterDays?: number;

  // Link to legacy study_sessions
  legacySessionId?: string;

  // For request tracing
  clientRequestId?: string;
}

// ============================================================
// API RESPONSES - What the server returns
// ============================================================

export interface StartReviewEventResponse {
  success: true;
  eventId: string;
  serverReceivedAt: string;
}

export interface InteractionResponse {
  success: true;
  eventId: string;
  interactionCount: number;
}

export interface CompleteReviewEventResponse {
  success: true;
  eventId: string;
  completedAt: string;
  wasCorrect: boolean;
}

export interface ReviewEventErrorResponse {
  success: false;
  error: string;
  code?: string;
  eventId?: string;
}

export type ReviewEventResponse<T> = T | ReviewEventErrorResponse;

// ============================================================
// DATABASE RECORD - Complete event as stored
// ============================================================

/**
 * Complete review event as stored in database
 */
export interface ReviewEvent {
  eventId: string;
  userId: string;
  cardId: string;
  deckId: string;
  sessionId: string | null;
  status: ReviewEventStatus;

  // Outcome
  rating: number | null;
  wasCorrect: boolean | null;

  // Timing
  timeToFirstInteractionMs: number | null;
  timeToAnswerMs: number | null;
  totalDurationMs: number | null;
  hesitationBeforeRatingMs: number | null;

  // Session context
  positionInSession: number | null;
  timeSinceSessionStartMs: number | null;
  localHour: number | null;
  localDayOfWeek: number | null;
  timezoneOffsetMinutes: number | null;
  precedingReviews: PrecedingReview[];

  // Response
  responseType: ResponseType;
  userResponseText: string | null;
  expectedResponseText: string | null;
  responseSimilarityScore: number | null;
  keystrokeCount: number | null;
  backspaceCount: number | null;
  pasteCount: number | null;
  editCount: number | null;
  optionInteractions: OptionInteraction[] | null;
  interactionLog: InteractionEvent[];

  // Device
  deviceType: DeviceType;
  viewportWidth: number | null;
  viewportHeight: number | null;
  wasBackgrounded: boolean;
  timeBackgroundedMs: number | null;
  inputMethod: string | null;
  clientVersion: string | null;
  platform: string | null;
  userAgent: string | null;

  // FSRS
  cardStateBefore: CardState | null;
  cardStateAfter: CardState | null;
  predictedRecallProbability: number | null;
  actualIntervalDays: number | null;
  scheduledIntervalDays: number | null;
  overdueDays: number | null;
  easeFactorBefore: number | null;
  easeFactorAfter: number | null;
  intervalBeforeDays: number | null;
  intervalAfterDays: number | null;
  repetitionCount: number | null;
  lapseCount: number | null;

  // Content
  frontContentLength: number | null;
  backContentLength: number | null;
  hasMedia: boolean;
  mediaTypes: string[] | null;
  cardTags: string[] | null;

  // Timestamps
  clientCreatedAt: string | null;
  serverReceivedAt: string;
  completedAt: string | null;

  // Metadata
  legacySessionId: string | null;
  clientRequestId: string | null;
}

// ============================================================
// CLIENT-SIDE BUILDER - Mutable state during capture
// ============================================================

/**
 * Builder state for accumulating review data as user interacts
 * This is what we track on the client before sending to server
 */
export interface ReviewEventBuilder {
  // Identity
  eventId: ReviewEventId;
  cardId: CardId;
  deckId: DeckId;
  sessionId?: StudySessionId;

  // Lifecycle
  status: ReviewEventStatus;

  // Timestamps (performance.now() for precision)
  cardShownAt: number;
  firstInteractionAt: number | null;
  answerShownAt: number | null;
  ratingSelectedAt: number | null;

  // Interaction tracking
  interactions: InteractionEvent[];
  keystrokeCount: number;
  backspaceCount: number;
  pasteCount: number;

  // Response tracking
  currentResponse: string;
  responseSnapshots: string[];

  // Focus/background tracking
  isInBackground: boolean;
  backgroundStartedAt: number | null;
  totalBackgroundMs: number;
  blurEvents: Array<{
    blurAt: number;
    focusAt: number | null;
  }>;

  // Option hover tracking (for MC)
  optionHovers: Map<number, number>;

  // Device context (captured at start)
  deviceContext: {
    deviceType: DeviceType;
    viewportWidth: number;
    viewportHeight: number;
    inputMethod: InputMethod;
    platform: Platform;
    clientVersion: string;
    userAgent: string;
  };

  // Time context
  timeContext: {
    localHour: number;
    localDayOfWeek: number;
    timezoneOffsetMinutes: number;
  };
}

// ============================================================
// SESSION MANAGER TYPES
// ============================================================

/**
 * Study session state
 */
export interface StudySession {
  sessionId: StudySessionId;
  startedAt: number; // performance.now()
  reviewCount: number;
  precedingReviews: PrecedingReview[];
}

// ============================================================
// UTILITY TYPES
// ============================================================

/**
 * Type guard to check if a response is an error
 */
export function isErrorResponse(
  response: ReviewEventResponse<unknown>,
): response is ReviewEventErrorResponse {
  return (response as ReviewEventErrorResponse).success === false;
}

/**
 * Converts snake_case API response to camelCase
 */
export type CamelCase<S extends string> =
  S extends `${infer P1}_${infer P2}${infer P3}`
    ? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}`
    : Lowercase<S>;

/**
 * Converts an object's keys from snake_case to camelCase
 */
export type CamelCaseKeys<T> = {
  [K in keyof T as CamelCase<string & K>]: T[K] extends object
    ? CamelCaseKeys<T[K]>
    : T[K];
};
