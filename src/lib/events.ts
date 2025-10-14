// ================================================================
// EVENT CONTRACTS - Type-safe Realtime event handling
// ================================================================
// This file defines all event types and payloads that flow through
// the system. Use these types for both emitting and consuming events.

// ================================================================
// JOB TYPES
// ================================================================

export type JobType = 
  | 'extract_text'
  | 'generate_ai'
  | 'detect_chapters'
  | 'fetch_web_context';

export type JobState = 
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'dead';

export interface Job {
  id: string;
  textbook_id: string;
  type: JobType;
  state: JobState;
  attempt: number;
  max_retries: number;
  next_run_at: string;
  payload: Record<string, any>;
  error?: string;
  idempotency_key?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
}

// ================================================================
// EVENT TYPES - Realtime channel events
// ================================================================

export type EventType =
  | 'upload_complete'
  | 'extraction_progress'
  | 'extraction_complete'
  | 'ai_page_ready'
  | 'ai_generation_progress'
  | 'job_failed'
  | 'job_completed'
  | 'chapter_detected';

// Base event structure
export interface BaseEvent {
  type: EventType;
  textbook_id: string;
  timestamp: string;
}

// Upload completed event
export interface UploadCompleteEvent extends BaseEvent {
  type: 'upload_complete';
  pdf_url: string;
  total_pages: number;
  file_size: number;
}

// Extraction progress event
export interface ExtractionProgressEvent extends BaseEvent {
  type: 'extraction_progress';
  completed_pages: number;
  total_pages: number;
  percentage: number;
  current_page?: number;
}

// Extraction completed event
export interface ExtractionCompleteEvent extends BaseEvent {
  type: 'extraction_complete';
  pages_extracted: number;
  duration_ms: number;
}

// AI page ready event
export interface AIPageReadyEvent extends BaseEvent {
  type: 'ai_page_ready';
  page_number: number;
  has_summary: boolean;
  has_questions: boolean;
  has_applications: boolean;
}

// AI generation progress event
export interface AIGenerationProgressEvent extends BaseEvent {
  type: 'ai_generation_progress';
  completed_pages: number;
  total_pages: number;
  percentage: number;
}

// Job failed event
export interface JobFailedEvent extends BaseEvent {
  type: 'job_failed';
  job_id: string;
  job_type: JobType;
  error: string;
  attempt: number;
  will_retry: boolean;
}

// Job completed event
export interface JobCompletedEvent extends BaseEvent {
  type: 'job_completed';
  job_id: string;
  job_type: JobType;
  duration_ms: number;
}

// Chapter detected event
export interface ChapterDetectedEvent extends BaseEvent {
  type: 'chapter_detected';
  chapter_count: number;
}

// Union type of all events
export type TextbookEvent =
  | UploadCompleteEvent
  | ExtractionProgressEvent
  | ExtractionCompleteEvent
  | AIPageReadyEvent
  | AIGenerationProgressEvent
  | JobFailedEvent
  | JobCompletedEvent
  | ChapterDetectedEvent;

// ================================================================
// METRIC TYPES - Performance instrumentation
// ================================================================

export type MetricName =
  | 'ttfp'                    // Time to First Page (PDF visible)
  | 'chat_first_token'        // Chat response first token latency
  | 'page_turn'               // Page navigation latency
  | 'extraction_duration'     // Total extraction time
  | 'ai_generation_duration'  // AI content generation time
  | 'upload_duration'         // File upload time
  | 'canvas_render'           // Canvas rendering time
  | 'db_query'                // Database query latency
  | 'api_call';               // API call latency

export type MetricUnit = 'ms' | 's' | 'count' | 'bytes';

export interface Metric {
  id: string;
  metric_name: MetricName;
  value: number;
  unit: MetricUnit;
  textbook_id?: string;
  user_id: string;
  metadata: Record<string, any>;
  created_at: string;
}

// ================================================================
// REALTIME CHANNEL CONTRACTS
// ================================================================

/**
 * Channel naming convention:
 * - textbook:{textbook_id} - All events for a specific textbook
 * - jobs:{textbook_id} - Job updates for a specific textbook
 */

