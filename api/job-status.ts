// 🔥 PHASE 2: Priority Queue System - Job Status API
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req: Request) {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get('jobId');
    const jobKey = url.searchParams.get('jobKey');

    if (!jobId && !jobKey) {
      return Response.json(
        { error: 'Missing jobId or jobKey parameter' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('jobs')
      .select('id, job_type, status, priority, attempts, error, created_at, started_at, completed_at');

    if (jobId) {
      query = query.eq('id', jobId);
    } else if (jobKey) {
      query = query.eq('job_key', jobKey);
    }

    const { data: job, error } = await query.maybeSingle();

    if (error) {
      console.error('[JobStatus] Query error:', error);
      return Response.json(
        { error: 'Failed to fetch job status' },
        { status: 500 }
      );
    }

    if (!job) {
      return Response.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Calculate duration if completed
    let durationMs: number | null = null;
    if (job.completed_at && job.created_at) {
      durationMs = new Date(job.completed_at).getTime() - new Date(job.created_at).getTime();
    }

    return Response.json({
      jobId: job.id,
      jobType: job.job_type,
      status: job.status,
      priority: job.priority,
      attempts: job.attempts,
      error: job.error,
      createdAt: job.created_at,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      durationMs,
    });

  } catch (error: any) {
    console.error('[JobStatus] Error:', error);
    return Response.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export const config = {
  runtime: 'edge',
};

