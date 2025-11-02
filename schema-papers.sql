-- ============================================
-- RESEARCH PAPER MANAGEMENT SCHEMA
-- ============================================
-- Migration from Open Paper project to AI Textbook Reader
-- Run this in Supabase SQL Editor after running supabase-schema.sql
--
-- This schema adds research paper management features:
-- - Paper upload and storage
-- - Highlights and annotations
-- - Paper-specific AI chat
-- - Projects (collections of papers)
-- - Full-text search
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- ============================================
-- 1. PAPERS TABLE
-- ============================================
-- Stores research papers uploaded by users

CREATE TABLE IF NOT EXISTS papers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Basic metadata
  title TEXT NOT NULL,
  authors TEXT[], -- Array of author names
  abstract TEXT,
  
  -- File storage
  pdf_url TEXT, -- Public URL for viewing
  storage_path TEXT, -- Internal storage path
  preview_image_url TEXT, -- First page thumbnail
  
  -- Document properties
  total_pages INTEGER DEFAULT 0,
  size_kb INTEGER,
  
  -- Processing status
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  processing_error TEXT, -- Error message if failed
  
  -- Extended metadata (flexible JSON)
  metadata JSONB DEFAULT '{}', -- {keywords, institutions, doi, year, etc}
  
  -- Full-text search
  search_vector TSVECTOR, -- Auto-updated search index
  
  -- Timestamps
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_papers_user_id ON papers(user_id);
CREATE INDEX idx_papers_status ON papers(status);
CREATE INDEX idx_papers_search ON papers USING GIN(search_vector);
CREATE INDEX idx_papers_created ON papers(created_at DESC);
CREATE INDEX idx_papers_accessed ON papers(last_accessed_at DESC NULLS LAST);

-- Auto-update search vector when title/abstract/authors change
CREATE OR REPLACE FUNCTION papers_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.abstract, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.authors, ' '), '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER papers_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, abstract, authors
  ON papers
  FOR EACH ROW
  EXECUTE FUNCTION papers_search_vector_update();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_papers_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER papers_updated_at_trigger
  BEFORE UPDATE ON papers
  FOR EACH ROW
  EXECUTE FUNCTION update_papers_updated_at();

-- ============================================
-- 2. PAPER HIGHLIGHTS
-- ============================================
-- Text selections with colors

