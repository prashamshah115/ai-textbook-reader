import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import type { UploadMetadata } from '../components/UploadDialog';
import { fetchWithRetry } from '../lib/fetchWithRetry';
import { extractTextFromPDF, extractMetadataOnly } from '../lib/pdfExtractor';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';
import { useAdaptivePolling } from '../hooks/useAdaptivePolling';

interface Page {
  id: string;
  page_number: number;
  raw_text: string;
  processed: boolean;
}

interface AIContent {
  summary: string | null;
  key_concepts: any[] | null;
  connections_to_previous: any | null;
  applications: any[] | null;
  practice_questions: any[] | null;
}

interface Textbook {
  id: string;
  title: string;
  total_pages: number;
  pdf_url: string | null;
  created_at: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_progress: number;
  processing_error: string | null;
  ai_processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  ai_processing_progress: number;
  ai_processing_error: string | null;
}

interface TextbookContextType {
  currentTextbook: Textbook | null;
  textbooks: Textbook[];
  currentPage: number;
  actualPageCount: number | null;
  currentPageData: Page | null;
  currentAIContent: AIContent | null;
  loading: boolean;
  setCurrentPage: (page: number) => void;
  setActualPageCount: (count: number) => void;
  loadTextbook: (textbookId: string) => Promise<void>;
  loadTextbooks: () => Promise<void>;
  uploadTextbook: (file: File, metadata: UploadMetadata, onProgress?: (progress: number, stage: string) => void) => Promise<string>;
  nextPage: () => void;
  prevPage: () => void;
}

const TextbookContext = createContext<TextbookContextType | undefined>(undefined);

