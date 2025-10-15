// 🔥 PHASE 4: Auto-recovery service for stuck jobs
// Runs periodically to reset stuck jobs and clean up old completed jobs
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log('[Recovery] Job recovery service starting...');

// Reset stuck jobs (processing > 5 minutes)
async function resetStuckJobs() {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Find stuck jobs
    const { data: stuckJobs, error: findError } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'processing')
      .lt('started_at', fiveMinAgo);

    if (findError) {
      console.error('[Recovery] Error finding stuck jobs:', findError);
      return 0;
    }

    if (!stuckJobs || stuckJobs.length === 0) {
      console.log('[Recovery] No stuck jobs found ✓');
      return 0;
    }

    console.log(`[Recovery] Found ${stuckJobs.length} stuck jobs`);

    let resetCount = 0;
    let failedCount = 0;

    for (const job of stuckJobs) {
      if (job.attempts < job.max_attempts) {
        // Requeue with backoff
        const delay = Math.min(1000 * Math.pow(2, job.attempts), 30000);
        console.log(`[Recovery] Resetting job ${job.id} (attempt ${job.attempts}/${job.max_attempts})`);

        await new Promise(resolve => setTimeout(resolve, delay));

        await supabase
          .from('jobs')
          .update({
            status: 'queued',
            error: 'Reset from stuck state',
            started_at: null,
          })
          .eq('id', job.id);

        resetCount++;
      } else {
        // Max attempts exceeded, mark as failed
        console.log(`[Recovery] Failing job ${job.id} (max attempts exceeded)`);

        await supabase
          .from('jobs')
          .update({
            status: 'failed',
            error: 'Max attempts exceeded (stuck)',
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        failedCount++;
      }
    }

    console.log(`[Recovery] ✅ Reset ${resetCount} jobs, failed ${failedCount} jobs`);
    return resetCount + failedCount;

  } catch (error) {
    console.error('[Recovery] Error resetting stuck jobs:', error);
    return 0;
  }
}

// Clean up old completed jobs (older than 7 days)
async function cleanupOldJobs() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('jobs')
      .delete()
      .in('status', ['completed', 'failed'])
      .lt('completed_at', sevenDaysAgo);

    if (error) {
      console.error('[Recovery] Error cleaning up old jobs:', error);
      return 0;
    }

    console.log('[Recovery] ✅ Cleaned up old jobs');
    return 1;

  } catch (error) {
    console.error('[Recovery] Error cleaning up:', error);
    return 0;
  }
}

// Get queue statistics
async function logQueueStats() {
  try {
    const { data: stats, error } = await supabase.rpc('get_queue_stats');

    if (error) {
      console.error('[Recovery] Error getting stats:', error);
      return;
    }

    if (stats && stats.length > 0) {
      console.log('[Recovery] Queue statistics:');
      console.table(stats);
    } else {
      console.log('[Recovery] Queue is empty');
    }

  } catch (error) {
    console.error('[Recovery] Error logging stats:', error);
  }
}

// Main recovery loop
async function recoveryLoop() {
  console.log('[Recovery] Running recovery check...');

  // Log queue stats
  await logQueueStats();

  // Reset stuck jobs (every run)
  await resetStuckJobs();

  // Clean up old jobs (once per day)
  const now = new Date();
  if (now.getHours() === 3 && now.getMinutes() < 5) {
    // Run cleanup at 3 AM
    console.log('[Recovery] Running daily cleanup...');
    await cleanupOldJobs();
  }

  console.log('[Recovery] Recovery check complete\n');
}

// Run recovery every 5 minutes
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

console.log(`[Recovery] Starting periodic recovery (every ${INTERVAL_MS / 1000}s)`);

// Run immediately on start
recoveryLoop();

// Then run on interval
setInterval(recoveryLoop, INTERVAL_MS);

// Keep process alive
process.on('SIGINT', () => {
  console.log('[Recovery] Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[Recovery] Shutting down gracefully...');
  process.exit(0);
});

console.log('[Recovery] ✅ Job recovery service running');

