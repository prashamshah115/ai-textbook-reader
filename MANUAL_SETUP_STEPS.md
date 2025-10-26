# CSE 120 Week 3 - Manual Setup Steps

## Prerequisites
- Supabase database running
- Environment variables configured (.env file)
- Dev server running (`npm run dev`)

---

## Step 1: Update Database Schema

**Option A: Via Supabase Dashboard**
1. Go to Supabase Dashboard → SQL Editor
2. Paste and run:

```sql
ALTER TABLE content_items 
  ADD COLUMN IF NOT EXISTS extracted_text TEXT,
  ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS extraction_error TEXT,
  ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_content_items_extraction_status
  ON content_items(extraction_status);
```

**Option B: Via psql Command Line**
```bash
psql $DATABASE_URL -f schema-updates.sql
```

---

## Step 2: Scrape CSE 120 Course Page

```bash
cd scripts

# Activate Python virtual environment
source venv/bin/activate

# Scrape Week 3 content
python3 scrape-cse120.py --week 3 --output week3_real_data.json

# Verify output
cat week3_real_data.json | jq .
```

**Expected Output:**
```json
{
  "courseCode": "CSE 120",
  "institution": "UCSD",
  "weekNumber": 3,
  "weekTopic": "Process Scheduling",
  "aggregatedContent": {
    "textbooks": [...],
    "slides": [...],
    "homework": [...],
    "papers": [...]
  }
}
```

---

## Step 3: Create Week Bundle via API

```bash
curl -X POST http://localhost:3000/api/week/aggregate-content \
  -H 'Content-Type: application/json' \
  -d @week3_real_data.json | jq .
```

**Save the `bundleId` from the response!**

Example response:
```json
{
  "bundleId": "abc123-def456-...",
  "message": "Week bundle created successfully",
  "itemsCount": 7,
  "extractionStatus": "queued"
}
```

---

## Step 4: Monitor Extraction Status

**Via Supabase Dashboard:**
```sql
SELECT 
  title,
  content_type,
  extraction_status,
  LENGTH(extracted_text) as text_length,
  extracted_at
FROM content_items
WHERE week_bundle_id = 'YOUR_BUNDLE_ID'
ORDER BY display_order;
```

**Via API:**
```bash
# Check status
curl http://localhost:3000/api/job-status?bundleId=YOUR_BUNDLE_ID | jq .
```

**Wait for all items to show `extraction_status = 'completed'`**

This typically takes 30-60 seconds depending on content size.

---

## Step 5: Generate Auto-Notes

```bash
curl -X POST http://localhost:3000/api/week/generate-notes \
  -H 'Content-Type: application/json' \
  -d '{"bundleId": "YOUR_BUNDLE_ID"}' | jq .
```

**Expected Response:**
```json
{
  "success": true,
  "notes": "# Week 3: Process Scheduling\n\n## Overview...",
  "message": "Auto-notes generated successfully"
}
```

---

## Step 6: Test the Sprint System

### A. View Sprint Dashboard
1. Open browser: `http://localhost:3000`
2. Click "Enter Application" (or skip landing page)
3. You should see the Sprint Dashboard with CSE 120 Week 3 card

### B. View Sprint Detail
1. Click on the CSE 120 Week 3 card
2. See 7-day breakdown, sources, and auto-notes
3. Click "Start Reading" button

### C. Test Reading Experience
1. In the Enhanced PDF Reader:
   - Left sidebar: Daily topics + Materials
   - Center: PDF viewer (select a material)
   - Right: AI Pane (Notes, Recall, Chat tabs)

### D. Test AI Features

**Test Chat:**
```bash
curl -X POST http://localhost:3000/api/week/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "bundleId": "YOUR_BUNDLE_ID",
    "message": "What is the difference between FCFS and SJF scheduling?"
  }'
```

**Test Inline Explanation:**
1. Select text in PDF viewer
2. Tooltip should appear with AI explanation
3. Uses extracted text for context

---

## Step 7: Batch Extract (Optional)

If you have multiple bundles and want to extract all pending items:

```bash
cd scripts
npm run extract-all
# OR
ts-node extract-all-content.ts
```

---

## Verification Checklist

- [ ] Database schema updated (4 new columns on content_items)
- [ ] Week bundle created (bundleId saved)
- [ ] All content items extracted (status = 'completed')
- [ ] Auto-notes generated and stored
- [ ] Sprint Dashboard shows CSE 120 Week 3
- [ ] Sprint Detail page displays correctly
- [ ] Enhanced PDF Reader opens with 3-column layout
- [ ] Chat uses extracted text (responses mention specific sources)
- [ ] Inline explanations work on text selection
- [ ] Progress tracking updates when completing daily sessions

---

## Troubleshooting

### Extraction Stuck at 'pending'
```bash
# Check extraction API logs
# Re-trigger extraction for specific item:
curl -X POST http://localhost:3000/api/extract-content \
  -H 'Content-Type: application/json' \
  -d '{"contentItemId": "ITEM_ID"}'
```

### Auto-Notes Fails
- Ensure extraction is complete first (all items status = 'completed')
- Check OPENAI_API_KEY is set
- Verify extracted_text is not empty

### Chat Not Using Extracted Text
- Check console logs for "AVAILABLE COURSE MATERIALS"
- Verify content_items have extracted_text populated
- Check extraction_status = 'completed'

### UI Not Showing Sprint Views
- Verify SprintProvider wraps App in main.tsx
- Check viewMode state in SprintContext
- Ensure loadSprint() was called successfully

---

## Quick Test Commands

```bash
# 1. Create bundle
BUNDLE_ID=$(curl -s -X POST http://localhost:3000/api/week/aggregate-content \
  -H 'Content-Type: application/json' \
  -d @scripts/week3_real_data.json | jq -r '.bundleId')

echo "Bundle ID: $BUNDLE_ID"

# 2. Wait 30 seconds for extraction
sleep 30

# 3. Generate notes
curl -X POST http://localhost:3000/api/week/generate-notes \
  -H 'Content-Type: application/json' \
  -d "{\"bundleId\": \"$BUNDLE_ID\"}" | jq .

# 4. Test chat
curl -X POST http://localhost:3000/api/week/chat \
  -H 'Content-Type: application/json' \
  -d "{\"bundleId\": \"$BUNDLE_ID\", \"message\": \"Explain Round Robin scheduling\"}"

echo ""
echo "✅ Setup complete! Open http://localhost:3000"
```

---

## Database Queries for Debugging

```sql
-- Check all bundles
SELECT id, course_code, week_number, week_topic, status 
FROM week_bundles 
ORDER BY created_at DESC;

-- Check content items for a bundle
SELECT 
  title,
  content_type,
  extraction_status,
  CASE 
    WHEN extracted_text IS NOT NULL 
    THEN CONCAT(LENGTH(extracted_text), ' chars')
    ELSE 'NULL'
  END as text_info
FROM content_items
WHERE week_bundle_id = 'YOUR_BUNDLE_ID'
ORDER BY display_order;

-- Check extraction statistics
SELECT 
  extraction_status,
  COUNT(*) as count,
  AVG(LENGTH(extracted_text)) as avg_length
FROM content_items
GROUP BY extraction_status;
```

