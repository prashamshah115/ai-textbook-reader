-- ============================================
-- PRIORITY QUEUE SYSTEM - Jobs Table Schema
-- ============================================
-- Run this in Supabase SQL Editor after schema-day1-production.sql

-- 1. Create jobs table with priority support
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL, -- 'extract_page', 'generate_ai', 'extract_and_ai'
  job_key TEXT NOT NULL UNIQUE, -- idempotency: 'extract:textbook_id:page_number'
  payload JSONB NOT NULL,
  priority SMALLINT DEFAULT 2, -- 1=high, 2=medium, 3=low
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- 2. Create indexes for optimal queue polling performance
-- Worker polls by priority (ASC) and creation time (oldest first)
CREATE INDEX IF NOT EXISTS idx_jobs_queue ON jobs(priority ASC, created_at ASC) 
  WHERE status = 'queued';

-- Status lookups for monitoring
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, created_at DESC);

-- Job key for idempotency checks
CREATE INDEX IF NOT EXISTS idx_jobs_key ON jobs(job_key);

-- Textbook ID lookups (extract from payload)
CREATE INDEX IF NOT EXISTS idx_jobs_textbook ON jobs((payload->>'textbookId'));

-- 3. RLS Policies (service role only - no user access needed)
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages all jobs" ON jobs
  FOR ALL
  USING (true);

-- 4. Helper function: Clean up old completed jobs (run daily)
CREATE OR REPLACE FUNCTION cleanup_old_jobs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete completed/failed jobs older than 7 days
  DELETE FROM jobs
  WHERE status IN ('completed', 'failed')
    AND completed_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 5. Helper function: Get queue statistics
CREATE OR REPLACE FUNCTION get_queue_stats()
RETURNS TABLE (
  status TEXT,
  priority SMALLINT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.status,
    j.priority,
    COUNT(*) as count
  FROM jobs j
  GROUP BY j.status, j.priority
  ORDER BY j.status, j.priority;
END;
$$ LANGUAGE plpgsql;

-- 6. Helper function: Reset stuck jobs (processing > 5 minutes)
CREATE OR REPLACE FUNCTION reset_stuck_jobs()
RETURNS INTEGER AS $$
DECLARE
  reset_count INTEGER;
BEGIN
  -- Reset jobs stuck in processing for > 5 minutes
  UPDATE jobs
  SET 
    status = 'queued',
    error = 'Reset from stuck state',
    started_at = NULL
  WHERE status = 'processing'
    AND started_at < NOW() - INTERVAL '5 minutes'
    AND attempts < max_attempts;
  
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  
  -- Mark as failed if max attempts exceeded
  UPDATE jobs
  SET 
    status = 'failed',
    error = 'Max attempts exceeded (stuck)',
    completed_at = NOW()
  WHERE status = 'processing'
    AND started_at < NOW() - INTERVAL '5 minutes'
    AND attempts >= max_attempts;
  
  RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- 7. Verification queries
SELECT 
  'Jobs table created' as status,
  COUNT(*) as existing_jobs
FROM jobs;

SELECT * FROM get_queue_stats();

-- 8. Usage examples (commented out)
/*
-- Enqueue a high-priority job
INSERT INTO jobs (job_type, job_key, payload, priority)
VALUES (
  'extract_and_ai',
  'full:textbook-123:page-1',
  '{"textbookId": "textbook-123", "pageNumber": 1, "pdfUrl": "https://..."}'::jsonb,
  1
);

-- Get next job for worker
SELECT * FROM jobs
WHERE status = 'queued'
ORDER BY priority ASC, created_at ASC
LIMIT 1;

-- Mark job as processing
UPDATE jobs
SET 
  status = 'processing',
  started_at = NOW(),
  attempts = attempts + 1
WHERE id = 'job-id';

-- Mark job as completed
UPDATE jobs
SET 
  status = 'completed',
  completed_at = NOW()
WHERE id = 'job-id';

-- Check queue statistics
SELECT * FROM get_queue_stats();

-- Clean up old jobs
SELECT cleanup_old_jobs();

-- Reset stuck jobs
SELECT reset_stuck_jobs();
*/

