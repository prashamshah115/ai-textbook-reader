-- ================================================
-- CSE 120 Week 3 - Complete Database Setup (SQL Only)
-- Run this in Supabase SQL Editor or via psql
-- ================================================

-- Step 1: Add extraction columns to content_items
ALTER TABLE content_items 
  ADD COLUMN IF NOT EXISTS extracted_text TEXT,
  ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS extraction_error TEXT,
  ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_content_items_extraction_status
  ON content_items(extraction_status);

-- Step 2: Get your user ID (replace with actual user ID or run this query first)
-- SELECT id FROM auth.users LIMIT 1;

-- Step 3: Create Week Bundle
-- IMPORTANT: Replace 'YOUR_USER_ID_HERE' with your actual user ID from auth.users
INSERT INTO week_bundles (
  user_id,
  course_code,
  course_name,
  institution,
  week_number,
  week_topic,
  aggregated_content,
  status
) VALUES (
  'YOUR_USER_ID_HERE',  -- ⚠️ REPLACE THIS
  'CSE 120',
  'Principles of Operating Systems',
  'UCSD',
  3,
  'Process Scheduling',
  '{
    "textbooks": [
      {
        "title": "Operating System Concepts",
        "authors": ["Abraham Silberschatz", "Peter Baer Galvin", "Greg Gagne"],
        "pages": [185, 220],
        "chapter": 5,
        "confidence": 0.95
      },
      {
        "title": "Modern Operating Systems",
        "authors": ["Andrew S. Tanenbaum", "Herbert Bos"],
        "pages": [73, 110],
        "chapter": 2,
        "confidence": 0.90
      }
    ],
    "slides": [
      {
        "title": "Week 3: Process Scheduling",
        "url": "https://cseweb.ucsd.edu/classes/sp24/cse120-a/lectures/week3-scheduling.pdf",
        "pages": 45,
        "professor": "Prof. Geoffrey Voelker",
        "confidence": 0.98
      }
    ],
    "homework": [
      {
        "assignment": "Problem Set 3",
        "problems": ["3.1", "3.2", "3.3", "3.4"],
        "url": "https://cseweb.ucsd.edu/classes/sp24/cse120-a/homework/ps3.pdf",
        "dueDate": "2024-02-15",
        "confidence": 0.92
      }
    ],
    "papers": [
      {
        "title": "The Linux Completely Fair Scheduler",
        "authors": ["Ingo Molnar"],
        "url": "https://www.kernel.org/doc/Documentation/scheduler/sched-design-CFS.txt",
        "year": 2023,
        "venue": "Linux Kernel Documentation",
        "confidence": 0.88
      },
      {
        "title": "Lottery Scheduling",
        "authors": ["Carl A. Waldspurger", "William E. Weihl"],
        "url": "https://www.usenix.org/legacy/publications/library/proceedings/osdi/full_papers/waldspurger.pdf",
        "year": 1994,
        "venue": "OSDI",
        "confidence": 0.85
      }
    ],
    "parallelRunId": "manual-setup",
    "aggregatedAt": "2024-10-26T00:00:00Z"
  }'::jsonb,
  'active'
) 
ON CONFLICT (user_id, course_code, institution, week_number) 
DO UPDATE SET 
  updated_at = NOW(),
  aggregated_content = EXCLUDED.aggregated_content
RETURNING id;

-- Step 4: Get the bundle ID that was just created
-- SELECT id FROM week_bundles 
-- WHERE course_code = 'CSE 120' AND week_number = 3 
-- ORDER BY created_at DESC LIMIT 1;

-- Step 5: Create content items
-- IMPORTANT: Replace 'YOUR_BUNDLE_ID_HERE' with the bundle ID from step 4

-- Textbook 1: Silberschatz
INSERT INTO content_items (
  week_bundle_id,
  content_type,
  title,
  source_url,
  metadata,
  confidence_score,
  display_order,
  extraction_status
) VALUES (
  'YOUR_BUNDLE_ID_HERE',  -- ⚠️ REPLACE THIS
  'textbook',
  'Operating System Concepts - Chapter 5: CPU Scheduling',
  'https://www.os-book.com/OS10/slide-dir/PPTX-dir/ch5.pptx',
  '{"authors": ["Abraham Silberschatz", "Peter Baer Galvin", "Greg Gagne"], "pages": [185, 220], "chapter": 5}'::jsonb,
  0.95,
  0,
  'pending'
) ON CONFLICT DO NOTHING;