export interface RealtimeChannel {
  name: string;
  event_types: EventType[];
}

// ================================================================
// HELPER FUNCTIONS - Event emission and consumption
// ================================================================

/**
 * Create a textbook channel name
 */
export function getTextbookChannelName(textbookId: string): string {
  return `textbook:${textbookId}`;
}

/**
 * Create a jobs channel name
 */
export function getJobsChannelName(textbookId: string): string {
  return `jobs:${textbookId}`;
}

/**
 * Type guard for specific event types
 */
export function isEventType<T extends TextbookEvent>(
  event: TextbookEvent,
  type: T['type']
): event is T {
  return event.type === type;
}

/**
 * Create an event payload
 */
export function createEvent<T extends TextbookEvent>(
  type: T['type'],
  textbookId: string,
  payload: Omit<T, 'type' | 'textbook_id' | 'timestamp'>
): T {
  return {
    type,
    textbook_id: textbookId,
    timestamp: new Date().toISOString(),
    ...payload,
  } as T;
}

// ================================================================
// EVENT EMITTER - Server-side event emission
// ================================================================

/**
 * Server-side function to emit events via Supabase
 * Call this from API routes/Edge Functions
 */
export async function emitEvent(
  supabaseClient: any,
  event: TextbookEvent
): Promise<void> {
  await supabaseClient.from('events').insert({
    textbook_id: event.textbook_id,
    event_type: event.type,
    payload: event,
  });
}

// ================================================================
// METRIC RECORDER - Client and server-side metrics
// ================================================================

/**
 * Record a performance metric
 */
export async function recordMetric(
  supabaseClient: any,
  name: MetricName,
  value: number,
  unit: MetricUnit = 'ms',
  textbookId?: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  await supabaseClient.from('metrics').insert({
    metric_name: name,
    value,
    unit,
    textbook_id: textbookId,
    metadata,
  });
}

/**
 * Performance timer utility
 */
export class PerformanceTimer {
  private startTime: number;
  private metricName: MetricName;
  private textbookId?: string;
  private metadata: Record<string, any>;

  constructor(
    metricName: MetricName,
    textbookId?: string,
    metadata: Record<string, any> = {}
  ) {
    this.startTime = performance.now();
    this.metricName = metricName;
    this.textbookId = textbookId;
    this.metadata = metadata;
  }

  async end(supabaseClient: any): Promise<number> {
    const duration = performance.now() - this.startTime;
    await recordMetric(
      supabaseClient,
      this.metricName,
      duration,
      'ms',
      this.textbookId,
      this.metadata
    );
    return duration;
  }

  getDuration(): number {
    return performance.now() - this.startTime;
  }
}

// ================================================================
// USAGE EXAMPLES
// ================================================================

/*
// Example 1: Emitting an event from API route
import { createEvent, emitEvent } from '@/lib/events';

const event = createEvent<ExtractionProgressEvent>(
  'extraction_progress',
  textbookId,
  {
    completed_pages: 50,
    total_pages: 100,
    percentage: 50,
    current_page: 50
  }
);

await emitEvent(supabase, event);

// Example 2: Subscribing to events in React
import { getTextbookChannelName, isEventType } from '@/lib/events';

const channel = supabase
  .channel(getTextbookChannelName(textbookId))
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'events',
    filter: `textbook_id=eq.${textbookId}`
  }, (payload) => {
    const event = payload.new.payload as TextbookEvent;
    
    if (isEventType<ExtractionProgressEvent>(event, 'extraction_progress')) {
      console.log(`Progress: ${event.percentage}%`);
    }
  })
  .subscribe();

// Example 3: Recording a metric
import { PerformanceTimer } from '@/lib/events';

const timer = new PerformanceTimer('ttfp', textbookId);
// ... do work
await timer.end(supabase);

// Example 4: Manual metric recording
import { recordMetric } from '@/lib/events';

await recordMetric(
  supabase,
  'page_turn',
  45, // 45ms
  'ms',
  textbookId,
  { from_page: 5, to_page: 6 }
);
*/

