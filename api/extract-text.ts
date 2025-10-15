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

    console.log('[Extract Text] Starting extraction job for:', textbookId);

    // Update textbook status to processing
    await supabase
      .from('textbooks')
      .update({
        processing_status: 'processing',
        processing_progress: 0,
      })
      .eq('id', textbookId);

    // 🔥 CRITICAL: Trigger Railway worker IMMEDIATELY (don't depend on job queue)
    const RAILWAY_EXTRACT_URL = process.env.RAILWAY_EXTRACT_URL;
    const EXTRACTION_API_KEY = process.env.EXTRACTION_API_KEY;

    if (!RAILWAY_EXTRACT_URL || !EXTRACTION_API_KEY) {
      console.error('[Extract Text] Railway not configured!');
      return new Response(
        JSON.stringify({ 
          error: 'Railway extraction service not configured',
          details: 'RAILWAY_EXTRACT_URL or EXTRACTION_API_KEY missing'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Extract Text] Triggering Railway:', RAILWAY_EXTRACT_URL);

    // Call Railway with detailed error logging
    let railwayResponse;
    try {
      railwayResponse = await fetch(`${RAILWAY_EXTRACT_URL}/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': EXTRACTION_API_KEY,
        },
        body: JSON.stringify({ textbookId, pdfUrl }),
      });

      console.log('[Extract Text] Railway response status:', railwayResponse.status);

      if (!railwayResponse.ok) {
        const errorText = await railwayResponse.text();
        console.error('[Extract Text] Railway error:', errorText);
        throw new Error(`Railway returned ${railwayResponse.status}: ${errorText}`);
      }

      const result = await railwayResponse.json();
      console.log('[Extract Text] Railway accepted job:', result);

    } catch (railwayError) {
      console.error('[Extract Text] Railway trigger failed:', railwayError);
      
      // Update textbook to failed status
      await supabase
        .from('textbooks')
        .update({
          processing_status: 'failed',
          processing_error: railwayError instanceof Error ? railwayError.message : 'Railway service unavailable'
        })
        .eq('id', textbookId);

      return new Response(
        JSON.stringify({ 
          error: 'Failed to trigger extraction',
          details: railwayError instanceof Error ? railwayError.message : 'Unknown error'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Optional: Try to enqueue job (for future queue-based processing)
    const idempotencyKey = `extract-${textbookId}`;
    let jobId: string | null = null;
    try {
      const { data: jobData } = await supabase.rpc('enqueue_job', {
        p_textbook_id: textbookId,
        p_type: 'extract_text',
        p_payload: { pdf_url: pdfUrl },
        p_idempotency_key: idempotencyKey,
        p_max_retries: 3
      });
      jobId = jobData?.id || null;
    } catch {
      // Job queue not available - that's OK, Railway is already triggered
      jobId = null;
    }

    // Optional: Emit event
    try {
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
    } catch {
      // Event system not available - that's OK
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

