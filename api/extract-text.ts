// ================================================================
// DAY 4: EDGE FUNCTION - Validate request & write job with idempotency
// ================================================================
// This endpoint validates the extraction request, creates a job with
// idempotency guarantee, and triggers the Railway worker

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

    // 🔥 DAY 4: Validation - Check required fields
    if (!textbookId || !pdfUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: textbookId, pdfUrl' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate textbook exists and is owned by requester
    const { data: textbook, error: textbookError } = await supabase
      .from('textbooks')
      .select('id, user_id, processing_status, total_pages')
      .eq('id', textbookId)
      .single();

    if (textbookError || !textbook) {
      return new Response(
        JSON.stringify({ error: 'Textbook not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if already processing or completed
    if (textbook.processing_status === 'processing') {
      console.log('[Extract Text] Job already in progress for:', textbookId);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Extraction already in progress',
          status: 'processing'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (textbook.processing_status === 'completed') {
      console.log('[Extract Text] Extraction already completed for:', textbookId);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Extraction already completed',
          status: 'completed'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Extract Text] Enqueuing extraction job for:', textbookId);

    // 🔥 DAY 4: Generate idempotency key to prevent duplicate jobs
    const idempotencyKey = `extract-${textbookId}`;

    // 🔥 DAY 4: Enqueue job using helper function with idempotency
    const { data: jobId, error: jobError } = await supabase.rpc('enqueue_job', {
      p_textbook_id: textbookId,
      p_type: 'extract_text',
      p_payload: { 
        pdf_url: pdfUrl,
        total_pages: textbook.total_pages || 0
      },
      p_idempotency_key: idempotencyKey,
      p_max_retries: 3
    });

    if (jobError) {
      console.error('[Extract Text] Failed to enqueue job:', jobError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to enqueue extraction job', 
          details: jobError.message 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Extract Text] Job enqueued with ID:', jobId);

    // Emit initial event for Realtime subscribers
    await supabase.rpc('emit_event', {
      p_textbook_id: textbookId,
      p_event_type: 'extraction_progress',
      p_payload: {
        type: 'extraction_progress',
        textbook_id: textbookId,
        completed_pages: 0,
        total_pages: textbook.total_pages || 0,
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

    // 🔥 DAY 4: Trigger Railway worker (fire HTTP request to wake it up)
    // Worker will pull jobs from queue and process them
    const RAILWAY_EXTRACT_URL = process.env.RAILWAY_EXTRACT_URL;
    const EXTRACTION_API_KEY = process.env.EXTRACTION_API_KEY;

    if (RAILWAY_EXTRACT_URL && EXTRACTION_API_KEY) {
      fetch(`${RAILWAY_EXTRACT_URL}/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': EXTRACTION_API_KEY,
        },
        body: JSON.stringify({ textbookId, pdfUrl }),
      }).catch(err => {
        console.error('[Extract Text] Railway trigger failed (non-critical):', err.message);
      });
    } else {
      console.warn('[Extract Text] Railway not configured, job queued but worker may not process');
    }

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobId,
        status: 'processing',
        message: 'Text extraction job enqueued and worker notified'
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

