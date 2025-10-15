// 🔥 PHASE 4: Health endpoint for queue monitoring
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req: Request) {
  const health: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {},
  };

  try {
    // 1. Check database connection
    const dbStart = Date.now();
    const { error: dbError } = await supabase
      .from('textbooks')
      .select('id')
      .limit(1);

    if (dbError) {
      health.checks.database = { status: 'unhealthy', error: dbError.message };
      health.status = 'unhealthy';
    } else {
      health.checks.database = {
        status: 'healthy',
        latency: Date.now() - dbStart,
      };
    }

    // 2. Check queue depth
    const { count: queuedCount, error: queueError } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued');

    if (queueError) {
      health.checks.queue = { status: 'error', error: queueError.message };
      health.status = 'degraded';
    } else {
      health.checks.queue = {
        status: 'healthy',
        pending: queuedCount || 0,
      };

      // Alert if queue is building up
      if (queuedCount && queuedCount > 100) {
        health.status = 'degraded';
        health.checks.queue.warning = 'High queue depth';
      }
    }

    // 3. Check for stuck jobs (processing > 5 minutes)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: stuckCount } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing')
      .lt('started_at', fiveMinAgo);

    health.checks.stuck_jobs = {
      status: stuckCount && stuckCount > 0 ? 'degraded' : 'healthy',
      count: stuckCount || 0,
    };

    if (stuckCount && stuckCount > 5) {
      health.status = 'unhealthy';
      health.checks.stuck_jobs.error = 'Many jobs stuck in processing';
    }

    // 4. Check failed jobs (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: failedCount } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gt('completed_at', oneHourAgo);

    health.checks.failed_jobs = {
      status: 'info',
      count: failedCount || 0,
      period: 'last_hour',
    };

    if (failedCount && failedCount > 20) {
      health.status = 'degraded';
      health.checks.failed_jobs.warning = 'High failure rate';
    }

    // 5. Get queue statistics by priority
    const { data: queueStats } = await supabase.rpc('get_queue_stats');

    if (queueStats) {
      health.checks.queue.stats = queueStats;
    }

  } catch (error: any) {
    console.error('[Health] Error:', error);
    health.status = 'unhealthy';
    health.error = error.message;
  }

  // Return appropriate HTTP status code
  const statusCode = health.status === 'healthy' ? 200 : 503;

  return Response.json(health, { status: statusCode });
}

export const config = {
  runtime: 'edge',
};