CREATE TABLE IF NOT EXISTS paper_highlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Highlight location
  page_number INTEGER NOT NULL,
  text_content TEXT NOT NULL, -- The actual highlighted text
  
  -- Position data (for rendering)
  position JSONB NOT NULL, -- {rects: [{x, y, width, height}], pageIndex, boundingRect}
  
  -- Visual properties
  color TEXT DEFAULT 'yellow' CHECK (color IN ('yellow', 'green', 'blue', 'pink', 'purple')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_highlights_paper ON paper_highlights(paper_id);
CREATE INDEX idx_highlights_user_paper ON paper_highlights(user_id, paper_id);
CREATE INDEX idx_highlights_page ON paper_highlights(paper_id, page_number);

-- Auto-update timestamp
CREATE TRIGGER highlights_updated_at_trigger
  BEFORE UPDATE ON paper_highlights
  FOR EACH ROW
  EXECUTE FUNCTION update_papers_updated_at();

-- ============================================
-- 3. PAPER ANNOTATIONS
-- ============================================
-- Comments/notes attached to highlights

CREATE TABLE IF NOT EXISTS paper_annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  highlight_id UUID REFERENCES paper_highlights(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Annotation content
  content TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_annotations_highlight ON paper_annotations(highlight_id);
CREATE INDEX idx_annotations_user ON paper_annotations(user_id);

-- Auto-update timestamp
CREATE TRIGGER annotations_updated_at_trigger
  BEFORE UPDATE ON paper_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_papers_updated_at();

-- ============================================
-- 4. PAPER CONVERSATIONS
-- ============================================
-- AI chat sessions about papers

CREATE TABLE IF NOT EXISTS paper_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Conversation metadata
  title TEXT, -- Auto-generated or user-provided
  context_type TEXT DEFAULT 'paper' CHECK (context_type IN ('paper', 'project', 'library')),
  
  -- For multi-paper conversations (projects, library-wide)
  context_ids UUID[], -- Array of paper IDs or project IDs
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_paper_conversations_user ON paper_conversations(user_id);
CREATE INDEX idx_paper_conversations_paper ON paper_conversations(paper_id);
CREATE INDEX idx_paper_conversations_type ON paper_conversations(context_type);

-- Auto-update timestamp
CREATE TRIGGER conversations_updated_at_trigger
  BEFORE UPDATE ON paper_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_papers_updated_at();

-- ============================================
-- 5. PAPER MESSAGES
-- ============================================
-- Individual messages in conversations

CREATE TABLE IF NOT EXISTS paper_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES paper_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Message data
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  
  -- AI-specific data
  citations JSONB, -- [{page: 3, text: "...", confidence: 0.9, paper_id: "..."}]
  model TEXT, -- Which AI model was used
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_paper_messages_conversation ON paper_messages(conversation_id);
CREATE INDEX idx_paper_messages_created ON paper_messages(created_at);

-- ============================================
-- 6. PAPER PROJECTS
-- ============================================
-- Collections of related papers

CREATE TABLE IF NOT EXISTS paper_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Project metadata
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6', -- Hex color for UI
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_projects_user ON paper_projects(user_id);
CREATE INDEX idx_projects_created ON paper_projects(created_at DESC);

-- Auto-update timestamp
CREATE TRIGGER projects_updated_at_trigger
  BEFORE UPDATE ON paper_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_papers_updated_at();

-- ============================================
-- 7. PROJECT PAPERS (Join Table)
-- ============================================
-- Many-to-many: papers can be in multiple projects

CREATE TABLE IF NOT EXISTS project_papers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES paper_projects(id) ON DELETE CASCADE NOT NULL,
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE NOT NULL,
  
  -- Metadata
  notes TEXT, -- Project-specific notes about this paper
  position INTEGER, -- Order within project (for manual sorting)
  
  -- Timestamps
  added_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure no duplicates
  UNIQUE(project_id, paper_id)
);

-- Indexes
CREATE INDEX idx_project_papers_project ON project_papers(project_id);
CREATE INDEX idx_project_papers_paper ON project_papers(paper_id);
CREATE INDEX idx_project_papers_position ON project_papers(project_id, position);

-- ============================================
-- 8. PAPER NOTES
-- ============================================
-- Standalone notes on papers (separate from annotations)

CREATE TABLE IF NOT EXISTS paper_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Note content
  content TEXT NOT NULL,
  page_number INTEGER, -- Optional page reference
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_paper_notes_paper ON paper_notes(paper_id);
CREATE INDEX idx_paper_notes_user_paper ON paper_notes(user_id, paper_id);

-- Auto-update timestamp
CREATE TRIGGER paper_notes_updated_at_trigger
  BEFORE UPDATE ON paper_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_papers_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_notes ENABLE ROW LEVEL SECURITY;

-- Papers: Users can only see their own papers
CREATE POLICY "Users can view own papers"
  ON papers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own papers"
  ON papers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own papers"
  ON papers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own papers"
  ON papers FOR DELETE
  USING (auth.uid() = user_id);

-- Highlights: Users can only see/edit their own highlights
CREATE POLICY "Users can view own highlights"
  ON paper_highlights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own highlights"
  ON paper_highlights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own highlights"
  ON paper_highlights FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own highlights"
  ON paper_highlights FOR DELETE
  USING (auth.uid() = user_id);

-- Annotations: Users can only see/edit their own annotations
CREATE POLICY "Users can view own annotations"
  ON paper_annotations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own annotations"
  ON paper_annotations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own annotations"
  ON paper_annotations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own annotations"
  ON paper_annotations FOR DELETE
  USING (auth.uid() = user_id);

-- Conversations: Users can only see their own conversations
CREATE POLICY "Users can view own conversations"
  ON paper_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON paper_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON paper_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON paper_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Messages: Users can only see messages in their conversations
CREATE POLICY "Users can view own messages"
  ON paper_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
  ON paper_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages"
  ON paper_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Projects: Users can only see their own projects
CREATE POLICY "Users can view own projects"
  ON paper_projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
  ON paper_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON paper_projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON paper_projects FOR DELETE
  USING (auth.uid() = user_id);

-- Project Papers: Users can only modify their own project papers
CREATE POLICY "Users can view project papers"
  ON project_papers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM paper_projects
      WHERE paper_projects.id = project_papers.project_id
      AND paper_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert project papers"
  ON project_papers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM paper_projects
      WHERE paper_projects.id = project_papers.project_id
      AND paper_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete project papers"
  ON project_papers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM paper_projects
      WHERE paper_projects.id = project_papers.project_id
      AND paper_projects.user_id = auth.uid()
    )
  );

