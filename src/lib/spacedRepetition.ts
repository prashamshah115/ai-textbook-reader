// ============================================
// SPACED REPETITION - SuperMemo SM-2 Algorithm
// ============================================

export interface FlashCard {
  id: string;
  user_id: string;
  textbook_id: string;
  page_number: number | null;
  question: string;
  answer: string;
  hint?: string;
  ease_factor: number;  // 1.3 - 2.5+
  interval_days: number;
  repetitions: number;
  next_review: string;  // ISO timestamp
  last_reviewed?: string;
  source: 'manual' | 'ai_generated' | 'highlighted';
  difficulty?: 'easy' | 'medium' | 'hard';
  created_at: string;
}

/**
 * Review Quality Scale (SuperMemo SM-2)
 * 0: Complete blackout (total fail)
 * 1: Incorrect response, but familiar
 * 2: Incorrect response, but easy to recall correct answer
 * 3: Correct response, but with difficulty
 * 4: Correct response, with hesitation
 * 5: Perfect response (immediate recall)
 */
export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;

export interface ReviewResult {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review: Date;
}

/**
 * Calculate next review schedule using SuperMemo SM-2 algorithm
 * 
 * @param card - Current flashcard state
 * @param quality - Review quality (0-5)
 * @returns Updated card properties
 */
export function calculateNextReview(
  card: FlashCard,
  quality: ReviewQuality
): ReviewResult {
  let easeFactor = card.ease_factor;
  let intervalDays = card.interval_days;
  let repetitions = card.repetitions;

  // Update ease factor based on quality
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  // Ease factor should not drop below 1.3
  easeFactor = Math.max(1.3, easeFactor);

  // If quality < 3, reset the learning process
  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    // Quality >= 3: continue progression
    repetitions++;
    
    // Calculate new interval based on repetition count
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      // For repetitions > 2: I(n) = I(n-1) * EF
      intervalDays = Math.round(intervalDays * easeFactor);
    }
  }

  // Calculate next review date
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + intervalDays);

  return {
    ease_factor: parseFloat(easeFactor.toFixed(2)),
    interval_days: intervalDays,
    repetitions,
    next_review: nextReview,
  };
}

/**
 * Get difficulty level based on ease factor
 */
export function getDifficultyFromEaseFactor(easeFactor: number): 'easy' | 'medium' | 'hard' {
  if (easeFactor >= 2.5) return 'easy';
  if (easeFactor >= 2.0) return 'medium';
  return 'hard';
}

/**
 * Calculate retention rate (percentage of cards with quality >= 3)
 */
export function calculateRetentionRate(reviews: { quality: number }[]): number {
  if (reviews.length === 0) return 0;
  
  const successCount = reviews.filter(r => r.quality >= 3).length;
  return Math.round((successCount / reviews.length) * 100);
}

/**
 * Get recommended daily review count based on available cards
 */
export function getRecommendedDailyReviews(
  dueCount: number,
  avgTimePerCard: number = 30 // seconds
): number {
  // Recommend 20 cards per day (10 minutes at 30s per card)
  // Or all due cards if less than 20
  const ideal = 20;
  return Math.min(dueCount, ideal);
}

/**
 * Predict next review date for planning
 */
export function predictNextReview(
  currentInterval: number,
  easeFactor: number,
  assumedQuality: ReviewQuality = 4
): Date {
  if (assumedQuality < 3) {
    // Failed reviews reset to 1 day
    const next = new Date();
    next.setDate(next.getDate() + 1);
    return next;
  }

  const nextInterval = Math.round(currentInterval * easeFactor);
  const next = new Date();
  next.setDate(next.getDate() + nextInterval);
  return next;
}

/**
 * Get color for visual feedback based on quality
 */
export function getQualityColor(quality: ReviewQuality): string {
  switch (quality) {
    case 0:
    case 1:
      return 'destructive'; // Red
    case 2:
      return 'warning'; // Yellow
    case 3:
      return 'default'; // Gray
    case 4:
      return 'secondary'; // Light blue
    case 5:
      return 'success'; // Green
    default:
      return 'default';
  }
}

/**
 * Get button labels for quality selection
 */
export const QUALITY_LABELS = {
  0: 'Again',
  1: 'Hard',
  3: 'Good',
  4: 'Easy',
  5: 'Perfect',
} as const;

/**
 * Export functions for testing
 */
export const SpacedRepetition = {
  calculateNextReview,
  getDifficultyFromEaseFactor,
  calculateRetentionRate,
  getRecommendedDailyReviews,
  predictNextReview,
  getQualityColor,
  QUALITY_LABELS,
};

export default SpacedRepetition;

