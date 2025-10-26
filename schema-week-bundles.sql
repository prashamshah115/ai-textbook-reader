-- ================================================
-- WEEK BUNDLE SYSTEM (Multi-Source Content)
-- Run AFTER existing schemas - NO modifications to existing tables
-- ================================================

-- ================================================
-- TABLE: week_bundles
-- Purpose: Stores course week metadata and aggregated content
-- ================================================

CREATE TABLE IF NOT EXISTS week_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  
  -- Course context
  course_code TEXT NOT NULL,              -- "CSE 120"
  course_name TEXT,                       -- "Operating Systems"
  institution TEXT,                       -- "UCSD"
  week_number INT NOT NULL,
  week_topic TEXT NOT NULL,               -- "Process Scheduling"
  
  -- Parallel aggregation results
  parallel_run_id TEXT,
  aggregated_content JSONB NOT NULL,      -- Full Parallel response with all materials
  aggregated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Status tracking
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one bundle per user/course/week
  UNIQUE(user_id, course_code, institution, week_number)
);

-- ================================================
-- TABLE: content_items
-- Purpose: Individual materials found (textbooks, slides, homework, papers)
-- ================================================

CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_bundle_id UUID REFERENCES week_bundles(id) ON DELETE CASCADE NOT NULL,
  
  -- Content identification
  content_type TEXT NOT NULL CHECK (content_type IN ('textbook', 'slides', 'homework', 'paper')),
  title TEXT NOT NULL,
  source_url TEXT,
  
  -- Type-specific metadata stored as JSONB
  -- Textbook: { authors, pages: [start, end], chapter }
  -- Slides: { pages, professor }
  -- Homework: { problems: [], dueDate }
  -- Paper: { authors, year, venue }
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Parallel AI confidence score (0.0 - 1.0)
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  parallel_citation TEXT,
  
  -- Display ordering
  display_order INT DEFAULT 0,
  
  -- Text Extraction (Extract Once, Use Everywhere)
  extracted_text TEXT,                -- Full text content extracted from source
  extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  extraction_error TEXT,              -- Error message if extraction failed
  extracted_at TIMESTAMPTZ,           -- When extraction completed
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- TABLE: content_access
-- Purpose: Track what user viewed and when (analytics)
-- ================================================

CREATE TABLE IF NOT EXISTS content_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE NOT NULL,
  
  -- Access details
  page_number INT,                        -- Which page they were viewing
  duration_seconds INT DEFAULT 0,         -- How long they spent
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Generated content during this access
  auto_notes_generated BOOLEAN DEFAULT false,
  questions_answered INT DEFAULT 0,
  
  -- Session tracking
  session_id TEXT                         -- Group multiple accesses into study session
);

-- ================================================
-- INDEXES
-- ================================================

-- Week bundles: Fast lookup by user and course
CREATE INDEX IF NOT EXISTS idx_week_bundles_user_course 
  ON week_bundles(user_id, course_code, institution);

CREATE INDEX IF NOT EXISTS idx_week_bundles_week 
  ON week_bundles(course_code, institution, week_number);

-- Content items: Fast lookup by bundle
CREATE INDEX IF NOT EXISTS idx_content_items_bundle 
  ON content_items(week_bundle_id);

CREATE INDEX IF NOT EXISTS idx_content_items_type 
  ON content_items(content_type);

CREATE INDEX IF NOT EXISTS idx_content_items_order 
  ON content_items(week_bundle_id, display_order);

CREATE INDEX IF NOT EXISTS idx_content_items_extraction_status
  ON content_items(extraction_status);

-- Content access: Fast lookup for analytics
CREATE INDEX IF NOT EXISTS idx_content_access_user 
  ON content_access(user_id, content_item_id);

CREATE INDEX IF NOT EXISTS idx_content_access_time 
  ON content_access(accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_access_session 
  ON content_access(session_id);

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================

ALTER TABLE week_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_access ENABLE ROW LEVEL SECURITY;

-- Week Bundles: Users manage their own bundles
CREATE POLICY "Users manage their week bundles" 
  ON week_bundles
  FOR ALL 
  USING (auth.uid() = user_id);

-- Content Items: Users view content in their bundles
CREATE POLICY "Users view content in their bundles" 
  ON content_items
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM week_bundles 
      WHERE week_bundles.id = content_items.week_bundle_id 
      AND week_bundles.user_id = auth.uid()
    )
  );

-- Content Access: Users track their own access
CREATE POLICY "Users track their own access" 
  ON content_access
  FOR ALL 
  USING (auth.uid() = user_id);

-- ================================================
-- FUNCTIONS
-- ================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_week_bundles_updated_at
  BEFORE UPDATE ON week_bundles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_items_updated_at
  BEFORE UPDATE ON content_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- SAMPLE DATA (Optional - for testing)
-- ================================================

-- Uncomment to insert sample data for CSE 120 Week 3
/*
-- Insert sample week bundle (replace USER_ID with actual user ID)
INSERT INTO week_bundles (
  user_id,
  course_code,
  course_name,
  institution,
  week_number,
  week_topic,
  aggregated_content
) VALUES (
  'USER_ID_HERE',  -- Replace with actual user ID
  'CSE 120',
  'Principles of Operating Systems',
  'UCSD',
  3,
  'Process Scheduling',
  '{
    "textbooks": [],
    "slides": [],
    "homework": [],
    "papers": [],
    "parallelRunId": "sample-run",
    "aggregatedAt": "2024-01-01T00:00:00Z"
  }'::jsonb
) ON CONFLICT (user_id, course_code, institution, week_number) DO NOTHING;
*/

-- ================================================
-- VERIFICATION QUERIES
-- ================================================

-- Check if tables were created
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'week_bundles') THEN
    RAISE NOTICE '✅ Table week_bundles created successfully';
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'content_items') THEN
    RAISE NOTICE '✅ Table content_items created successfully';
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'content_access') THEN
    RAISE NOTICE '✅ Table content_access created successfully';
  END IF;
  
  RAISE NOTICE '✅ Week Bundle schema installation complete!';
END $$;

