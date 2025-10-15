// 🔥 PHASE 2: Priority Queue System - Job Enqueue API
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface EnqueueRequest {
  jobType: 'extract_page' | 'generate_ai' | 'extract_and_ai';
  jobKey: string;
  payload: {
    textbookId: string;
    pageNumber: number;
    pdfUrl?: string;
    [key: string]: any;
  };
  priority?: 1 | 2 | 3; // 1=high, 2=medium, 3=low
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { jobType, jobKey, payload, priority = 2 }: EnqueueRequest = await req.json();

    console.log(`[Enqueue] ${jobKey} (priority ${priority})`);

    // Validate required fields
    if (!jobType || !jobKey || !payload) {
      return Response.json(
        { error: 'Missing required fields: jobType, jobKey, payload' },
        { status: 400 }
      );
    }

    // Idempotency check
    const { data: existing, error: checkError } = await supabase
      .from('jobs')
      .select('id, status')
      .eq('job_key', jobKey)
      .maybeSingle();

    if (checkError) {
      console.error('[Enqueue] Check error:', checkError);
      return Response.json(
        { error: 'Failed to check existing job' },
        { status: 500 }
      );
    }

    if (existing) {
      if (existing.status === 'completed') {
        console.log(`[Enqueue] Job ${jobKey} already completed`);
        return Response.json({
          jobId: existing.id,
          status: 'already_completed',
          message: 'Job already completed',
        });
      }

      if (existing.status === 'queued' || existing.status === 'processing') {
        console.log(`[Enqueue] Job ${jobKey} already ${existing.status}`);
        return Response.json({
          jobId: existing.id,
          status: `already_${existing.status}`,
          message: `Job already ${existing.status}`,
        });
      }

      // If failed, allow retry by updating status
      if (existing.status === 'failed') {
        console.log(`[Enqueue] Retrying failed job ${jobKey}`);
        const { error: updateError } = await supabase
          .from('jobs')
          .update({
            status: 'queued',
            attempts: 0,
            error: null,
            started_at: null,
            completed_at: null,
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error('[Enqueue] Retry error:', updateError);
          return Response.json(
            { error: 'Failed to retry job' },
            { status: 500 }
          );
        }

        return Response.json({
          jobId: existing.id,
          status: 'retrying',
          message: 'Failed job requeued',
        });
      }
    }

    // Create new job
    const { data: job, error: insertError } = await supabase
      .from('jobs')
      .insert({
        job_type: jobType,
        job_key: jobKey,
        payload,
        priority,
        status: 'queued',
      })
      .select()
      .maybeSingle();

    if (insertError || !job) {
      console.error('[Enqueue] Insert error:', insertError);
      return Response.json(
        { error: 'Failed to enqueue job', details: insertError?.message },
        { status: 500 }
      );
    }

    console.log(`[Enqueue] ✓ Created job ${job.id} (${jobKey})`);

    return Response.json({
      jobId: job.id,
      status: 'queued',
      message: 'Job successfully enqueued',
      priority: job.priority,
    });

  } catch (error: any) {
    console.error('[Enqueue] Error:', error);
    return Response.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export const config = {
  runtime: 'edge',
};

