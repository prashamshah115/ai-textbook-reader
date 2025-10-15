// 🔥 PHASE 2: Priority Queue Worker - Polls Supabase jobs table
import { createClient } from '@supabase/supabase-js';
import pdfParse from 'pdf-parse';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const API_BASE_URL = process.env.API_BASE_URL || 'https://ai-textbook-reader-design.vercel.app';

console.log('[Worker] Starting queue worker...');
console.log('[Worker] API_BASE_URL:', API_BASE_URL);

// Main job processing loop
async function processJobs() {
  console.log('[Worker] Polling for jobs...');

  while (true) {
    try {
      // Fetch next job (priority 1 first, then 2, then 3, oldest first)
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'queued')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) {
        console.error('[Worker] Query error:', error);
        await sleep(5000);
        continue;
      }

      if (!jobs || jobs.length === 0) {
        // No jobs, wait 2s and poll again
        await sleep(2000);
        continue;
      }

      const job = jobs[0];
      console.log(`\n[Worker] 🔥 Processing job ${job.id}`);
      console.log(`[Worker] Type: ${job.job_type}, Priority: ${job.priority}, Key: ${job.job_key}`);

      // Mark as processing
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
          attempts: job.attempts + 1,
        })
        .eq('id', job.id);

      if (updateError) {
        console.error('[Worker] Failed to mark job as processing:', updateError);
        await sleep(2000);
        continue;
      }

      // Route to handler
      try {
        const startTime = Date.now();

        if (job.job_type === 'extract_page') {
          await handleExtractPage(job);
        } else if (job.job_type === 'generate_ai') {
          await handleGenerateAI(job);
        } else if (job.job_type === 'extract_and_ai') {
          await handleExtractAndAI(job);
        } else {
          throw new Error(`Unknown job type: ${job.job_type}`);
        }

        const duration = Date.now() - startTime;
        console.log(`[Worker] ✅ Job ${job.id} completed in ${duration}ms`);

        // Mark as completed
        await supabase
          .from('jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);

      } catch (error) {
        console.error(`[Worker] ❌ Job ${job.id} failed:`, error);

        // Check if we should retry
        if (job.attempts < job.max_attempts) {
          // Exponential backoff - requeue with delay
          const delay = Math.min(1000 * Math.pow(2, job.attempts), 30000);
          console.log(`[Worker] 🔄 Retrying job ${job.id} in ${delay}ms (attempt ${job.attempts + 1}/${job.max_attempts})`);

          await sleep(delay);

          await supabase
            .from('jobs')
            .update({
              status: 'queued',
              error: error.message,
            })
            .eq('id', job.id);
        } else {
          // Max attempts reached, mark as failed
          console.log(`[Worker] 💀 Job ${job.id} failed permanently (max attempts exceeded)`);

          await supabase
            .from('jobs')
            .update({
              status: 'failed',
              error: error.message,
              completed_at: new Date().toISOString(),
            })
            .eq('id', job.id);
        }
      }

    } catch (error) {
      console.error('[Worker] Poll loop error:', error);
      await sleep(5000);
    }
  }
}

// Extract single page text
async function handleExtractPage(job) {
  const { textbookId, pageNumber, pdfUrl } = job.payload;

  console.log(`[ExtractPage] Textbook: ${textbookId}, Page: ${pageNumber}`);

  // Check cache first
  const { data: existing } = await supabase
    .from('pages')
    .select('id, raw_text')
    .eq('textbook_id', textbookId)
    .eq('page_number', pageNumber)
    .maybeSingle();

  if (existing?.raw_text) {
    console.log(`[ExtractPage] ✓ Page ${pageNumber} already cached`);
    return;
  }

  if (!pdfUrl) {
    throw new Error('Missing pdfUrl in payload');
  }

  // Download PDF with timeout
  console.log(`[ExtractPage] Downloading PDF...`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  const response = await fetch(pdfUrl, { signal: controller.signal });
  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  console.log(`[ExtractPage] Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);

  // Extract text using pdf-parse
  console.log(`[ExtractPage] Extracting text from page ${pageNumber}...`);
  const pdf = await pdfParse(buffer, { max: pageNumber });
  const pages = pdf.text.split('\f');
  const pageIndex = pageNumber - 1;

  if (pageIndex < 0 || pageIndex >= pages.length) {
    throw new Error(`Invalid page number. PDF has ${pages.length} pages.`);
  }

  const pageText = pages[pageIndex]?.trim() || '[No extractable text detected. This may be a scanned image.]';
  console.log(`[ExtractPage] Extracted ${pageText.length} characters`);

  // Save to DB (upsert to handle race conditions)
  const { error: upsertError } = await supabase
    .from('pages')
    .upsert({
      textbook_id: textbookId,
      page_number: pageNumber,
      raw_text: pageText,
      processed: false,
    }, {
      onConflict: 'textbook_id,page_number',
    });

  if (upsertError) {
    console.error('[ExtractPage] Upsert error:', upsertError);
    // Don't throw - job succeeded even if save failed
  }

  console.log(`[ExtractPage] ✓ Page ${pageNumber} cached successfully`);
}

// Generate AI content for page
async function handleGenerateAI(job) {
  const { textbookId, pageNumber } = job.payload;

  console.log(`[GenerateAI] Textbook: ${textbookId}, Page: ${pageNumber}`);

  // Get page text
  const { data: page, error: pageError } = await supabase
    .from('pages')
    .select('id, raw_text')
    .eq('textbook_id', textbookId)
    .eq('page_number', pageNumber)
    .maybeSingle();

  if (pageError || !page) {
    throw new Error(`Page not found: ${pageError?.message || 'No data'}`);
  }

  if (!page.raw_text) {
    throw new Error('Page has no text - cannot generate AI content');
  }

  // Call Vercel API to generate AI content
  console.log(`[GenerateAI] Calling API to generate content...`);
  const response = await fetch(`${API_BASE_URL}/api/generate-page-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pageId: page.id,
      pageText: page.raw_text,
      pageNumber: pageNumber,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI generation failed: HTTP ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log(`[GenerateAI] ✓ Generated AI content for page ${pageNumber}`);
}

// Extract + generate AI (combined)
async function handleExtractAndAI(job) {
  console.log(`[ExtractAndAI] Running combined extraction + AI generation`);
  await handleExtractPage(job);
  await handleGenerateAI(job);
}

// Helper function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start worker
console.log('[Worker] 🚀 Queue worker started successfully');
processJobs().catch(err => {
  console.error('[Worker] 💥 Fatal error:', err);
  process.exit(1);
});

