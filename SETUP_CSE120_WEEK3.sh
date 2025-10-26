#!/bin/bash
# ================================================
# CSE 120 Week 3 - Complete Database Setup
# Run this script to set up everything
# ================================================

set -e  # Exit on error

echo "================================================"
echo "CSE 120 Week 3 - Database Setup Script"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL not set${NC}"
    echo "Please set your Supabase connection string:"
    echo "  export DATABASE_URL='postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres'"
    exit 1
fi

echo -e "${BLUE}Step 1: Applying database schema updates...${NC}"
echo ""

psql "$DATABASE_URL" << 'EOF'
-- Add extraction columns to content_items
ALTER TABLE content_items 
  ADD COLUMN IF NOT EXISTS extracted_text TEXT,
  ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS extraction_error TEXT,
  ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ;

-- Add index for efficient status queries
CREATE INDEX IF NOT EXISTS idx_content_items_extraction_status
  ON content_items(extraction_status);

-- Verify the changes
\echo '✓ Schema updated successfully'
\echo ''
\echo 'Verifying columns...'
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'content_items' 
  AND column_name IN ('extracted_text', 'extraction_status', 'extraction_error', 'extracted_at');
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database schema updated${NC}"
else
    echo -e "${RED}✗ Schema update failed${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 2: Creating CSE 120 Week 3 bundle...${NC}"
echo ""

# Get user ID from database
USER_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM auth.users LIMIT 1;" | xargs)

if [ -z "$USER_ID" ]; then
    echo -e "${RED}ERROR: No user found in database${NC}"
    echo "Please create a user account first"
    exit 1
fi

echo "Using user ID: $USER_ID"
echo ""

# Create the week bundle directly in database
psql "$DATABASE_URL" << EOF
-- Insert Week Bundle
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
  '$USER_ID',
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
        "title": "Lottery Scheduling: Flexible Proportional-Share Resource Management",
        "authors": ["Carl A. Waldspurger", "William E. Weihl"],
        "url": "https://www.usenix.org/legacy/publications/library/proceedings/osdi/full_papers/waldspurger.pdf",
        "year": 1994,
        "venue": "OSDI",
        "confidence": 0.85
      }
    ],
    "parallelRunId": "manual-setup",
    "aggregatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  }'::jsonb,
  'active'
) 
ON CONFLICT (user_id, course_code, institution, week_number) 
DO UPDATE SET updated_at = NOW()
RETURNING id;
EOF

# Get the bundle ID
BUNDLE_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM week_bundles WHERE user_id = '$USER_ID' AND course_code = 'CSE 120' AND week_number = 3 ORDER BY created_at DESC LIMIT 1;" | xargs)

if [ -z "$BUNDLE_ID" ]; then
    echo -e "${RED}✗ Failed to create bundle${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Bundle created: $BUNDLE_ID${NC}"
echo ""

echo -e "${BLUE}Step 3: Creating content items...${NC}"
echo ""

# Create content items
psql "$DATABASE_URL" << EOF
-- Textbook 1: Silberschatz
INSERT INTO content_items (
  week_bundle_id,
  content_type,
  title,
  source_url,
  metadata,
  confidence_score,
  display_order
) VALUES (
  '$BUNDLE_ID',
  'textbook',
  'Operating System Concepts - Chapter 5',
  'https://www.os-book.com/OS10/slide-dir/PPTX-dir/ch5.pptx',
  '{"authors": ["Abraham Silberschatz", "Peter Baer Galvin", "Greg Gagne"], "pages": [185, 220], "chapter": 5}'::jsonb,
  0.95,
  0
) ON CONFLICT DO NOTHING;

-- Textbook 2: Tanenbaum
INSERT INTO content_items (
  week_bundle_id,
  content_type,
  title,
  source_url,
  metadata,
  confidence_score,
  display_order
) VALUES (
  '$BUNDLE_ID',
  'textbook',
  'Modern Operating Systems - Chapter 2',
  'https://csc-knu.github.io/sys-prog/books/Andrew%20S.%20Tanenbaum%20-%20Modern%20Operating%20Systems.pdf',
  '{"authors": ["Andrew S. Tanenbaum", "Herbert Bos"], "pages": [73, 110], "chapter": 2}'::jsonb,
  0.90,
  1
) ON CONFLICT DO NOTHING;