-- Textbook 2: Tanenbaum
INSERT INTO content_items (
  week_bundle_id,
  content_type,
  title,
  source_url,
  metadata,
  confidence_score,
  display_order,
  extraction_status
) VALUES (
  'YOUR_BUNDLE_ID_HERE',  -- ⚠️ REPLACE THIS
  'textbook',
  'Modern Operating Systems - Chapter 2: Processes and Threads',
  'https://csc-knu.github.io/sys-prog/books/Andrew%20S.%20Tanenbaum%20-%20Modern%20Operating%20Systems.pdf',
  '{"authors": ["Andrew S. Tanenbaum", "Herbert Bos"], "pages": [73, 110], "chapter": 2}'::jsonb,
  0.90,
  1,
  'pending'
) ON CONFLICT DO NOTHING;

-- Slides
INSERT INTO content_items (
  week_bundle_id,
  content_type,
  title,
  source_url,
  metadata,
  confidence_score,
  display_order,
  extraction_status
) VALUES (
  'YOUR_BUNDLE_ID_HERE',  -- ⚠️ REPLACE THIS
  'slides',
  'Week 3: Process Scheduling Lecture Slides',
  'https://cseweb.ucsd.edu/classes/sp24/cse120-a/lectures/lec5-sched.pdf',
  '{"pages": 45, "professor": "Prof. Geoffrey Voelker"}'::jsonb,
  0.98,
  2,
  'pending'
) ON CONFLICT DO NOTHING;

-- Homework
INSERT INTO content_items (
  week_bundle_id,
  content_type,
  title,
  source_url,
  metadata,
  confidence_score,
  display_order,
  extraction_status
) VALUES (
  'YOUR_BUNDLE_ID_HERE',  -- ⚠️ REPLACE THIS
  'homework',
  'Problem Set 3: CPU Scheduling',
  'https://cseweb.ucsd.edu/classes/sp24/cse120-a/homework.html',
  '{"problems": ["3.1", "3.2", "3.3", "3.4"], "dueDate": "2024-02-15"}'::jsonb,
  0.92,
  3,
  'pending'
) ON CONFLICT DO NOTHING;

-- Paper 1: Linux CFS
INSERT INTO content_items (
  week_bundle_id,
  content_type,
  title,
  source_url,
  metadata,
  confidence_score,
  display_order,
  extraction_status
) VALUES (
  'YOUR_BUNDLE_ID_HERE',  -- ⚠️ REPLACE THIS
  'paper',
  'The Linux Completely Fair Scheduler',
  'https://www.kernel.org/doc/Documentation/scheduler/sched-design-CFS.txt',
  '{"authors": ["Ingo Molnar"], "year": 2023, "venue": "Linux Kernel Documentation"}'::jsonb,
  0.88,
  4,
  'pending'
) ON CONFLICT DO NOTHING;

-- Paper 2: Lottery Scheduling
INSERT INTO content_items (
  week_bundle_id,
  content_type,
  title,
  source_url,
  metadata,
  confidence_score,
  display_order,
  extraction_status
) VALUES (
  'YOUR_BUNDLE_ID_HERE',  -- ⚠️ REPLACE THIS
  'paper',
  'Lottery Scheduling: Flexible Proportional-Share Resource Management',
  'https://www.usenix.org/legacy/publications/library/proceedings/osdi/full_papers/waldspurger.pdf',
  '{"authors": ["Carl A. Waldspurger", "William E. Weihl"], "year": 1994, "venue": "OSDI"}'::jsonb,
  0.85,
  5,
  'pending'
) ON CONFLICT DO NOTHING;

-- Step 6: Verify everything was created
SELECT 
  wb.course_code,
  wb.week_number,
  wb.week_topic,
  COUNT(ci.id) as content_items_count
FROM week_bundles wb
LEFT JOIN content_items ci ON ci.week_bundle_id = wb.id
WHERE wb.course_code = 'CSE 120' AND wb.week_number = 3
GROUP BY wb.id, wb.course_code, wb.week_number, wb.week_topic;

-- View all content items
SELECT 
  title,
  content_type,
  extraction_status,
  CASE 
    WHEN extracted_text IS NOT NULL THEN LENGTH(extracted_text) || ' chars'
    ELSE 'Not extracted'
  END as text_status
FROM content_items ci
JOIN week_bundles wb ON wb.id = ci.week_bundle_id
WHERE wb.course_code = 'CSE 120' AND wb.week_number = 3
ORDER BY ci.display_order;


