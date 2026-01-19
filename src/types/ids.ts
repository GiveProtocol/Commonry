/**
 * Branded types for type-safe IDs
 * This prevents mixing up different entity IDs at compile time
 */

// Base branded type
type Brand<K, T> = K & { readonly __brand: T };

// Entity ID types
export type NoteId = Brand<string, 'NoteId'>;
export type CardId = Brand<string, 'CardId'>;
export type DeckId = Brand<string, 'DeckId'>;
export type ReviewId = Brand<string, 'ReviewId'>;
export type MediaId = Brand<string, 'MediaId'>;
export type UserId = Brand<string, 'UserId'>;
export type CardModelId = Brand<string, 'CardModelId'>;
export type CardTemplateId = Brand<string, 'CardTemplateId'>;
export type ReviewEventId = Brand<string, 'ReviewEventId'>;
export type StudySessionId = Brand<string, 'StudySessionId'>;

// Union type of all entity IDs
export type EntityId =
  | NoteId
  | CardId
  | DeckId
  | ReviewId
  | MediaId
  | UserId
  | CardModelId
  | CardTemplateId
  | ReviewEventId
  | StudySessionId;

// Entity type discriminator
export type EntityType =
  | 'note'
  | 'card'
  | 'deck'
  | 'review'
  | 'media'
  | 'user'
  | 'cardModel'
  | 'cardTemplate'
  | 'reviewEvent'
  | 'studySession';

// Prefix mapping for each entity type
export const ENTITY_PREFIXES: Record<EntityType, string> = {
  note: 'not',
  card: 'crd',
  deck: 'dck',
  review: 'rev',
  media: 'med',
  user: 'usr',
  cardModel: 'mdl',
  cardTemplate: 'tpl',
  reviewEvent: 'evt',  // rev_ already taken by review, use evt_ for review events
  studySession: 'ses',
} as const;

// Reverse mapping for parsing
export const PREFIX_TO_ENTITY: Record<string, EntityType> = {
  not: 'note',
  crd: 'card',
  dck: 'deck',
  rev: 'review',
  med: 'media',
  usr: 'user',
  mdl: 'cardModel',
  tpl: 'cardTemplate',
  evt: 'reviewEvent',
  ses: 'studySession',
} as const;
