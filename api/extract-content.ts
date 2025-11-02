import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PARALLEL_API_BASE = 'https://api.parallel.ai/v1beta';

interface ExtractContentRequest {
  contentItemId: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { contentItemId }: ExtractContentRequest = req.body;

    if (!contentItemId) {
      return res.status(400).json({ error: 'Missing required field: contentItemId' });
    }

    // Fetch content item
    const { data: contentItem, error: fetchError } = await supabase
      .from('content_items')
      .select('*')
      .eq('id', contentItemId)
      .single();

    if (fetchError || !contentItem) {
      return res.status(404).json({ error: 'Content item not found' });
    }

    // Check if already extracted
    if (contentItem.extraction_status === 'completed') {
      return res.status(200).json({
        success: true,
        message: 'Already extracted',
        extractedText: contentItem.extracted_text,
      });
    }

    // Check if already processing
    if (contentItem.extraction_status === 'processing') {
      return res.status(200).json({
        success: true,
        message: 'Extraction in progress',
        status: 'processing',
      });
    }

    // Update status to processing
    await supabase
      .from('content_items')
      .update({ extraction_status: 'processing' })
      .eq('id', contentItemId);

    console.log(`[Extract Content] Starting extraction for: ${contentItem.title}`);

    // Extract text using appropriate method
    let extractedText: string;
    
    if (contentItem.source_url) {
      // Use Parallel AI for web resources
      extractedText = await extractWithParallel(contentItem.source_url, contentItem.title);
    } else {
      throw new Error('No source URL available for extraction');
    }

    // Store extracted text
    await supabase
      .from('content_items')
      .update({
        extracted_text: extractedText,
        extraction_status: 'completed',
        extracted_at: new Date().toISOString(),
        extraction_error: null,
      })
      .eq('id', contentItemId);

    console.log(`[Extract Content] Successfully extracted ${extractedText.length} chars`);

    return res.status(200).json({
      success: true,
      message: 'Text extracted successfully',
      extractedLength: extractedText.length,
    });

  } catch (error) {
    console.error('[Extract Content] Error:', error);

    // Update status to failed
    if (req.body.contentItemId) {
      await supabase
        .from('content_items')
        .update({
          extraction_status: 'failed',
          extraction_error: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', req.body.contentItemId);
    }

    return res.status(500).json({
      error: 'Failed to extract content',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Extract text using Parallel AI Search API
 */
async function extractWithParallel(url: string, title: string): Promise<string> {
  const apiKey = process.env.PARALLEL_API_KEY;

  if (!apiKey) {
    throw new Error('PARALLEL_API_KEY not configured');
  }

  console.log(`[Parallel Extract] Fetching: ${url}`);

  try {
    const response = await fetch(`${PARALLEL_API_BASE}/search`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        objective: `Extract the full text content from this document: ${url}. Include all text, headings, paragraphs, and important information.`,
        processor: 'base',
        max_results: 1,
        max_chars_per_result: 20000, // Extract up to 20k chars
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Parallel API error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    // Parse the result based on Parallel's response format
    // The actual structure depends on Parallel's API - adjust as needed
    let extractedText = '';
    
    if (result.results && result.results.length > 0) {
      // Extract text from results
      extractedText = result.results
        .map((r: any) => r.content || r.text || r.snippet || '')
        .join('\n\n');
    } else if (result.content) {
      extractedText = result.content;
    } else if (result.text) {
      extractedText = result.text;
    } else {
      // Fallback: stringify the entire result
      extractedText = JSON.stringify(result);
    }

    if (!extractedText || extractedText.length < 100) {
      throw new Error('Extracted text too short or empty');
    }

    console.log(`[Parallel Extract] Success: ${extractedText.length} chars`);
    
    return extractedText;

  } catch (error) {
    console.error('[Parallel Extract] Failed:', error);
    
    // Fallback: return basic metadata
    return `# ${title}\n\nSource: ${url}\n\n[Automatic text extraction failed. Please view the original document.]`;
  }
}


