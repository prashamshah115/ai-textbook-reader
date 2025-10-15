-- ================================================================
-- DAY 1 PRODUCTION SCHEMA: Job Queue + Idempotency + Contracts
-- ================================================================
-- Run this in Supabase SQL Editor AFTER schema-web-context.sql
-- This establishes the foundation for production-grade async processing

-- ================================================================
-- 1. JOBS TABLE - Queue system with idempotency and retry logic
-- ================================================================

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'extract_text', 'generate_ai', 'detect_chapters', 'fetch_web_context'
  state TEXT DEFAULT 'queued' CHECK (state IN ('queued', 'processing', 'completed', 'failed', 'dead')),
  attempt INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_run_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}',
  error TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes for job queue performance
CREATE INDEX idx_jobs_state_next_run ON jobs(state, next_run_at) WHERE state IN ('queued', 'processing');
CREATE INDEX idx_jobs_textbook ON jobs(textbook_id);
CREATE INDEX idx_jobs_type ON jobs(type);
CREATE INDEX idx_jobs_idempotency ON jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_jobs_created ON jobs(created_at DESC);

-- RLS for jobs table
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view jobs for their textbooks"
  ON jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM textbooks
      WHERE textbooks.id = jobs.textbook_id
      AND textbooks.user_id = auth.uid()
    )
  );

-- Only service role can insert/update jobs
CREATE POLICY "Service role can manage jobs"
  ON jobs FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ================================================================
-- 2. EVENTS TABLE - Realtime event log for monitoring
-- ================================================================

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'upload_complete', 'extraction_progress', 'ai_page_ready', 'job_failed'
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for event queries
CREATE INDEX idx_events_textbook ON events(textbook_id, created_at DESC);
CREATE INDEX idx_events_type ON events(event_type);

-- RLS for events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events for their textbooks"
  ON events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM textbooks
      WHERE textbooks.id = events.textbook_id
      AND textbooks.user_id = auth.uid()
    )
  );

-- ================================================================
-- 3. METRICS TABLE - Performance instrumentation
-- ================================================================

CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_name TEXT NOT NULL, -- 'ttfp', 'chat_first_token', 'page_turn', 'extraction_duration'
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL, -- 'ms', 's', 'count'
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(), -- Auto-populate from auth context
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for metrics
CREATE INDEX idx_metrics_name ON metrics(metric_name, created_at DESC);
CREATE INDEX idx_metrics_textbook ON metrics(textbook_id);
CREATE INDEX idx_metrics_user ON metrics(user_id);

-- RLS for metrics
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own metrics"
  ON metrics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own metrics"
  ON metrics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- 4. UNIQUE CONSTRAINTS - Prevent duplicate data
-- ================================================================

-- Ensure pages are unique per textbook
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_textbook_page'
  ) THEN
    ALTER TABLE pages ADD CONSTRAINT unique_textbook_page 
      UNIQUE (textbook_id, page_number);
  END IF;
END $$;

-- Ensure AI content is unique per page
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_page_ai'
  ) THEN
    ALTER TABLE ai_processed_content ADD CONSTRAINT unique_page_ai 
      UNIQUE (page_id);
  END IF;
END $$;

-- Ensure chapters don't overlap
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_textbook_chapter'
  ) THEN
    ALTER TABLE chapters ADD CONSTRAINT unique_textbook_chapter
      UNIQUE (textbook_id, chapter_number);
  END IF;
END $$;

-- ================================================================
-- 5. ENHANCED TEXTBOOKS TABLE - Add idempotency and job tracking
-- ================================================================

-- Add columns for idempotency and job tracking
ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS upload_started_at TIMESTAMPTZ;
ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS upload_completed_at TIMESTAMPTZ;
ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS extraction_started_at TIMESTAMPTZ;
ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS extraction_completed_at TIMESTAMPTZ;