-- Paper Notes: Users can only see their own notes
CREATE POLICY "Users can view own notes"
  ON paper_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
  ON paper_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON paper_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON paper_notes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to search papers by text query
CREATE OR REPLACE FUNCTION search_papers(
  search_query TEXT,
  user_uuid UUID
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  authors TEXT[],
  abstract TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.title,
    p.authors,
    p.abstract,
    ts_rank(p.search_vector, plainto_tsquery('english', search_query)) AS rank
  FROM papers p
  WHERE p.user_id = user_uuid
    AND p.search_vector @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get paper with all related data
CREATE OR REPLACE FUNCTION get_paper_with_details(paper_uuid UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'paper', (SELECT row_to_json(p) FROM papers p WHERE p.id = paper_uuid),
    'highlights_count', (SELECT COUNT(*) FROM paper_highlights WHERE paper_id = paper_uuid),
    'annotations_count', (SELECT COUNT(*) FROM paper_annotations pa 
                          JOIN paper_highlights ph ON pa.highlight_id = ph.id 
                          WHERE ph.paper_id = paper_uuid),
    'conversations_count', (SELECT COUNT(*) FROM paper_conversations WHERE paper_id = paper_uuid),
    'projects', (SELECT json_agg(pp.name) FROM paper_projects pp 
                 JOIN project_papers ppr ON pp.id = ppr.project_id 
                 WHERE ppr.paper_id = paper_uuid)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the schema was created correctly

-- Check all tables exist
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'papers',
      'paper_highlights',
      'paper_annotations',
      'paper_conversations',
      'paper_messages',
      'paper_projects',
      'project_papers',
      'paper_notes'
    );
  
  IF table_count = 8 THEN
    RAISE NOTICE '✅ All 8 paper management tables created successfully';
  ELSE
    RAISE EXCEPTION '❌ Expected 8 tables, found %', table_count;
  END IF;
END $$;

-- Check RLS is enabled
DO $$
DECLARE
  rls_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO rls_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'papers',
      'paper_highlights',
      'paper_annotations',
      'paper_conversations',
      'paper_messages',
      'paper_projects',
      'project_papers',
      'paper_notes'
    )
    AND rowsecurity = true;
  
  IF rls_count = 8 THEN
    RAISE NOTICE '✅ RLS enabled on all 8 tables';
  ELSE
    RAISE EXCEPTION '❌ RLS not enabled on all tables. Expected 8, found %', rls_count;
  END IF;
END $$;

-- Count policies
SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'paper%'
  OR tablename = 'project_papers'
GROUP BY schemaname, tablename
ORDER BY tablename;

RAISE NOTICE '✅ Paper management schema installation complete!';
RAISE NOTICE 'ℹ️  Next steps:';
RAISE NOTICE '   1. Create storage bucket: papers';
RAISE NOTICE '   2. Set up storage policies for paper uploads';
RAISE NOTICE '   3. Install TypeScript types: npx supabase gen types typescript';

-- ============================================
-- SAMPLE DATA (for testing - comment out in production)
-- ============================================
/*
-- Insert a test paper
INSERT INTO papers (user_id, title, authors, abstract, status)
VALUES (
  auth.uid(),
  'Attention Is All You Need',
  ARRAY['Vaswani', 'Shazeer', 'Parmar', 'Uszkoreit'],
  'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.',
  'completed'
);
*/

