// ================================================================
// BACKGROUND TEXT EXTRACTION API
// ================================================================
// This endpoint enqueues a job to extract text from PDF in background
// Uses the job queue system from Day 1

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface ExtractRequest {
  textbookId: string;
  pdfUrl: string;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { textbookId, pdfUrl }: ExtractRequest = await req.json();

    if (!textbookId || !pdfUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing textbookId or pdfUrl' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Extract Text] Enqueuing extraction job for:', textbookId);

    // Generate idempotency key to prevent duplicate extraction jobs
    const idempotencyKey = `extract-${textbookId}`;

    // Enqueue extraction job using Day 1 helper function
    const { data: job, error } = await supabase.rpc('enqueue_job', {
      p_textbook_id: textbookId,
      p_type: 'extract_text',
      p_payload: { pdf_url: pdfUrl },
      p_idempotency_key: idempotencyKey,
      p_max_retries: 3
    });

    if (error) {
      console.error('[Extract Text] Failed to enqueue job:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to enqueue extraction job', details: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Extract Text] Job enqueued:', job);

    // Emit event for Realtime subscribers
    await supabase.rpc('emit_event', {
      p_textbook_id: textbookId,
      p_event_type: 'extraction_progress',
      p_payload: {
        type: 'extraction_progress',
        textbook_id: textbookId,
        completed_pages: 0,
        total_pages: 0,
        percentage: 0,
        timestamp: new Date().toISOString()
      }
    });

    // Update textbook status to 'processing'
    await supabase
      .from('textbooks')
      .update({
        processing_status: 'processing',
        extraction_started_at: new Date().toISOString()
      })
      .eq('id', textbookId);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job,
        message: 'Text extraction job enqueued'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[Extract Text] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export const config = {
  runtime: 'edge',
};

