-- ============================================
-- SEMANTIC SEARCH - pgvector setup
-- ============================================
-- Run this in Supabase SQL Editor AFTER schema-flashcards.sql

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embeddings column to pages table
ALTER TABLE pages ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. Create index for fast similarity search
-- Using ivfflat index with 100 lists (good for ~10k-100k vectors)
CREATE INDEX IF NOT EXISTS idx_pages_embedding 
  ON pages USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- 4. Add embedding metadata
ALTER TABLE pages ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-3-small';
ALTER TABLE pages ADD COLUMN IF NOT EXISTS embedding_created_at TIMESTAMPTZ;

-- 5. Function for semantic similarity search
CREATE OR REPLACE FUNCTION match_pages(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_textbook_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  textbook_id uuid,
  page_number int,
  raw_text text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    pages.id,
    pages.textbook_id,
    pages.page_number,
    pages.raw_text,
    1 - (pages.embedding <=> query_embedding) as similarity
  FROM pages
  WHERE 
    (filter_textbook_id IS NULL OR pages.textbook_id = filter_textbook_id)
    AND pages.embedding IS NOT NULL
    AND 1 - (pages.embedding <=> query_embedding) > match_threshold
  ORDER BY pages.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 6. Table for storing search queries (analytics)
CREATE TABLE IF NOT EXISTS search_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  results_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_queries_user 
  ON search_queries(user_id, created_at DESC);

-- 7. User reading stats (for adaptive questions)
CREATE TABLE IF NOT EXISTS user_reading_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE NOT NULL,
  topic VARCHAR(100) NOT NULL,
  confidence_score NUMERIC DEFAULT 0.5 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
  times_reviewed INTEGER DEFAULT 0,
  times_failed INTEGER DEFAULT 0,
  last_reviewed TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, textbook_id, topic)
);

CREATE INDEX IF NOT EXISTS idx_user_reading_stats_user_textbook 
  ON user_reading_stats(user_id, textbook_id, confidence_score);

-- 8. Concept maps table
CREATE TABLE IF NOT EXISTS concept_maps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  page_range_start INTEGER,
  page_range_end INTEGER,
  concepts JSONB NOT NULL DEFAULT '[]', -- [{id, name, description}]
  relationships JSONB NOT NULL DEFAULT '[]', -- [{from, to, type, strength}]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_concept_maps_user_textbook 
  ON concept_maps(user_id, textbook_id);

CREATE INDEX IF NOT EXISTS idx_concept_maps_chapter 
  ON concept_maps(chapter_id);

-- 9. RLS Policies
ALTER TABLE search_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reading_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_searches" ON search_queries
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_manage_own_reading_stats" ON user_reading_stats
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_manage_own_concept_maps" ON concept_maps
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 10. Helper function to track concept understanding
CREATE OR REPLACE FUNCTION update_concept_confidence(
  p_user_id UUID,
  p_textbook_id UUID,
  p_topic VARCHAR(100),
  p_success BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_reading_stats (user_id, textbook_id, topic, times_reviewed, times_failed, last_reviewed)
  VALUES (
    p_user_id, 
    p_textbook_id, 
    p_topic,
    1,
    CASE WHEN p_success THEN 0 ELSE 1 END,
    NOW()
  )
  ON CONFLICT (user_id, textbook_id, topic)
  DO UPDATE SET
    times_reviewed = user_reading_stats.times_reviewed + 1,
    times_failed = user_reading_stats.times_failed + CASE WHEN p_success THEN 0 ELSE 1 END,
    confidence_score = CASE 
      WHEN p_success THEN LEAST(user_reading_stats.confidence_score + 0.1, 1.0)
      ELSE GREATEST(user_reading_stats.confidence_score - 0.15, 0.0)
    END,
    last_reviewed = NOW();
END;
$$ LANGUAGE plpgsql;

-- Verification
SELECT 
  'Pages with embeddings' as metric,
  COUNT(*) as count
FROM pages
WHERE embedding IS NOT NULL
UNION ALL
SELECT 
  'Total pages',
  COUNT(*)
FROM pages;

