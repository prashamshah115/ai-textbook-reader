#!/bin/bash
# ================================================
# CSE 120 Week 3 - Complete Setup Script
# ================================================

set -e  # Exit on error

echo "================================================"
echo "CSE 120 Week 3 - Sprint System Setup"
echo "================================================"

# 1. Apply database schema updates
echo ""
echo "Step 1: Applying database schema updates..."
echo "Run this SQL in your Supabase SQL Editor:"
echo ""
cat << 'EOF'
ALTER TABLE content_items 
  ADD COLUMN IF NOT EXISTS extracted_text TEXT,
  ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS extraction_error TEXT,
  ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_content_items_extraction_status
  ON content_items(extraction_status);
EOF

read -p "Press ENTER after running the SQL above..."

# 2. Scrape CSE 120 course page (if not already done)
echo ""
echo "Step 2: Scraping CSE 120 Week 3 content..."
cd scripts

# Activate Python venv if exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

python3 scrape-cse120.py --week 3 --output week3_real_data.json

echo "✓ Scraped course page data"

# 3. Create week bundle via API
echo ""
echo "Step 3: Creating week bundle..."

BUNDLE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/week/aggregate-content \
  -H 'Content-Type: application/json' \
  -d @week3_real_data.json)

BUNDLE_ID=$(echo $BUNDLE_RESPONSE | jq -r '.bundleId')

if [ "$BUNDLE_ID" == "null" ] || [ -z "$BUNDLE_ID" ]; then
    echo "❌ Failed to create bundle"
    echo "Response: $BUNDLE_RESPONSE"
    exit 1
fi

echo "✓ Created bundle: $BUNDLE_ID"

# Wait for extraction to start
echo ""
echo "Waiting 5 seconds for extraction to queue..."
sleep 5

# 4. Monitor extraction status
echo ""
echo "Step 4: Monitoring extraction status..."
echo "(This may take 1-2 minutes depending on content size)"
echo ""

MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    PENDING=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM content_items WHERE week_bundle_id = '$BUNDLE_ID' AND extraction_status = 'pending';")
    PROCESSING=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM content_items WHERE week_bundle_id = '$BUNDLE_ID' AND extraction_status = 'processing';")
    COMPLETED=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM content_items WHERE week_bundle_id = '$BUNDLE_ID' AND extraction_status = 'completed';")
    FAILED=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM content_items WHERE week_bundle_id = '$BUNDLE_ID' AND extraction_status = 'failed';")
    
    echo "Status: Pending=$PENDING, Processing=$PROCESSING, Completed=$COMPLETED, Failed=$FAILED"
    
    if [ $PENDING -eq 0 ] && [ $PROCESSING -eq 0 ]; then
        echo "✓ All extractions complete!"
        break
    fi
    
    sleep 5
    ATTEMPT=$((ATTEMPT + 1))
done

# 5. Generate auto-notes
echo ""
echo "Step 5: Generating auto-notes from extracted text..."

NOTES_RESPONSE=$(curl -s -X POST http://localhost:3000/api/week/generate-notes \
  -H 'Content-Type: application/json' \
  -d "{\"bundleId\": \"$BUNDLE_ID\"}")

NOTES_SUCCESS=$(echo $NOTES_RESPONSE | jq -r '.success')

if [ "$NOTES_SUCCESS" == "true" ]; then
    echo "✓ Auto-notes generated successfully"
else
    echo "⚠️  Auto-notes generation failed (may need to wait for extraction)"
    echo "Response: $NOTES_RESPONSE"
fi

# 6. Summary
echo ""
echo "================================================"
echo "SETUP COMPLETE!"
echo "================================================"
echo ""
echo "Bundle ID: $BUNDLE_ID"
echo ""
echo "Next steps:"
echo "1. Open your app at http://localhost:3000"
echo "2. Navigate to Sprint Dashboard"
echo "3. Click on CSE 120 - Week 3"
echo "4. Start reading!"
echo ""
echo "Test Chat:"
echo "  curl -X POST http://localhost:3000/api/week/chat \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"bundleId\": \"$BUNDLE_ID\", \"message\": \"Explain process scheduling\"}'"
echo ""

