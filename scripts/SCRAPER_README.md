# CSE 120 Course Scraper

This scraper extracts Week 3 materials from the actual CSE 120 course page and optionally enriches them with Parallel AI.

## Setup

### 1. Install Python Dependencies

```bash
cd scripts
pip install -r requirements.txt
```

### 2. Set Environment Variables (Optional)

Create a `.env` file in the scripts directory:

```bash
PARALLEL_API_KEY=your_parallel_api_key_here
```

**Note:** If you don't have a Parallel API key, the scraper will still work but use fallback data instead of real Parallel enrichment.

## Usage

### Basic Scraping (No Parallel Enrichment)

```bash
python scrape-cse120.py --week 3 --no-enrich
```

This will:
- Scrape the CSE 120 course page
- Extract links for textbooks, slides, homework
- Use fallback research papers
- Save to `week3_real_data.json`

### Full Scraping with Parallel AI Enrichment

```bash
python scrape-cse120.py --week 3
```

This will:
- Scrape the CSE 120 course page
- Use Parallel AI to enrich each resource
- Find relevant research papers automatically
- Save to `week3_real_data.json`

### Custom Output File

```bash
python scrape-cse120.py --week 3 --output my_custom_file.json
```

## Output Format

The scraper outputs JSON in this format:

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
        "authors": ["Abraham Silberschatz", "Peter Baer Galvin", "Greg Gagne"],
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

## What Gets Scraped

The scraper looks for Week 3 in the course schedule table and extracts:

- **Textbook chapters** - Links with "chapter", "textbook", or "reading" in the text
- **Lecture slides** - Links with "slide" or lecture PDFs
- **Homework** - Links with "homework", "assignment", "project"
- **Research papers** - Found via Parallel AI based on the week's topic

## Fallback Behavior

If the scraper can't find Week 3 on the course page, it will:
1. Use example URLs
2. Still structure the data correctly
3. Include default research papers

This ensures you always get valid JSON output.

## Next Steps

After running the scraper:

1. **Review the output:**
   ```bash
   cat week3_real_data.json
   ```

2. **Import to database** (once you've run the schema):
   ```bash
   curl -X POST http://localhost:5173/api/week/aggregate-content \
     -H "Content-Type: application/json" \
     --data @week3_real_data.json
   ```

## Troubleshooting

### "No schedule table found"
- The CSE 120 page structure may have changed
- Scraper will use fallback data
- Output will still be valid

### "Parallel API error"
- Check your `PARALLEL_API_KEY` in `.env`
- Or use `--no-enrich` flag to skip Parallel
- Scraper will use fallback papers

### "Module not found"
- Run `pip install -r requirements.txt`
- Make sure you're in the `scripts` directory

## Cost Estimates

With Parallel AI enrichment:
- ~$0.10 per resource enrichment
- ~$0.30 for research paper finding
- **Total: ~$1-2 per week** (depending on number of resources)

Without Parallel (--no-enrich):
- **Free** (just web scraping)