-- Add index for idempotency lookups
CREATE INDEX IF NOT EXISTS idx_textbooks_idempotency ON textbooks(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ================================================================
-- 6. HELPER FUNCTIONS - Job queue management
-- ================================================================

-- Function to enqueue a job with idempotency
CREATE OR REPLACE FUNCTION enqueue_job(
  p_textbook_id UUID,
  p_type TEXT,
  p_payload JSONB DEFAULT '{}',
  p_idempotency_key TEXT DEFAULT NULL,
  p_max_retries INTEGER DEFAULT 3
) RETURNS UUID AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Check if job with same idempotency key exists
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_job_id FROM jobs 
    WHERE idempotency_key = p_idempotency_key;
    
    IF v_job_id IS NOT NULL THEN
      RETURN v_job_id; -- Job already exists, return existing ID
    END IF;
  END IF;
  
  -- Insert new job
  INSERT INTO jobs (textbook_id, type, state, payload, idempotency_key, max_retries)
  VALUES (p_textbook_id, p_type, 'queued', p_payload, p_idempotency_key, p_max_retries)
  RETURNING id INTO v_job_id;
  
  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update job state
CREATE OR REPLACE FUNCTION update_job_state(
  p_job_id UUID,
  p_state TEXT,
  p_error TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE jobs 
  SET 
    state = p_state,
    error = p_error,
    updated_at = NOW(),
    started_at = CASE WHEN p_state = 'processing' THEN NOW() ELSE started_at END,
    completed_at = CASE WHEN p_state IN ('completed', 'dead') THEN NOW() ELSE completed_at END,
    attempt = CASE WHEN p_state = 'processing' THEN attempt + 1 ELSE attempt END,
    next_run_at = CASE 
      WHEN p_state = 'failed' AND attempt < max_retries 
        THEN NOW() + (POWER(2, attempt) * interval '1 second') -- Exponential backoff
      WHEN p_state = 'failed' AND attempt >= max_retries
        THEN NULL -- Move to dead letter queue
      ELSE next_run_at
    END
  WHERE id = p_job_id;
  
  -- If job failed too many times, mark as dead
  UPDATE jobs SET state = 'dead' 
  WHERE id = p_job_id AND state = 'failed' AND attempt >= max_retries;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to emit event for Realtime
CREATE OR REPLACE FUNCTION emit_event(
  p_textbook_id UUID,
  p_event_type TEXT,
  p_payload JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO events (textbook_id, event_type, payload)
  VALUES (p_textbook_id, p_event_type, p_payload)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record metric
CREATE OR REPLACE FUNCTION record_metric(
  p_metric_name TEXT,
  p_value NUMERIC,
  p_unit TEXT,
  p_textbook_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_metric_id UUID;
BEGIN
  INSERT INTO metrics (metric_name, value, unit, textbook_id, user_id, metadata)
  VALUES (p_metric_name, p_value, p_unit, p_textbook_id, auth.uid(), p_metadata)
  RETURNING id INTO v_metric_id;
  
  RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 7. TRIGGER - Auto-update timestamps
-- ================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 8. GRANT PERMISSIONS
-- ================================================================

-- Grant access to service role for worker operations
GRANT ALL ON jobs TO service_role;
GRANT ALL ON events TO service_role;
GRANT ALL ON metrics TO service_role;

-- ================================================================
-- 9. INITIAL DATA - Create job types enum for validation
-- ================================================================

COMMENT ON COLUMN jobs.type IS 'Valid types: extract_text, generate_ai, detect_chapters, fetch_web_context';
COMMENT ON COLUMN jobs.state IS 'States: queued → processing → completed/failed → dead (after max retries)';
COMMENT ON COLUMN events.event_type IS 'Valid types: upload_complete, extraction_progress, extraction_complete, ai_page_ready, job_failed';

-- ================================================================
-- SUCCESS MESSAGE
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Day 1 Schema Applied Successfully!';
  RAISE NOTICE '📊 Tables created: jobs, events, metrics';
  RAISE NOTICE '🔐 Unique constraints added to pages, ai_processed_content, chapters';
  RAISE NOTICE '⚙️  Helper functions: enqueue_job(), update_job_state(), emit_event(), record_metric()';
  RAISE NOTICE '🎯 Next: Define TypeScript event contracts in your frontend';
END $$;

