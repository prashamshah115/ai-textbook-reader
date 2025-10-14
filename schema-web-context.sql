-- Web Context Bootstrapping Schema Update
-- Run this in your Supabase SQL Editor

-- 1. Create textbook_web_context table
CREATE TABLE IF NOT EXISTS textbook_web_context (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author TEXT,
  subject TEXT,
  web_summary TEXT,
  key_topics TEXT[],
  table_of_contents TEXT,
  source_links TEXT[],
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'fetched', 'failed'))
);

CREATE INDEX idx_web_context_textbook ON textbook_web_context(textbook_id);
CREATE INDEX idx_web_context_status ON textbook_web_context(status);

-- 2. Add metadata_ready column to textbooks
ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS metadata_ready BOOLEAN DEFAULT FALSE;

-- 3. Enable RLS
ALTER TABLE textbook_web_context ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for textbook_web_context
CREATE POLICY "Users can view web context of their textbooks"
  ON textbook_web_context FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM textbooks
      WHERE textbooks.id = textbook_web_context.textbook_id
      AND textbooks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert web context for their textbooks"
  ON textbook_web_context FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM textbooks
      WHERE textbooks.id = textbook_web_context.textbook_id
      AND textbooks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update web context of their textbooks"
  ON textbook_web_context FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM textbooks
      WHERE textbooks.id = textbook_web_context.textbook_id
      AND textbooks.user_id = auth.uid()
    )
  );

-- 5. Grant permissions for service role (for API operations)
GRANT ALL ON textbook_web_context TO service_role;

