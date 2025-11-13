// src/core/scheduler/sm2.ts
import { Card } from "../models";
import { Scheduler } from "./types";

/**
 * SM-2 scheduler implementing the spaced repetition algorithm.
 * Schedules card reviews by updating interval, ease factor, repetitions, and status.
 */
export class SM2Scheduler implements Scheduler {
  name = "sm2";

  /**
   * Updates the learning card based on the user's rating and SM-2 algorithm.
   * @param {Card} card - The card to update.
   * @param {number} rating - The rating from the review (1=Again, 2=Hard, 3=Good, 4=Easy).
   * @returns {Partial<Card>} Partial card object containing updated scheduling fields.
   */
  // skipcq: JS-0105 - Method must be instance method to implement Scheduler interface
  updateCard(card: Card, rating: number): Partial<Card> {
    const now = new Date();
    let { interval, easeFactor, repetitions, lapses } = card;

    // Rating: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
    if (rating < 3) {
      // Failed review
      repetitions = 0;
      interval = 1;
      lapses += 1;

      if (rating === 1) {
        interval = Math.max(1, Math.floor(interval * 0.6));
      }
    } else {
      // Successful review
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }

      repetitions += 1;

      // Update ease factor
      easeFactor = this.getNextEaseFactor(card, rating);
    }

    // Calculate next due date
    const due = new Date(now);
    due.setDate(due.getDate() + interval);

    // Update status
    let status: Card["status"] = "review";
    if (repetitions <= 1) {
      status = "learning";
    } else if (lapses > card.lapses && rating < 3) {
      status = "relearning";
    }

    return {
      interval,
      easeFactor,
      repetitions,
      lapses,
      due,
      status,
      modifiedAt: now,
    };
  }

  /**
   * Calculates the next review interval for a card based on its current state and given rating.
   * @param {Card} card - The card for which to calculate the next interval.
   * @param {number} rating - The rating from the review (1=Again, 2=Hard, 3=Good, 4=Easy).
   * @returns {number} The number of days until the next review.
   */
  getNextInterval(card: Card, rating: number): number {
    if (rating < 3) {
      return rating === 1 ? 1 : Math.max(1, Math.floor(card.interval * 0.6));
    }

    if (card.repetitions === 0) {
      return 1;
    } else if (card.repetitions === 1) {
      return 6;
    } else {
      return Math.round(card.interval * card.easeFactor);
    }
  }

  /**
   * Calculates the next ease factor (EF) for a card based on its current EF and rating.
   * @param {Card} card - The card for which to calculate the ease factor.
   * @param {number} rating - The rating from the review (1=Again, 2=Hard, 3=Good, 4=Easy).
   * @returns {number} The updated ease factor, clamped between 1.3 and 2.5.
   */
  getNextEaseFactor(card: Card, rating: number): number {
    // EF' = EF + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
    const ef =
      card.easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));

    // Clamp between 1.3 and 2.5
    return Math.max(1.3, Math.min(2.5, ef));
  }
}
