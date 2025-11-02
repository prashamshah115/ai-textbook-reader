# Week Bundle System - Setup Guide

## 🚀 Quick Start

Follow these steps to get the Week Bundle system running:

### 1. Install Dependencies

```bash
npm install react-router-dom @anthropic-ai/sdk
```

### 2. Set Environment Variables

Add these to your `.env` file (or Vercel/Railway environment):

```bash
# Parallel AI (for content aggregation)
PARALLEL_API_KEY=your_parallel_api_key_here

# Anthropic Claude (for multi-source AI chat)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Existing variables (should already be set)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Run Database Migration

1. Open Supabase SQL Editor
2. Copy the contents of `schema-week-bundles.sql`
3. Paste and execute
4. Verify success messages appear

### 4. Test Parallel Aggregation

```bash
npx tsx scripts/test-parallel.ts
```

You should see output showing materials found for CSE 120 Week 3.

### 5. Start Development Server

```bash
npm run dev
```

### 6. Access Week Bundle

Navigate to: `http://localhost:5173/week/demo-cse120-week3`

Or click the "CSE 120 Week 3" button in the header.

---

## 🧪 Testing the System

### Test 1: View Materials Catalog
- Navigate to `/week/demo-cse120-week3`
- You should see a list of materials grouped by type:
  - Textbooks (2)
  - Slides (1)
  - Homework (1)
  - Papers (3)

### Test 2: View Different Content Types
- Click on each material in the catalog
- Verify the viewer switches correctly
- Check that metadata displays (authors, pages, etc.)

### Test 3: Content-Aware Chat
- Ask: "What is Round Robin scheduling?"
- AI should reference:
  - Textbook pages
  - Lecture slides
  - Homework problems
  - Research papers

### Test 4: Generate Notes
- View any material
- Generate notes
- Check that notes cross-reference other materials

### Test 5: Navigation
- Click "CSE 120 Week 3" in header → goes to week bundle
- Click browser back → returns to main app
- Verify main textbook reader still works

---

## 📋 Creating Your First Real Week Bundle

### Option A: Via API

```bash
curl -X POST http://localhost:5173/api/week/aggregate-content \
  -H "Content-Type: application/json" \
  -d '{
    "courseCode": "CSE 120",
    "institution": "UCSD",
    "weekNumber": 3,
    "weekTopic": "Process Scheduling",
    "userId": "YOUR_USER_ID_HERE"
  }'
```

Get your `userId` from:
1. Sign in to the app
2. Open browser console
3. Run: `localStorage.getItem('supabase.auth.token')`
4. Extract user ID from the JWT token

### Option B: Manual Database Insert

```sql
-- Insert week bundle
INSERT INTO week_bundles (
  user_id,
  course_code,
  course_name,
  institution,
  week_number,
  week_topic,
  aggregated_content
) VALUES (
  'YOUR_USER_ID',
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
    "parallelRunId": "manual",
    "aggregatedAt": "2024-01-01T00:00:00Z"
  }'::jsonb
);

-- Get the bundle ID
SELECT id FROM week_bundles 
WHERE user_id = 'YOUR_USER_ID' 
  AND course_code = 'CSE 120' 
  AND week_number = 3;

-- Insert content items
INSERT INTO content_items (week_bundle_id, content_type, title, metadata)
VALUES 
  ('BUNDLE_ID', 'textbook', 'Operating System Concepts', '{"chapter": 5, "pages": [185, 220]}'::jsonb),
  ('BUNDLE_ID', 'slides', 'Week 3 Slides', '{"pages": 45}'::jsonb);
```

---

## 🔧 Troubleshooting

### Issue: "Cannot find module 'react-router-dom'"
**Solution:** Run `npm install react-router-dom`

### Issue: "PARALLEL_API_KEY not configured"
**Solution:** 
- The system will use mock data if Parallel API key is not set
- This is fine for development/testing
- For production, get a key from https://parallel.ai

### Issue: Week bundle page shows "Bundle not found"
**Solution:**
- Ensure you've run the database migration
- Check that the bundle ID in the URL exists in the database
- For demo, use: `/week/demo-cse120-week3`

### Issue: PDFs not loading in ContentViewer
**Solution:**
- PDFs require URLs to be accessible
- Mock data includes sample URLs
- For real materials, ensure `source_url` is valid

### Issue: AI chat not working
**Solution:**
- Check `ANTHROPIC_API_KEY` is set
- Verify API key has sufficient credits
- Check browser console for API errors

---

## 📂 File Structure

```
New Files:
├── src/
│   ├── lib/
│   │   └── parallel.ts
│   ├── contexts/
│   │   └── WeekBundleContext.tsx
│   └── components/
│       └── week/
│           ├── WeekBundleView.tsx
│           ├── ContentCatalog.tsx
│           └── ContentViewer.tsx
├── api/
│   └── week/
│       ├── aggregate-content.ts
│       ├── chat.ts
│       └── generate-notes.ts
├── scripts/
│   └── test-parallel.ts
└── schema-week-bundles.sql

Modified Files:
├── src/
│   ├── main.tsx (added routing)
│   └── components/
│       └── MinimalHeader.tsx (added link)
```

---

## 🎯 What's Next?

### Immediate Next Steps:
1. ✅ Test the system end-to-end
2. ✅ Create a real week bundle for your course
3. ✅ Try the multi-source AI chat
4. ✅ Generate notes that cross-reference materials

### Future Enhancements:
- [ ] Add UI to create bundles (no API calls needed)
- [ ] Support multiple weeks/courses
- [ ] Add PDF upload for missing materials
- [ ] Implement search across all materials
- [ ] Add bookmarking/favorites

---

## 💡 Tips

**For Best Results:**
1. Use real course codes that Parallel AI can find online
2. The more specific the week topic, the better the results
3. Mock data is available for CSE 120 Week 3 for testing
4. Cross-reference checking works best with complete metadata

**Cost Optimization:**
1. Week bundles are created once (one-time cost)
2. Chat and notes are charged per use
3. Use mock data during development to save API costs
4. Cache Parallel results to avoid re-aggregation

**Development Workflow:**
1. Test with mock data first (no API keys needed)
2. Add API keys when ready for real data
3. Use the test script to verify Parallel integration
4. Create bundles via API for automation

---

## 📞 Support

**Documentation:**
- Full implementation: `SPRINT_SYSTEM_ROADMAP.md`
- Implementation plan: `week-bundle-system.plan.md`
- Database schema: `schema-week-bundles.sql`

**Common Issues:**
- Check console for errors
- Verify environment variables are set
- Ensure database migration ran successfully
- Confirm React Router is installed

**Need Help?**
- Review the troubleshooting section above
- Check Supabase logs for database errors
- Verify API keys are valid and have credits

---

✅ **Setup Complete!** You're ready to use the Week Bundle system.



