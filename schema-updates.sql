-- ================================================
-- SCHEMA UPDATES: Add Extraction Fields to content_items
-- Run this on your Supabase database
-- ================================================

-- Add extraction columns to content_items table
ALTER TABLE content_items 
  ADD COLUMN IF NOT EXISTS extracted_text TEXT,
  ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS extraction_error TEXT,
  ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ;

-- Add index for efficient status queries
CREATE INDEX IF NOT EXISTS idx_content_items_extraction_status
  ON content_items(extraction_status);

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'content_items' 
  AND column_name IN ('extracted_text', 'extraction_status', 'extraction_error', 'extracted_at');

-- Show sample data structure
SELECT id, title, extraction_status, 
       CASE 
         WHEN extracted_text IS NOT NULL 
         THEN LENGTH(extracted_text) 
         ELSE 0 
       END as text_length
FROM content_items 
LIMIT 5;

