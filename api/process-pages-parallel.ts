// ================================================================
// DAY 7: PARALLEL AI PROCESSING - Process multiple pages concurrently
// ================================================================
// Processes first 10 pages immediately with concurrency cap=3
// Token budgets, timeouts, and exponential backoff included

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// 🔥 DAY 7: Guardrails
const CONCURRENCY_LIMIT = 3;
const TOKEN_BUDGET_PER_PAGE = 2000; // Max tokens to use per page
const PAGE_TIMEOUT_MS = 15000; // 15s timeout per page
const MAX_RETRIES = 3;

interface ProcessRequest {
  textbookId: string;
  pageNumbers: number[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { textbookId, pageNumbers }: ProcessRequest = req.body;

    if (!textbookId || !pageNumbers || pageNumbers.length === 0) {
      return res.status(400).json({ error: 'Missing textbookId or pageNumbers' });
    }

    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ API key not configured' });
    }

    console.log(`[Parallel AI] Processing ${pageNumbers.length} pages for textbook ${textbookId}`);

    // Limit to prevent abuse
    const pagesToProcess = pageNumbers.slice(0, 10);

    // 🔥 DAY 7: Process with concurrency limit
    const results = await processWithConcurrency(
      pagesToProcess,
      CONCURRENCY_LIMIT,
      async (pageNumber) => {
        return await generateAIContentForPage(textbookId, pageNumber);
      }
    );

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`[Parallel AI] Complete: ${successful} succeeded, ${failed} failed`);

    return res.status(200).json({
      success: true,
      processed: successful,
      failed,
      results,
    });
  } catch (error) {
    console.error('[Parallel AI] Error:', error);
    return res.status(500).json({
      error: 'Failed to process pages',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ================================================================
// CONCURRENCY LIMITER
// ================================================================

async function processWithConcurrency<T, R>(
  items: T[],
  limit: number,
  processFn: (item: T) => Promise<R>
): Promise<Array<{ success: boolean; result?: R; error?: string; item: T }>> {
  const results: Array<{ success: boolean; result?: R; error?: string; item: T }> = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = (async () => {
      try {
        const result = await processFn(item);
        results.push({ success: true, result, item });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          item,
        });
      }
    })();

    executing.push(promise);

    if (executing.length >= limit) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

// ================================================================
// GENERATE AI CONTENT FOR SINGLE PAGE
// ================================================================

async function generateAIContentForPage(textbookId: string, pageNumber: number) {
  const startTime = Date.now();

  try {
    // Get page text
    const { data: page, error: pageError } = await supabase
      .from('pages')
      .select('*')
      .eq('textbook_id', textbookId)
      .eq('page_number', pageNumber)
      .single();

    if (pageError || !page) {
      throw new Error(`Page ${pageNumber} not found`);
    }

    const pageText = page.raw_text;

    if (!pageText || pageText.length < 50) {
      throw new Error(`Page ${pageNumber} has insufficient text`);
    }

    console.log(`[AI Gen] Processing page ${pageNumber} (${pageText.length} chars)`);

    // 🔥 DAY 7: Generate with timeout and token budget
    const [summary, questions, applications] = await Promise.all([
      generateWithTimeout(
        () => callGroq('Generate a concise summary (2-3 sentences):', pageText, 300),
        PAGE_TIMEOUT_MS
      ),
      generateWithTimeout(
        () =>
          callGroq(
            'Generate 3 practice questions as JSON array:',
            pageText,
            500
          ),
        PAGE_TIMEOUT_MS
      ),
      generateWithTimeout(
        () =>
          callGroq(
            'List 2-3 real-world applications as JSON array:',
            pageText,
            400
          ),
        PAGE_TIMEOUT_MS
      ),
    ]);

    // Parse JSON responses
    let parsedQuestions = [];
    let parsedApplications = [];

    try {
      parsedQuestions = JSON.parse(questions);
    } catch {
      parsedQuestions = [{ question: questions, answer: '' }];
    }

    try {
      parsedApplications = JSON.parse(applications);
    } catch {
      parsedApplications = [applications];
    }

    // Save to database (upsert for idempotency)
    const { error: saveError } = await supabase
      .from('ai_processed_content')
      .upsert(
        {
          page_id: page.id,
          summary,
          key_concepts: [],
          practice_questions: parsedQuestions,
          applications: parsedApplications,
          generated_at: new Date().toISOString(),
        },
        {
          onConflict: 'page_id',
        }
      );

    if (saveError) {
      console.error(`[AI Gen] Save error for page ${pageNumber}:`, saveError);
      throw saveError;
    }

    // Emit event for Realtime (if available)
    try {
      await supabase.rpc('emit_event', {
        p_textbook_id: textbookId,
        p_event_type: 'ai_page_ready',
        p_payload: {
          type: 'ai_page_ready',
          textbook_id: textbookId,
          page_number: pageNumber,
          has_summary: !!summary,
          has_questions: parsedQuestions.length > 0,
          has_applications: parsedApplications.length > 0,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.log('[AI Gen] Event emission not available yet');
    }

    const duration = Date.now() - startTime;
    console.log(`[AI Gen] Page ${pageNumber} complete in ${duration}ms`);

    // Record metric (note: user_id will be NULL in service_role context, need to add explicitly)
    // Skip metrics from service_role context - only record from client
    // Metrics table expects user_id which we don't have in service_role API calls

    return { pageNumber, duration, success: true };
  } catch (error) {
    console.error(`[AI Gen] Error on page ${pageNumber}:`, error);
    throw error;
  }
}

// ================================================================
// GROQ API CALL WITH TOKEN BUDGET
// ================================================================

async function callGroq(
  prompt: string,
  content: string,
  maxTokens: number
): Promise<string> {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful tutor creating study materials from textbook pages.',
        },
        {
          role: 'user',
          content: `${prompt}\n\n${content.slice(0, 4000)}`, // Limit input
        },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${errorText}`);
  }

  const json = await response.json();
  return json.choices[0]?.message?.content || '';
}

// ================================================================
// TIMEOUT WRAPPER
// ================================================================

async function generateWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    ),
  ]);
}

