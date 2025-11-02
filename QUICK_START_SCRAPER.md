# 🚀 Quick Start: CSE 120 Scraper

**Goal:** Scrape the real CSE 120 course page and see what materials get extracted.

---

## ⚡ Fast Path (5 minutes)

### Step 1: Install Python Dependencies
```bash
cd scripts
pip install -r requirements.txt
```

### Step 2: Run the Scraper (Without Parallel AI)
```bash
python scrape-cse120.py --week 3 --no-enrich
```

**What this does:**
- Scrapes https://cseweb.ucsd.edu/classes/fa25/cse120-a/
- Extracts Week 3 links (textbooks, slides, homework)
- Uses fallback research papers
- Saves to `week3_real_data.json`
- **FREE** (no API calls)

### Step 3: Check the Output
```bash
cat week3_real_data.json
```

You'll see JSON with:
- Textbook chapters found
- Lecture slides found
- Homework assignments
- Research papers (fallback list)

### Step 4: Review Example
```bash
cat example_output.json
```

This shows what the structure should look like.

---

## 🤖 Full Path (with Parallel AI enrichment)

### Prerequisites
1. Get a Parallel AI API key from https://parallel.ai
2. Create `scripts/.env`:
   ```bash
   PARALLEL_API_KEY=your_key_here
   ```

### Run with Enrichment
```bash
python scrape-cse120.py --week 3
```

**What this does:**
- Everything from Fast Path, PLUS:
- Calls Parallel AI to enrich each resource
- Finds current research papers automatically
- Adds summaries and metadata
- **Cost:** ~$1-2 per run

---

## 📊 What You'll See

When you run the scraper:

```
============================================================
CSE 120 Course Scraper with Parallel AI Enrichment
============================================================
🔍 Scraping CSE 120 course page for Week 3...
✅ Found Week 3 in course page
📚 Found 2 textbook links
📊 Found 1 slide links
📝 Found 1 homework links
📄 Found 0 paper links

🤖 Enriching resources with Parallel AI...
  📖 Enriching textbook: Silberschatz Chapter 5...
  📊 Enriching slides: Week 3 Lecture Slides...
  📝 Enriching homework: Problem Set 3...
  
🔬 Finding research papers on 'Process Scheduling'...

✅ Enrichment complete!
💾 Saved to: week3_real_data.json

============================================================
SUMMARY
============================================================
Course: CSE 120 - Week 3
Topic: Process Scheduling
Textbooks: 2
Slides: 1
Homework: 1
Papers: 3

✅ Scraping complete!
```

---

## 🎯 Expected Output

Your `week3_real_data.json` will have this structure:

```json
{
  "courseCode": "CSE 120",
  "institution": "UCSD",
  "weekNumber": 3,
  "weekTopic": "Process Scheduling",
  "aggregatedContent": {
    "textbooks": [
      {
        "title": "Silberschatz Chapter 5",
        "url": "https://...",
        "authors": ["Abraham Silberschatz", ...],
        "pages": [185, 220],
        "chapter": 5,
        "confidence": 0.85
      }
    ],
    "slides": [...],
    "homework": [...],
    "papers": [...]
  }
}
```

---

## 🔧 Troubleshooting

### "Module not found: requests"
```bash
pip install requests beautifulsoup4 lxml python-dotenv
```

### "No schedule table found"
- Course page structure may have changed
- Scraper will use fallback data
- Output will still be valid
- You can manually add real URLs later

### Want to try different weeks?
```bash
python scrape-cse120.py --week 4
python scrape-cse120.py --week 5
```

---

## 📋 Next Steps After Scraping

### Option A: Just View the Data
```bash
# Pretty print the JSON
python -m json.tool week3_real_data.json
```

### Option B: Import to Database (Later)
Once you've run the database schema:
```bash
curl -X POST http://localhost:5173/api/week/aggregate-content \
  -H "Content-Type: application/json" \
  --data @week3_real_data.json
```

### Option C: Edit the Data
Open `week3_real_data.json` and:
- Fix any incorrect URLs
- Add missing materials
- Adjust confidence scores
- Then import to database

---

## 💡 Pro Tips

1. **Start with --no-enrich** to test scraping without API costs
2. **Check example_output.json** to see the expected format
3. **Edit URLs manually** if scraper misses something
4. **Run for multiple weeks** to build a full course library

---

## 📝 Summary

**To see results right now:**
```bash
cd scripts
pip install -r requirements.txt
python scrape-cse120.py --week 3 --no-enrich
cat week3_real_data.json
```

That's it! You'll have real scraped data from the CSE 120 course page.

---

**Need help?** Check `scripts/SCRAPER_README.md` for full documentation.



