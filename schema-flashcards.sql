-- ============================================
-- SPACED REPETITION SYSTEM - Database Schema
-- ============================================
-- Run this in Supabase SQL Editor

-- 1. Flashcards table
CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE NOT NULL,
  page_number INTEGER,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  hint TEXT,
  
  -- SuperMemo SM-2 Algorithm fields
  ease_factor NUMERIC DEFAULT 2.5 CHECK (ease_factor >= 1.3),
  interval_days INTEGER DEFAULT 1 CHECK (interval_days >= 0),
  repetitions INTEGER DEFAULT 0 CHECK (repetitions >= 0),
  next_review TIMESTAMPTZ DEFAULT NOW(),
  last_reviewed TIMESTAMPTZ,
  
  -- Metadata
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai_generated', 'highlighted')),
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_flashcards_user_next_review 
  ON flashcards(user_id, next_review) 
  WHERE next_review <= NOW();

CREATE INDEX IF NOT EXISTS idx_flashcards_user_textbook 
  ON flashcards(user_id, textbook_id);

CREATE INDEX IF NOT EXISTS idx_flashcards_textbook_page 
  ON flashcards(textbook_id, page_number);

-- 3. Review history table (optional - for analytics)
CREATE TABLE IF NOT EXISTS flashcard_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flashcard_id UUID REFERENCES flashcards(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  quality INTEGER NOT NULL CHECK (quality >= 0 AND quality <= 5),
  time_taken_seconds INTEGER,
  reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_flashcard 
  ON flashcard_reviews(flashcard_id, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_user 
  ON flashcard_reviews(user_id, reviewed_at DESC);

-- 4. User study statistics
CREATE TABLE IF NOT EXISTS user_study_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  cards_reviewed INTEGER DEFAULT 0,
  cards_learned INTEGER DEFAULT 0, -- Cards graduated (interval > 1 day)
  study_time_seconds INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  UNIQUE(user_id, textbook_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_study_stats_user_date 
  ON user_study_stats(user_id, date DESC);

-- 5. RLS Policies
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_study_stats ENABLE ROW LEVEL SECURITY;

-- Users can only see their own flashcards
CREATE POLICY "users_manage_own_flashcards" ON flashcards
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can only see their own review history
CREATE POLICY "users_manage_own_reviews" ON flashcard_reviews
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can only see their own stats
CREATE POLICY "users_view_own_stats" ON user_study_stats
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 6. Functions

-- Function to get due cards count
CREATE OR REPLACE FUNCTION get_due_cards_count(p_user_id UUID, p_textbook_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM flashcards
  WHERE user_id = p_user_id
    AND textbook_id = p_textbook_id
    AND next_review <= NOW();
$$ LANGUAGE SQL STABLE;

-- Function to update study streak
CREATE OR REPLACE FUNCTION update_study_streak(p_user_id UUID, p_textbook_id UUID)
RETURNS VOID AS $$
DECLARE
  v_last_study DATE;
  v_current_streak INTEGER;
BEGIN
  -- Get last study date
  SELECT date INTO v_last_study
  FROM user_study_stats
  WHERE user_id = p_user_id
    AND textbook_id = p_textbook_id
    AND cards_reviewed > 0
  ORDER BY date DESC
  LIMIT 1;

  -- Calculate streak
  IF v_last_study IS NULL THEN
    v_current_streak := 1;
  ELSIF v_last_study = CURRENT_DATE THEN
    RETURN; -- Already studied today
  ELSIF v_last_study = CURRENT_DATE - INTERVAL '1 day' THEN
    -- Continue streak
    SELECT streak_days INTO v_current_streak
    FROM user_study_stats
    WHERE user_id = p_user_id
      AND textbook_id = p_textbook_id
      AND date = v_last_study;
    v_current_streak := COALESCE(v_current_streak, 0) + 1;
  ELSE
    -- Streak broken
    v_current_streak := 1;
  END IF;

  -- Update today's stats
  INSERT INTO user_study_stats (user_id, textbook_id, date, streak_days)
  VALUES (p_user_id, p_textbook_id, CURRENT_DATE, v_current_streak)
  ON CONFLICT (user_id, textbook_id, date)
  DO UPDATE SET streak_days = v_current_streak;
END;
$$ LANGUAGE plpgsql;

-- 7. Sample data (optional - for testing)
-- Uncomment to insert sample flashcards
/*
INSERT INTO flashcards (user_id, textbook_id, page_number, question, answer, source)
VALUES 
  (auth.uid(), 'YOUR_TEXTBOOK_ID', 1, 'What is the derivative of x²?', '2x', 'manual'),
  (auth.uid(), 'YOUR_TEXTBOOK_ID', 1, 'What is the integral of 1/x?', 'ln|x| + C', 'manual'),
  (auth.uid(), 'YOUR_TEXTBOOK_ID', 2, 'What is the limit definition of derivative?', 'lim(h→0) [f(x+h) - f(x)]/h', 'manual');
*/

-- Verification query
SELECT 
  'Flashcards table' as table_name,
  COUNT(*) as row_count
FROM flashcards
UNION ALL
SELECT 
  'Review history',
  COUNT(*)
FROM flashcard_reviews
UNION ALL
SELECT 
  'Study stats',
  COUNT(*)
FROM user_study_stats;