-- Slides
INSERT INTO content_items (
  week_bundle_id,
  content_type,
  title,
  source_url,
  metadata,
  confidence_score,
  display_order
) VALUES (
  '$BUNDLE_ID',
  'slides',
  'Week 3: Process Scheduling',
  'https://cseweb.ucsd.edu/classes/sp24/cse120-a/lectures/lec5-sched.pdf',
  '{"pages": 45, "professor": "Prof. Geoffrey Voelker"}'::jsonb,
  0.98,
  2
) ON CONFLICT DO NOTHING;

-- Homework
INSERT INTO content_items (
  week_bundle_id,
  content_type,
  title,
  source_url,
  metadata,
  confidence_score,
  display_order
) VALUES (
  '$BUNDLE_ID',
  'homework',
  'Problem Set 3',
  'https://cseweb.ucsd.edu/classes/sp24/cse120-a/homework.html',
  '{"problems": ["3.1", "3.2", "3.3", "3.4"], "dueDate": "2024-02-15"}'::jsonb,
  0.92,
  3
) ON CONFLICT DO NOTHING;

-- Paper 1: Linux CFS
INSERT INTO content_items (
  week_bundle_id,
  content_type,
  title,
  source_url,
  metadata,
  confidence_score,
  display_order
) VALUES (
  '$BUNDLE_ID',
  'paper',
  'The Linux Completely Fair Scheduler',
  'https://www.kernel.org/doc/Documentation/scheduler/sched-design-CFS.txt',
  '{"authors": ["Ingo Molnar"], "year": 2023, "venue": "Linux Kernel Documentation"}'::jsonb,
  0.88,
  4
) ON CONFLICT DO NOTHING;

-- Paper 2: Lottery Scheduling
INSERT INTO content_items (
  week_bundle_id,
  content_type,
  title,
  source_url,
  metadata,
  confidence_score,
  display_order
) VALUES (
  '$BUNDLE_ID',
  'paper',
  'Lottery Scheduling: Flexible Proportional-Share Resource Management',
  'https://www.usenix.org/legacy/publications/library/proceedings/osdi/full_papers/waldspurger.pdf',
  '{"authors": ["Carl A. Waldspurger", "William E. Weihl"], "year": 1994, "venue": "OSDI"}'::jsonb,
  0.85,
  5
) ON CONFLICT DO NOTHING;

\echo '✓ Content items created'
EOF

echo -e "${GREEN}✓ Content items created${NC}"
echo ""

# Show created content
echo -e "${BLUE}Created content items:${NC}"
psql "$DATABASE_URL" -c "SELECT title, content_type, extraction_status FROM content_items WHERE week_bundle_id = '$BUNDLE_ID' ORDER BY display_order;"

echo ""
echo -e "${YELLOW}Note: Content items are now in 'pending' status.${NC}"
echo -e "${YELLOW}Text extraction will happen when you trigger it via API or batch script.${NC}"
echo ""

echo "================================================"
echo -e "${GREEN}DATABASE SETUP COMPLETE!${NC}"
echo "================================================"
echo ""
echo "Bundle ID: $BUNDLE_ID"
echo ""
echo "Next steps:"
echo ""
echo "1. Extract text from content items:"
echo "   cd scripts && ts-node extract-all-content.ts"
echo ""
echo "2. Generate auto-notes (after extraction completes):"
echo "   curl -X POST http://localhost:3000/api/week/generate-notes \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"bundleId\": \"$BUNDLE_ID\"}'"
echo ""
echo "3. View in app:"
echo "   Open http://localhost:3000"
echo "   Navigate to Sprint Dashboard"
echo "   Click on CSE 120 - Week 3"
echo ""
echo "4. Test chat with extracted text:"
echo "   curl -X POST http://localhost:3000/api/week/chat \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"bundleId\": \"$BUNDLE_ID\", \"message\": \"Explain CPU scheduling algorithms\"}'"
echo ""

# Save bundle ID for later use
echo "$BUNDLE_ID" > .bundle_id
echo "Bundle ID saved to .bundle_id for easy reference"
echo ""