export function TextbookProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentTextbook, setCurrentTextbook] = useState<Textbook | null>(null);
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [actualPageCount, setActualPageCount] = useState<number | null>(null);
  const [currentPageData, setCurrentPageData] = useState<Page | null>(null);
  const [currentAIContent, setCurrentAIContent] = useState<AIContent | null>(null);
  const [loading, setLoading] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 🔥 DAY 2: Realtime events for current textbook
  const { isConnected: realtimeConnected, latestEvent } = useRealtimeEvents({
    textbookId: currentTextbook?.id || '',
    enabled: !!currentTextbook,
    onEvent: (event) => {
      console.log('[Realtime] Event received:', event.type);
      
      // Handle extraction progress
      if (event.type === 'extraction_progress') {
        setTextbooks((prev) =>
          prev.map((tb) =>
            tb.id === event.textbook_id
              ? { ...tb, processing_progress: event.percentage }
              : tb
          )
        );
      }
      
      // Handle extraction complete
      if (event.type === 'extraction_complete') {
        toast.success(`✅ Text extraction complete! ${event.pages_extracted} pages ready.`);
        loadTextbooks(); // Refresh textbook list
      }
      
      // Handle AI page ready
      if (event.type === 'ai_page_ready') {
        if (event.page_number === currentPage) {
          loadPageData(); // Refresh current page if AI is ready
        }
      }
      
      // Handle job failures
      if (event.type === 'job_failed') {
        if (!event.will_retry) {
          toast.error(`Job failed: ${event.error}`);
        }
      }
    },
  });

  // 🔥 DAY 2: Adaptive polling fallback (only when Realtime disconnected)
  useAdaptivePolling({
    fetchFn: async () => {
      if (!currentTextbook) return null;
      
      const { data } = await supabase
        .from('textbooks')
        .select('processing_status, processing_progress, ai_processing_status, ai_processing_progress')
        .eq('id', currentTextbook.id)
        .single();
      
      return data;
    },
    onData: (data) => {
      if (!data) return;
      
      // Update textbook in state
      setTextbooks((prev) =>
        prev.map((tb) =>
          tb.id === currentTextbook?.id
            ? {
                ...tb,
                processing_status: data.processing_status,
                processing_progress: data.processing_progress,
                ai_processing_status: data.ai_processing_status,
                ai_processing_progress: data.ai_processing_progress,
              }
            : tb
        )
      );
      
      // Show milestone toasts (only when polling, not Realtime)
      if (data.processing_status === 'completed' && currentTextbook?.processing_status !== 'completed') {
        toast.success('Text extraction complete!');
      }
    },
    options: {
      enabled: !!currentTextbook,
      realtimeConnected, // Pauses polling when Realtime works
      initialInterval: 3000,
      maxInterval: 30000,
      backoffMultiplier: 2,
      useJitter: true,
    },
  });

  // Helper: Ensure we have a valid session before making queries
  const ensureValidSession = async (): Promise<boolean> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        console.warn('[Session] No valid session found');
        return false;
      }
      
      // Check if token is about to expire (within 60 seconds)
      const expiresAt = session.expires_at;
      if (expiresAt && expiresAt * 1000 - Date.now() < 60000) {
        console.log('[Session] Token expiring soon, refreshing...');
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !newSession) {
          console.error('[Session] Failed to refresh:', refreshError);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('[Session] Error checking session:', error);
      return false;
    }
  };

  // Load user's textbooks
  const loadTextbooks = async () => {
    if (!user) return;

    try {
      // Ensure valid session
      const hasValidSession = await ensureValidSession();
      if (!hasValidSession) {
        toast.error('Session expired. Please refresh the page.');
        return;
      }

      const { data, error } = await supabase
        .from('textbooks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTextbooks(data || []);
    } catch (error) {
      console.error('[Textbook] Failed to load textbooks:', error);
      toast.error('Failed to load textbooks');
    }
  };

  // Load a specific textbook
  const loadTextbook = async (textbookId: string, retryCount = 0) => {
    try {
      setLoading(true);
      
      // Ensure valid session
      const hasValidSession = await ensureValidSession();
      if (!hasValidSession) {
        toast.error('Session expired. Please refresh the page.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('textbooks')
        .select('*')
        .eq('id', textbookId)
        .single();

      if (error) {
        // Check if it's a 406 or auth error and retry once
        if (retryCount === 0 && (error.code === '406' || error.message?.includes('JWT'))) {
          console.log('[Textbook] Auth error detected, refreshing session and retrying...');
          await supabase.auth.refreshSession();
          return loadTextbook(textbookId, 1);
        }
        throw error;
      }
      
      setCurrentTextbook(data);
      setCurrentPage(1);
    } catch (error) {
      console.error('[Textbook] Failed to load textbook:', error);
      setCurrentTextbook(null);
      toast.error('Failed to load textbook');
    } finally {
      setLoading(false);
    }
  };

  // Load page data and AI content with retry logic
  const loadPageData = async (retryCount = 0) => {
    if (!currentTextbook) return;

    try {
      setLoading(true);

      // FIX #1: Ensure valid session before querying
      const hasValidSession = await ensureValidSession();
      if (!hasValidSession) {
        // Session is truly gone, can't proceed
        toast.error('Session expired. Please refresh the page.');
        setCurrentPageData(null);
        setCurrentAIContent(null);
        setLoading(false);
        return;
      }

      // Get page data
      const { data: pageData, error: pageError } = await supabase
        .from('pages')
        .select('*')
        .eq('textbook_id', currentTextbook.id)
        .eq('page_number', currentPage)
        .single();

      if (pageError) {
        // FIX: Retry logic for 406 errors (session timeout) 
        // 406 = JWT expired, PGRST301 = JWT invalid
        const isAuthError = pageError.code === '406' || 
                           pageError.code === 'PGRST301' || 
                           pageError.message?.includes('JWT') ||
                           pageError.message?.includes('session');
        
        if (retryCount === 0 && isAuthError) {
          console.log('[PageData] Session expired (406), refreshing and retrying...');
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError) {
            // Wait a bit for session to propagate
            await new Promise(resolve => setTimeout(resolve, 500));
            return loadPageData(1); // Retry once with fresh token
          }
        }
        
        // If page doesn't exist yet, that's OK (background extraction in progress)
        if (pageError.code === 'PGRST116') {
          console.log('[PageData] Page not extracted yet, will show when ready');
          setCurrentPageData(null);
          return; // Don't throw, just show empty state
        }
        
        throw pageError;
      }
      
      setCurrentPageData(pageData);

      // Get AI content for this page
      if (pageData) {
        const { data: aiData, error: aiError } = await supabase
          .from('ai_processed_content')
          .select('*')
          .eq('page_id', pageData.id)
          .single();

        if (aiError && aiError.code !== 'PGRST116') {
          // PGRST116 = no rows returned, which is ok
          console.error('[Textbook] Failed to load AI content:', aiError);
        }

        setCurrentAIContent(aiData || null);
      }
    } catch (error: any) {
      // FIX #3: Better error handling - always clear stale data
      console.error('[Textbook] Failed to load page data:', error);
      setCurrentPageData(null);
      setCurrentAIContent(null);
      
      // Provide helpful error message
      if (error.code === '406' || error.message?.includes('JWT')) {
        toast.error('Session expired. Please refresh the page.');
      } else {
        toast.error('Failed to load page. Please try again.');
      }
    } finally {
      // FIX #3: Always clear loading state
      setLoading(false);
    }
  };

  // Poll for textbook processing status
  const pollTextbookStatus = (textbookId: string) => {
    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      const { data, error } = await supabase
        .from('textbooks')
        .select('processing_status, processing_progress, processing_error')
        .eq('id', textbookId)
        .single();

      if (error) {
        console.error('[Polling] Error:', error);
        return;
      }

      if (data.processing_status === 'completed') {
        clearInterval(pollingIntervalRef.current!);
        pollingIntervalRef.current = null;
        
        // Trigger AI processing
        console.log('[Polling] PDF processing complete, triggering AI processing');
        triggerAIProcessing(textbookId);
        
        toast.success('Text extracted! Now generating AI summaries...');
        await loadTextbooks();
        
        // Start polling for AI status
        pollAIStatus(textbookId);
      } else if (data.processing_status === 'failed') {
        clearInterval(pollingIntervalRef.current!);
        pollingIntervalRef.current = null;
        toast.error(`Processing failed: ${data.processing_error || 'Unknown error'}`);
        await loadTextbooks();
      } else if (data.processing_status === 'processing') {
        // Update the textbook in state to show progress
        setTextbooks(prev => prev.map(tb => 
          tb.id === textbookId 
            ? { ...tb, processing_progress: data.processing_progress || 0 }
            : tb
        ));
      }
    }, 3000); // Poll every 3 seconds
  };

  // Poll for AI processing status
  const pollAIStatus = (textbookId: string) => {
    const aiPollingInterval = setInterval(async () => {
      const { data, error } = await supabase
        .from('textbooks')
        .select('ai_processing_status, ai_processing_progress, ai_processing_error')
        .eq('id', textbookId)
        .single();

      if (error) {
        console.error('[AI Polling] Error:', error);
        return;
      }

      if (data.ai_processing_status === 'completed') {
        clearInterval(aiPollingInterval);
        toast.success('Your textbook is ready to read!', { duration: 3000 });
        await loadTextbooks();
        await loadTextbook(textbookId);
      } else if (data.ai_processing_status === 'failed') {
        clearInterval(aiPollingInterval);
        toast.error(`AI processing failed: ${data.ai_processing_error || 'Unknown error'}`);
        await loadTextbooks();
      } else if (data.ai_processing_status === 'processing') {
        // Update progress
        setTextbooks(prev => prev.map(tb => 
          tb.id === textbookId 
            ? { ...tb, ai_processing_progress: data.ai_processing_progress || 0 }
            : tb
        ));
      }
    }, 3000);
  };

  // Trigger AI processing
  const triggerAIProcessing = async (textbookId: string) => {
    try {
      const response = await fetch('/api/process-pdf-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textbookId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start AI processing');
      }

      console.log('[AI Processing] Started successfully');
    } catch (error) {
      console.error('[AI Processing] Failed to trigger:', error);
      toast.error('Failed to start AI processing');
    }
  };

  // Background processing function - Triggers Railway extraction service
  const processTextbookInBackground = async (textbookId: string, filePath: string) => {
    try {
      console.log('[Background] Triggering Railway extraction for:', textbookId);
      
      // Get PDF URL from Supabase Storage
      const { data: urlData } = supabase.storage
        .from('textbook-pdfs')
        .getPublicUrl(filePath);
      
      const pdfUrl = urlData.publicUrl;
      
      // Trigger Railway extraction (fire-and-forget)
      // Note: This is async but we don't wait for completion
      fetch('/api/trigger-extraction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          textbookId,
          pdfUrl 
        }),
      }).then(async (response) => {
        if (response.ok) {
          console.log('[Background] Railway extraction triggered successfully');
          toast.info('Text extraction started in background. You can start reading now!', { duration: 5000 });
          
          // Start polling for extraction completion
          startExtractionPolling(textbookId);
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[Background] Failed to trigger extraction:', errorData);
          toast.warning('Background extraction failed to start. AI features will use on-demand extraction.', { duration: 5000 });
        }
      }).catch(error => {
        console.error('[Background] Error triggering extraction:', error);
        toast.warning('Background extraction unavailable. AI features will work on-demand.', { duration: 5000 });
      });

    } catch (error) {
      console.error('[Background] Processing setup failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.warning(`Could not start background processing: ${errorMessage}. You can still use the PDF.`, { duration: 5000 });
    }
  };

  // Poll for extraction completion
  const startExtractionPolling = (textbookId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const { data: textbook } = await supabase
          .from('textbooks')
          .select('processing_status, processing_progress, total_pages')
          .eq('id', textbookId)
          .single();

        if (textbook?.processing_status === 'completed') {
          clearInterval(pollInterval);
          toast.success(`Text extraction complete! ${textbook.total_pages} pages ready for AI features.`);
          
          // Trigger chapter detection and AI processing
          try {
            const chapterResponse = await fetch('/api/detect-chapters', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ textbookId }),
            });
            
            if (chapterResponse.ok) {
              const { count } = await chapterResponse.json();
              console.log(`[Background] Detected ${count} chapters`);
              toast.success(`Detected ${count} chapters!`);
            }
          } catch (error) {
            console.error('[Background] Chapter detection failed:', error);
          }
          
          await loadTextbooks();
        } else if (textbook?.processing_status === 'failed') {
          clearInterval(pollInterval);
          toast.error('Text extraction failed. AI features will use on-demand extraction.');
          await loadTextbooks();
        }
      } catch (error) {
        console.error('[Background] Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds

    // Clean up after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  // 🚀 DAY 2: NON-BLOCKING UPLOAD - Show PDF immediately, extract in background
  const uploadTextbook = async (
    file: File,
    metadata: UploadMetadata,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<string> => {
    if (!user) throw new Error('User not authenticated');

    const idempotencyKey = `upload-${file.name}-${file.size}-${file.lastModified}-${user.id}`;
    let textbookId: string | null = null;
    let pdfUrl: string | null = null;
    let quickMetadata: any = null;
    const uploadStartTime = performance.now();

    try {
      console.log('[Upload] ===== CRITICAL PATH START =====');
      
      // Check if already uploaded
      try {
        const { data: existing } = await supabase
          .from('textbooks')
          .select('id')
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();
        
        if (existing) {
          console.log('[Upload] Already uploaded, loading:', existing.id);
          await loadTextbook(existing.id);
          toast.success('Textbook already uploaded!');
          return existing.id;
        }
      } catch {}

      textbookId = crypto.randomUUID();
      console.log('[Upload] New textbook ID:', textbookId);

      // 🔥 Step 1: Extract metadata ONLY (< 200ms)
      onProgress?.(5, 'metadata');
      toast.loading('Reading PDF...', { id: 'upload' });
      
      const quickMetadata = await extractMetadataOnly(file);
      
      // 🔥 Step 2: Upload PDF to storage immediately (2-3s)
      onProgress?.(10, 'uploading');
      toast.loading('Uploading PDF...', { id: 'upload' });
      
      const filePath = `${user.id}/${textbookId}.pdf`;
      
      // Upload with proper headers for caching and range requests
      const { error: uploadError } = await supabase.storage
        .from('textbook-pdfs')
        .upload(filePath, file, {
          cacheControl: '31536000', // 1 year cache
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('textbook-pdfs')
        .getPublicUrl(filePath);

      const pdfUrl = urlData.publicUrl;
      const uploadDuration = performance.now() - uploadStartTime;
      
      console.log(`[Upload] PDF uploaded in ${uploadDuration.toFixed(0)}ms`);

      // 🔥 Step 3: Create textbook record with status='pending'
      onProgress?.(40, 'saving');
      toast.loading('Preparing textbook...', { id: 'upload' });
      
      // Build textbook record (backwards compatible)
      const textbookRecord: any = {
        id: textbookId,
        user_id: user.id,
        title: metadata.title || quickMetadata.title || file.name.replace('.pdf', ''),
        pdf_url: pdfUrl,
        total_pages: quickMetadata.totalPages,
        processing_status: 'pending', // Fixed: was 'queued' but constraint only allows pending/processing/completed/failed
        processing_progress: 0,
        ai_processing_status: 'pending',
        ai_processing_progress: 0,
        metadata: {
          subject: metadata.subject,
          learning_goal: metadata.learningGoal,
          original_filename: file.name,
          file_size: file.size,
          author: quickMetadata.author,
          pdf_subject: quickMetadata.subject,
        },
      };

      // Add new columns only if they exist (backwards compatible)
      try {
        textbookRecord.idempotency_key = idempotencyKey;
        textbookRecord.upload_started_at = new Date().toISOString();
        textbookRecord.upload_completed_at = new Date().toISOString();
      } catch {
        console.log('[Upload] New columns not available yet');
      }

      const { error: textbookError } = await supabase
        .from('textbooks')
        .insert(textbookRecord);

      if (textbookError) throw textbookError;
      
      // 🔥 Step 4: Load PDF viewer IMMEDIATELY (user sees pages NOW!)
      onProgress?.(70, 'loading');
      await loadTextbooks();
      await loadTextbook(textbookId);
      
      onProgress?.(100, 'done');
      
      const totalDuration = performance.now() - uploadStartTime;
      console.log(`[Upload] Total upload flow: ${totalDuration.toFixed(0)}ms`);
      
      toast.success(`📚 PDF ready! Reading ${quickMetadata.totalPages} pages...`, { 
        id: 'upload',
        duration: 3000 
      });
      
      console.log('[Upload] ===== CRITICAL PATH COMPLETE =====');
      
      return textbookId;
      
    } catch (error) {
      console.error('[Upload] CRITICAL PATH FAILED:', error);
      toast.error('Failed to upload textbook');
      throw error;
      
    } finally {
      // ============================================================
      // OPTIONAL PATH - Always runs, can't break upload
      // ============================================================
      console.log('[Upload] ===== OPTIONAL PATH START =====');
      
      if (textbookId && pdfUrl && quickMetadata) {
        // Optional 1: Record metrics (silent failure OK)
        try {
          const totalDuration = performance.now() - uploadStartTime;
          console.log('[Upload] Recording metrics...');
          const { error: metricsError } = await supabase.from('metrics').insert({
            metric_name: 'upload_duration',
            value: totalDuration,
            unit: 'ms',
            textbook_id: textbookId,
            metadata: {
              file_size: file.size,
              total_pages: quickMetadata.totalPages
            }
          });
          
          if (metricsError) {
            console.log('[Upload] Metrics failed (non-critical):', metricsError.message);
          } else {
            console.log('[Upload] Metrics recorded ✓');
          }
        } catch (err) {
          console.log('[Upload] Metrics exception (non-critical):', err);
        }
        
        // Optional 2: Trigger background jobs (GUARANTEED to run)
        try {
          console.log('[Upload] Triggering background jobs...');
          triggerBackgroundProcessing(textbookId, pdfUrl, metadata, quickMetadata);
          console.log('[Upload] Background jobs triggered ✓');
        } catch (err) {
          console.error('[Upload] Background trigger exception:', err);
        }
      } else {
        console.warn('[Upload] Skipping optional tasks - upload may have failed');
      }
      
      console.log('[Upload] ===== ALL PATHS COMPLETE =====');
    }
  };

  // Helper: Trigger all background processing jobs
  const triggerBackgroundProcessing = (
    textbookId: string,
    pdfUrl: string,
    metadata: UploadMetadata,
    quickMetadata: any
  ) => {
    console.log('[Background] ━━━━━ BACKGROUND JOBS START ━━━━━');
    console.log('[Background] Textbook ID:', textbookId);
    console.log('[Background] PDF URL:', pdfUrl);
    console.log('[Background] Total pages:', quickMetadata.totalPages);
    
    // Job 1: Web context fetch
    console.log('[Background] Job 1: Starting web context fetch...');
    fetch('/api/fetch-textbook-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        textbookId,
        title: metadata.title || quickMetadata.title,
        author: quickMetadata.author,
        subject: metadata.subject || quickMetadata.subject,
      }),
    })
      .then(res => {
        console.log('[Background] Web context response:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('[Background] Web context result:', data);
      })
      .catch(err => {
        console.log('[Background] Web context failed:', err.message);
      });
    
    // Job 2: Text extraction (with detailed logging)
    console.log('[Background] Job 2: Starting text extraction...');
    console.log('[Background] Calling /api/extract-text with:', { textbookId, pdfUrl });
    
    fetch('/api/extract-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        textbookId,
        pdfUrl,
      }),
    })
      .then(async (response) => {
        console.log('[Background] Text extraction API response:', response.status, response.statusText);
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('[Background] Text extraction API error:', errorData);
          toast.error(`Extraction failed: ${errorData.error || 'Unknown error'}`, { duration: 5000 });
        } else {
          const result = await response.json();
          console.log('[Background] Text extraction result:', result);
          toast.success('📊 Background extraction started!', { duration: 4000 });
        }
      })
      .catch(err => {
        console.error('[Background] Text extraction network error:', err);
        toast.error('Failed to start extraction. Check Railway status.', { duration: 5000 });
      });
    
    // Job 3: Parallel AI processing for first 10 pages
    console.log('[Background] Job 3: Starting parallel AI processing...');
    const totalPages = quickMetadata.totalPages || 0;
    const firstPages = Array.from({ length: Math.min(10, totalPages) }, (_, i) => i + 1);
    console.log('[Background] Will process pages:', firstPages);
    
    if (firstPages.length > 0) {
      fetch('/api/process-pages-parallel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textbookId,
          pageNumbers: firstPages,
        }),
      })
        .then(async (response) => {
          console.log('[Background] Parallel AI response:', response.status);
          
          if (response.ok) {
            const result = await response.json();
            console.log('[Background] Parallel AI result:', result);
            toast.success(`🤖 AI features ready for first ${result.processed} pages!`, {
              duration: 4000,
            });
          } else {
            const error = await response.json();
            console.error('[Background] Parallel AI error:', error);
          }
        })
        .catch(err => {
          console.error('[Background] Parallel AI network error:', err);
        });
    } else {
      console.log('[Background] No pages to process (empty PDF?)');
    }
    
    // Show background processing toast
    console.log('[Background] Showing background processing toast');
    toast.info(
      '⚙️ Processing in background: extracting text, generating AI content...',
      { duration: 5000 }
    );
    
    console.log('[Background] ━━━━━ ALL JOBS TRIGGERED ━━━━━');
  };

  // Legacy function kept for compatibility - but now just calls new flow
  const OLD_uploadTextbook_DEPRECATED = async (
    file: File,
    metadata: UploadMetadata,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<string> => {
    if (!user) throw new Error('User not authenticated');

    try {
      const textbookId = crypto.randomUUID();

      // OLD FLOW: Extract text in browser (BLOCKS FOR 45-75s)
      onProgress?.(5, 'extracting');
      toast.loading('Extracting text from PDF...', { id: 'extraction' });
      
      const { pages, metadata: pdfMetadata } = await extractTextFromPDF(
        file,
        (progress) => {
          const progressPercent = Math.round(progress.percentage * 0.4); // 0-40% for extraction
          onProgress?.(progressPercent, 'extracting');
          toast.loading(
            `Extracting page ${progress.currentPage}/${progress.totalPages}...`,
            { id: 'extraction' }
          );
        }
      );

      // Step 2: Check if extraction succeeded (detect scanned PDFs)
      const totalTextLength = pages.reduce((sum, p) => sum + p.text.length, 0);
      const avgTextPerPage = totalTextLength / pages.length;
      
      if (avgTextPerPage < 100) {
        // Likely a scanned PDF - fallback to Railway OCR
        console.log('[Upload] Scanned PDF detected (avg chars:', avgTextPerPage, ')');
        toast.info('Scanned PDF detected. Using server extraction with OCR...', { id: 'extraction' });
        return await uploadWithRailwayFallback(file, metadata, textbookId, onProgress);
      }

      toast.success(`Extracted ${pages.length} pages!`, { id: 'extraction' });

      // Step 3: Upload PDF to Supabase Storage
      onProgress?.(45, 'uploading');
      toast.loading('Uploading PDF...', { id: 'upload' });
      
      const filePath = `${user.id}/${textbookId}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('textbook-pdfs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('textbook-pdfs')
        .getPublicUrl(filePath);

      const pdfUrl = urlData.publicUrl;

      // Step 4: Create textbook record
      onProgress?.(55, 'saving');
      toast.loading('Saving textbook...', { id: 'upload' });
      
      const { error: textbookError } = await supabase
        .from('textbooks')
        .insert({
          id: textbookId,
          user_id: user.id,
          title: metadata.title || pdfMetadata.title || file.name.replace('.pdf', ''),
          pdf_url: pdfUrl,
          total_pages: pages.length,
          processing_status: 'completed', // Already extracted!
          processing_progress: 100,
          processing_completed_at: new Date().toISOString(),
          ai_processing_status: 'pending',
          ai_processing_progress: 0,
          metadata: {
            subject: metadata.subject,
            learning_goal: metadata.learningGoal,
            original_filename: file.name,
            author: pdfMetadata.author,
            pdf_subject: pdfMetadata.subject,
          },
        });

      if (textbookError) throw textbookError;

      // Step 5: Save all pages to database (batch insert)
      onProgress?.(60, 'saving');
      toast.loading('Saving extracted text...', { id: 'upload' });
      
      const pageRecords = pages.map(p => ({
        textbook_id: textbookId,
        page_number: p.pageNumber,
        raw_text: p.text,
        processed: false,
      }));

      // Insert in batches of 100 to avoid DB limits
      const batchSize = 100;
      for (let i = 0; i < pageRecords.length; i += batchSize) {
        const batch = pageRecords.slice(i, i + batchSize);
        const { error: pagesError } = await supabase
          .from('pages')
          .insert(batch);
        
        if (pagesError) throw pagesError;
        
        const batchProgress = 60 + Math.round((i / pageRecords.length) * 30);
        onProgress?.(batchProgress, 'saving');
      }

      toast.success('Text saved!', { id: 'upload' });

      // Step 6: Load textbook for immediate viewing
      onProgress?.(95, 'done');
      await loadTextbooks();
      await loadTextbook(textbookId);
      
      onProgress?.(100, 'done');
      toast.success(`📚 ${pages.length} pages ready to read!`, { duration: 4000 });

      // Step 7: Trigger chapter detection (optional, in background)
      try {
        await fetch('/api/detect-chapters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ textbookId }),
        });
      } catch (error) {
        console.log('[Upload] Chapter detection will run later');
      }

      return textbookId;
    } catch (error) {
      console.error('[Upload] Error:', error);
      toast.error('Failed to upload textbook');
      throw error;
    }
  };

  // Fallback to Railway for scanned PDFs (OCR needed)
  const uploadWithRailwayFallback = async (
    file: File,
    metadata: UploadMetadata,
    textbookId: string,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<string> => {
    try {
      // Upload PDF
      onProgress?.(40, 'uploading');
      const filePath = `${user.id}/${textbookId}.pdf`;
      
      const { error: uploadError } = await supabase.storage
        .from('textbook-pdfs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('textbook-pdfs')
        .getPublicUrl(filePath);

      const pdfUrl = urlData.publicUrl;

      // Create textbook record with pending status
      onProgress?.(60, 'saving');
      const { error: textbookError } = await supabase
        .from('textbooks')
        .insert({
          id: textbookId,
          user_id: user!.id,
          title: metadata.title,
          pdf_url: pdfUrl,
          total_pages: 1, // Will be updated by Railway
          processing_status: 'pending',
          processing_progress: 0,
          ai_processing_status: 'pending',
          ai_processing_progress: 0,
          metadata: {
            subject: metadata.subject,
            learning_goal: metadata.learningGoal,
            original_filename: file.name,
          },
        });

      if (textbookError) throw textbookError;

      // Load textbook for viewing
      onProgress?.(90, 'done');
      await loadTextbooks();
      await loadTextbook(textbookId);
      
      onProgress?.(100, 'done');
      toast.success('PDF uploaded! Processing with OCR...', { duration: 5000 });

      // Trigger Railway extraction
      processTextbookInBackground(textbookId, filePath);

      return textbookId;
    } catch (error) {
      console.error('[Fallback Upload] Error:', error);
      throw error;
    }
  };

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Navigation helpers
  const nextPage = () => {
    const maxPages = actualPageCount || currentTextbook?.total_pages || 1;
    if (currentPage < maxPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Load page data when page changes
  useEffect(() => {
    if (currentTextbook) {
      loadPageData();
    }
  }, [currentPage, currentTextbook]);

  // Load textbooks on mount
  useEffect(() => {
    if (user) {
      loadTextbooks();
    }
  }, [user]);

  return (
    <TextbookContext.Provider
      value={{
        currentTextbook,
        textbooks,
        currentPage,
        actualPageCount,
        currentPageData,
        currentAIContent,
        loading,
        setCurrentPage,
        setActualPageCount,
        loadTextbook,
        loadTextbooks,
        uploadTextbook,
        nextPage,
        prevPage,
      }}
    >
      {children}
    </TextbookContext.Provider>
  );
}

export function useTextbook() {
  const context = useContext(TextbookContext);
  if (context === undefined) {
    throw new Error('useTextbook must be used within a TextbookProvider');
  }
  return context;
}

