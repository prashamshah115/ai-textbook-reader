// ================================================================
// REALTIME EVENTS HOOK - Type-safe event subscriptions
// ================================================================

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { TextbookEvent, EventType } from '../lib/events';
import { getTextbookChannelName } from '../lib/events';

// ================================================================
// HOOK - Subscribe to textbook events
// ================================================================

export interface UseRealtimeEventsOptions {
  /**
   * Textbook ID to subscribe to
   */
  textbookId: string;
  
  /**
   * Optional: Filter to specific event types
   */
  eventTypes?: EventType[];
  
  /**
   * Callback when event is received
   */
  onEvent?: (event: TextbookEvent) => void;
  
  /**
   * Enable/disable subscription
   */
  enabled?: boolean;
}

export function useRealtimeEvents(options: UseRealtimeEventsOptions) {
  const { textbookId, eventTypes, onEvent, enabled = true } = options;
  const [events, setEvents] = useState<TextbookEvent[]>([]);
  const [latestEvent, setLatestEvent] = useState<TextbookEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !textbookId) return;

    const channelName = getTextbookChannelName(textbookId);
    
    console.log('[Realtime] Subscribing to:', channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
          filter: `textbook_id=eq.${textbookId}`,
        },
        (payload) => {
          try {
            const event = payload.new.payload as TextbookEvent;
            
            // Filter by event type if specified
            if (eventTypes && !eventTypes.includes(event.type)) {
              return;
            }

            console.log('[Realtime] Event received:', event.type, event);

            setLatestEvent(event);
            setEvents((prev) => [...prev, event]);
            
            if (onEvent) {
              onEvent(event);
            }
          } catch (err) {
            console.error('[Realtime] Error processing event:', err);
            setError(err as Error);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Status:', status);
        setIsConnected(status === 'SUBSCRIBED');
        
        if (status === 'CHANNEL_ERROR') {
          setError(new Error('Channel subscription failed'));
        }
      });

    return () => {
      console.log('[Realtime] Unsubscribing from:', channelName);
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [textbookId, enabled, eventTypes?.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearEvents = useCallback(() => {
    setEvents([]);
    setLatestEvent(null);
  }, []);

  return {
    events,
    latestEvent,
    isConnected,
    error,
    clearEvents,
  };
}

// ================================================================
// HOOK - Subscribe to specific event type
// ================================================================

export function useRealtimeEvent<T extends TextbookEvent>(
  textbookId: string,
  eventType: T['type'],
  onEvent?: (event: T) => void
) {
  const { latestEvent, isConnected, error } = useRealtimeEvents({
    textbookId,
    eventTypes: [eventType],
    onEvent: onEvent as (event: TextbookEvent) => void,
  });

  return {
    event: latestEvent as T | null,
    isConnected,
    error,
  };
}

// ================================================================
// HOOK - Track extraction progress
// ================================================================

export interface ExtractionProgress {
  completedPages: number;
  totalPages: number;
  percentage: number;
  isComplete: boolean;
}

export function useExtractionProgress(textbookId: string) {
  const [progress, setProgress] = useState<ExtractionProgress>({
    completedPages: 0,
    totalPages: 0,
    percentage: 0,
    isComplete: false,
  });

  useRealtimeEvents({
    textbookId,
    eventTypes: ['extraction_progress', 'extraction_complete'],
    onEvent: (event) => {
      if (event.type === 'extraction_progress') {
        setProgress({
          completedPages: event.completed_pages,
          totalPages: event.total_pages,
          percentage: event.percentage,
          isComplete: false,
        });
      } else if (event.type === 'extraction_complete') {
        setProgress((prev) => ({
          ...prev,
          isComplete: true,
        }));
      }
    },
  });

  return progress;
}

// ================================================================
// HOOK - Track AI generation progress
// ================================================================

export interface AIProgress {
  completedPages: number;
  totalPages: number;
  percentage: number;
  readyPages: Set<number>;
}

export function useAIProgress(textbookId: string) {
  const [progress, setProgress] = useState<AIProgress>({
    completedPages: 0,
    totalPages: 0,
    percentage: 0,
    readyPages: new Set(),
  });

  useRealtimeEvents({
    textbookId,
    eventTypes: ['ai_page_ready', 'ai_generation_progress'],
    onEvent: (event) => {
      if (event.type === 'ai_page_ready') {
        setProgress((prev) => {
          const newReadyPages = new Set(prev.readyPages);
          newReadyPages.add(event.page_number);
          return {
            ...prev,
            readyPages: newReadyPages,
          };
        });
      } else if (event.type === 'ai_generation_progress') {
        setProgress((prev) => ({
          ...prev,
          completedPages: event.completed_pages,
          totalPages: event.total_pages,
          percentage: event.percentage,
        }));
      }
    },
  });

  return progress;
}

// ================================================================
// USAGE EXAMPLES
// ================================================================

/*
// Example 1: Subscribe to all events
function MyComponent({ textbookId }) {
  const { events, isConnected } = useRealtimeEvents({
    textbookId,
    onEvent: (event) => {
      console.log('Event received:', event);
    }
  });
  
  return (
    <div>
      {isConnected ? '✅ Connected' : '⏳ Connecting...'}
      <ul>
        {events.map((event, i) => (
          <li key={i}>{event.type}</li>
        ))}
      </ul>
    </div>
  );
}

// Example 2: Subscribe to specific event type
function ProgressBar({ textbookId }) {
  const { event } = useRealtimeEvent(
    textbookId,
    'extraction_progress',
    (event) => {
      toast.info(`Extracting: ${event.percentage}%`);
    }
  );
  
  if (!event) return null;
  
  return (
    <div className="progress-bar">
      <div style={{ width: `${event.percentage}%` }} />
    </div>
  );
}

// Example 3: Track extraction progress
function ExtractionStatus({ textbookId }) {
  const progress = useExtractionProgress(textbookId);
  
  return (
    <div>
      {progress.isComplete ? (
        <span>✅ Extracted {progress.totalPages} pages</span>
      ) : (
        <span>
          ⏳ Extracting... {progress.completedPages}/{progress.totalPages}
          ({progress.percentage}%)
        </span>
      )}
    </div>
  );
}

// Example 4: Track AI progress
function AIStatus({ textbookId, currentPage }) {
  const progress = useAIProgress(textbookId);
  const isCurrentPageReady = progress.readyPages.has(currentPage);
  
  return (
    <div>
      {isCurrentPageReady ? (
        <span>✅ AI features ready for this page</span>
      ) : (
        <span>⏳ Generating AI content... {progress.percentage}%</span>
      )}
    </div>
  );
}
*/

