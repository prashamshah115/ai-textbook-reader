// ================================================================
// ADAPTIVE POLLING FALLBACK - For when Realtime is unavailable
// ================================================================
// Implements exponential backoff polling with jitter
// Only used as fallback if Realtime subscription fails

import { useEffect, useRef, useState, useCallback } from 'react';

export interface AdaptivePollingOptions {
  /**
   * Initial polling interval in ms
   * Default: 3000ms (3s)
   */
  initialInterval?: number;

  /**
   * Maximum polling interval in ms
   * Default: 30000ms (30s)
   */
  maxInterval?: number;

  /**
   * Multiplier for exponential backoff
   * Default: 2 (doubles each time)
   */
  backoffMultiplier?: number;

  /**
   * Whether to add random jitter to prevent thundering herd
   * Default: true
   */
  useJitter?: boolean;

  /**
   * Enable/disable polling
   * Default: true
   */
  enabled?: boolean;

  /**
   * Whether Realtime is connected (if true, polling is paused)
   * Default: false
   */
  realtimeConnected?: boolean;
}

export interface AdaptivePoll<T> {
  /**
   * Function to fetch data
   */
  fetchFn: () => Promise<T>;

  /**
   * Callback when data is fetched
   */
  onData?: (data: T) => void;

  /**
   * Callback when error occurs
   */
  onError?: (error: Error) => void;

  /**
   * Options
   */
  options?: AdaptivePollingOptions;
}

/**
 * Adaptive polling hook with exponential backoff
 * Only polls when Realtime is NOT connected
 */
export function useAdaptivePolling<T>({
  fetchFn,
  onData,
  onError,
  options = {},
}: AdaptivePoll<T>) {
  const {
    initialInterval = 3000,
    maxInterval = 30000,
    backoffMultiplier = 2,
    useJitter = true,
    enabled = true,
    realtimeConnected = false,
  } = options;

  const [currentInterval, setCurrentInterval] = useState(initialInterval);
  const [isPolling, setIsPolling] = useState(false);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add jitter to prevent thundering herd
  const addJitter = useCallback((interval: number): number => {
    if (!useJitter) return interval;
    const jitter = Math.random() * 0.3 * interval; // ±30% jitter
    return interval + jitter - (0.15 * interval);
  }, [useJitter]);

  // Calculate next interval with exponential backoff
  const getNextInterval = useCallback(
    (errorCount: number): number => {
      if (errorCount === 0) return initialInterval;
      const backoffInterval = Math.min(
        initialInterval * Math.pow(backoffMultiplier, errorCount),
        maxInterval
      );
      return addJitter(backoffInterval);
    },
    [initialInterval, maxInterval, backoffMultiplier, addJitter]
  );

  // Poll function
  const poll = useCallback(async () => {
    // Don't poll if disabled, already polling, or Realtime is connected
    if (!enabled || isPolling || realtimeConnected) {
      return;
    }

    setIsPolling(true);

    try {
      const data = await fetchFn();
      
      // Success - reset backoff
      setConsecutiveErrors(0);
      setCurrentInterval(initialInterval);
      
      if (onData) {
        onData(data);
      }
    } catch (error) {
      console.error('[Adaptive Poll] Error:', error);
      
      // Increment error count for backoff
      setConsecutiveErrors((prev) => {
        const newCount = prev + 1;
        const nextInterval = getNextInterval(newCount);
        setCurrentInterval(nextInterval);
        console.log(
          `[Adaptive Poll] Backing off to ${(nextInterval / 1000).toFixed(1)}s after ${newCount} errors`
        );
        return newCount;
      });
      
      if (onError) {
        onError(error as Error);
      }
    } finally {
      setIsPolling(false);
    }
  }, [enabled, isPolling, realtimeConnected, fetchFn, onData, onError, initialInterval, getNextInterval]);

  // Set up polling interval
  useEffect(() => {
    if (!enabled || realtimeConnected) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // 🔥 FIX: Pause polling when tab is hidden (prevents freezing)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[Adaptive Poll] Tab hidden, pausing polling');
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      } else {
        console.log('[Adaptive Poll] Tab visible, resuming polling');
        if (!timeoutRef.current && enabled && !realtimeConnected) {
          scheduleNextPoll();
        }
      }
    };

    // Schedule next poll
    const scheduleNextPoll = () => {
      // Don't schedule if tab is hidden
      if (document.hidden) {
        console.log('[Adaptive Poll] Skipping schedule - tab hidden');
        return;
      }
      
      timeoutRef.current = setTimeout(() => {
        poll().then(() => {
          if (enabled && !realtimeConnected && !document.hidden) {
            scheduleNextPoll();
          }
        });
      }, currentInterval);
    };

    // Start polling
    poll().then(() => {
      if (enabled && !realtimeConnected && !document.hidden) {
        scheduleNextPoll();
      }
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, realtimeConnected, currentInterval, poll]);

  // Manual trigger
  const trigger = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    poll();
  }, [poll]);

  return {
    isPolling,
    currentInterval,
    consecutiveErrors,
    trigger,
  };
}

// ================================================================
// EXAMPLE USAGE
// ================================================================

/*
// Example 1: Poll textbook status with Realtime fallback
function TextbookStatus({ textbookId }) {
  const { isConnected: realtimeConnected } = useRealtimeEvents({
    textbookId,
    onEvent: (event) => {
      if (event.type === 'extraction_progress') {
        setProgress(event.percentage);
      }
    }
  });

  const { isPolling } = useAdaptivePolling({
    fetchFn: async () => {
      const { data } = await supabase
        .from('textbooks')
        .select('processing_progress')
        .eq('id', textbookId)
        .single();
      return data;
    },
    onData: (data) => {
      setProgress(data.processing_progress);
    },
    options: {
      enabled: true,
      realtimeConnected, // Pauses polling when Realtime works
      initialInterval: 3000,
      maxInterval: 30000,
    }
  });

  return (
    <div>
      {realtimeConnected ? '✅ Realtime' : isPolling ? '🔄 Polling' : '⏸️ Idle'}
      Progress: {progress}%
    </div>
  );
}

// Example 2: Poll job status
function JobStatus({ jobId }) {
  const [status, setStatus] = useState(null);
  
  useAdaptivePolling({
    fetchFn: async () => {
      const { data } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      return data;
    },
    onData: (job) => {
      setStatus(job.state);
      // Stop polling when job is done
      if (job.state === 'completed' || job.state === 'failed' || job.state === 'dead') {
        return; // Component will unmount or disable polling
      }
    },
    options: {
      enabled: status !== 'completed',
      initialInterval: 2000,
      maxInterval: 20000,
    }
  });

  return <div>Job Status: {status}</div>;
}
*/

