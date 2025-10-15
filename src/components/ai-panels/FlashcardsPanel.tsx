import { useState, useEffect } from 'react';
import { Brain, Zap, TrendingUp, Plus, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { useTextbook } from '../../contexts/TextbookContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import {
  FlashCard,
  ReviewQuality,
  calculateNextReview,
  QUALITY_LABELS,
} from '../../lib/spacedRepetition';

export function FlashcardsPanel() {
  const { user } = useAuth();
  const { currentTextbook } = useTextbook();
  const [dueCards, setDueCards] = useState<FlashCard[]>([]);
  const [currentCard, setCurrentCard] = useState<FlashCard | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [stats, setStats] = useState({
    due: 0,
    reviewed: 0,
    streak: 0,
    total: 0,
  });

  // Load due cards and stats
  useEffect(() => {
    if (user && currentTextbook) {
      loadDueCards();
      loadStats();
    }
  }, [user, currentTextbook]);

  const loadDueCards = async () => {
    if (!user || !currentTextbook) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', user.id)
        .eq('textbook_id', currentTextbook.id)
        .lte('next_review', new Date().toISOString())
        .order('next_review', { ascending: true })
        .limit(50); // Load up to 50 cards

      if (error) throw error;

      const cards = data || [];
      setDueCards(cards);
      setCurrentCard(cards[0] || null);
      setShowAnswer(false);
      
      console.log(`[Flashcards] Loaded ${cards.length} due cards`);
    } catch (error) {
      console.error('[Flashcards] Failed to load cards:', error);
      toast.error('Failed to load flashcards');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!user || !currentTextbook) return;

    try {
      // Get total cards count
      const { count: totalCount } = await supabase
        .from('flashcards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('textbook_id', currentTextbook.id);

      // Get due cards count
      const { count: dueCount } = await supabase
        .from('flashcards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('textbook_id', currentTextbook.id)
        .lte('next_review', new Date().toISOString());

      // Get today's stats
      const { data: todayStats } = await supabase
        .from('user_study_stats')
        .select('cards_reviewed, streak_days')
        .eq('user_id', user.id)
        .eq('textbook_id', currentTextbook.id)
        .eq('date', new Date().toISOString().split('T')[0])
        .maybeSingle();

      setStats({
        due: dueCount || 0,
        reviewed: todayStats?.cards_reviewed || 0,
        streak: todayStats?.streak_days || 0,
        total: totalCount || 0,
      });
    } catch (error) {
      console.error('[Flashcards] Failed to load stats:', error);
    }
  };

  const reviewCard = async (quality: ReviewQuality) => {
    if (!currentCard || reviewing) return;

    setReviewing(true);

    try {
      // Calculate next review using SM-2 algorithm
      const updates = calculateNextReview(currentCard, quality);

      // Update card in database
      const { error } = await supabase
        .from('flashcards')
        .update({
          ease_factor: updates.ease_factor,
          interval_days: updates.interval_days,
          repetitions: updates.repetitions,
          next_review: updates.next_review.toISOString(),
          last_reviewed: new Date().toISOString(),
        })
        .eq('id', currentCard.id);

      if (error) throw error;

      // Record review in history
      await supabase.from('flashcard_reviews').insert({
        flashcard_id: currentCard.id,
        user_id: user!.id,
        quality,
      });

      // Update today's stats
      await supabase.rpc('update_study_streak', {
        p_user_id: user!.id,
        p_textbook_id: currentTextbook!.id,
      });

      await supabase
        .from('user_study_stats')
        .upsert({
          user_id: user!.id,
          textbook_id: currentTextbook!.id,
          date: new Date().toISOString().split('T')[0],
          cards_reviewed: stats.reviewed + 1,
        });

      // Show visual feedback
      if (quality >= 3) {
        toast.success('Great! Card scheduled for later', { duration: 1000 });
      } else {
        toast.error('Will review this again soon', { duration: 1000 });
      }

      // Move to next card
      const nextCards = dueCards.filter((c) => c.id !== currentCard.id);
      setDueCards(nextCards);
      setCurrentCard(nextCards[0] || null);
      setShowAnswer(false);
      setStats((prev) => ({ ...prev, reviewed: prev.reviewed + 1, due: prev.due - 1 }));
    } catch (error) {
      console.error('[Flashcards] Failed to review card:', error);
      toast.error('Failed to save review');
    } finally {
      setReviewing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Stats Header */}
      <div className="border-b border-border px-4 py-3 bg-muted/30">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="text-muted-foreground">Due Today</div>
            <div className="text-lg font-bold text-foreground">{stats.due}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Reviewed</div>
            <div className="text-lg font-bold text-green-600">{stats.reviewed}</div>
          </div>
          <div>
            <div className="text-muted-foreground">🔥 Streak</div>
            <div className="text-lg font-bold text-orange-600">{stats.streak} days</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4">
        {stats.total === 0 ? (
          // No cards yet
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Brain className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Flashcards Yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Create flashcards to start learning with spaced repetition. The app will optimize your review schedule.
            </p>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Create First Card
            </Button>
          </div>
        ) : currentCard ? (
          // Review Mode
          <div className="flex flex-col items-center justify-center h-full">
            {/* Progress */}
            <div className="text-xs text-muted-foreground mb-4">
              Card {stats.reviewed + 1} of {stats.due + stats.reviewed}
            </div>

            {/* Question Card */}
            <Card className="w-full max-w-md p-6 mb-4 bg-card shadow-lg">
              <div className="text-sm text-muted-foreground mb-2">Question:</div>
              <p className="text-base leading-relaxed">{currentCard.question}</p>
              
              {currentCard.hint && !showAnswer && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <div className="text-xs text-muted-foreground mb-1">💡 Hint:</div>
                  <p className="text-sm">{currentCard.hint}</p>
                </div>
              )}

              {currentCard.page_number && (
                <div className="mt-3 text-xs text-muted-foreground">
                  From page {currentCard.page_number}
                </div>
              )}
            </Card>

            {/* Answer Card (shown after clicking) */}
            {showAnswer && (
              <Card className="w-full max-w-md p-6 mb-4 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                <div className="text-sm text-muted-foreground mb-2">Answer:</div>
                <p className="text-base leading-relaxed">{currentCard.answer}</p>
              </Card>
            )}

            {/* Controls */}
            {!showAnswer ? (
              <Button onClick={() => setShowAnswer(true)} size="lg" className="w-full max-w-md">
                Show Answer
              </Button>
            ) : (
              <div className="w-full max-w-md space-y-2">
                <div className="text-xs text-center text-muted-foreground mb-2">
                  How well did you know this?
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => reviewCard(0)}
                    disabled={reviewing}
                    className="w-full"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {QUALITY_LABELS[0]}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => reviewCard(1)}
                    disabled={reviewing}
                    className="w-full"
                  >
                    {QUALITY_LABELS[1]}
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => reviewCard(3)}
                    disabled={reviewing}
                    className="w-full"
                  >
                    {QUALITY_LABELS[3]}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => reviewCard(4)}
                    disabled={reviewing}
                    className="w-full"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {QUALITY_LABELS[4]}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          // All Done!
          <div className="flex flex-col items-center justify-center h-full text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">All Caught Up! 🎉</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              You've reviewed all due cards for today. Great work! Come back tomorrow for more.
            </p>
            <div className="flex gap-2">
              <Button onClick={loadDueCards} variant="outline" size="sm">
                <Zap className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add More Cards
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

