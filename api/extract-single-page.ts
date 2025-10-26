// 🔥 FIX BUG #3: On-demand single page extraction with retry logic
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
// @ts-ignore - pdf-parse has inconsistent module exports
const pdfParse = require('pdf-parse');

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Helper function to download PDF with retry logic
async function downloadPDFWithRetry(url: string, maxRetries = 3): Promise<Buffer> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Extract] Download attempt ${attempt}/${maxRetries}`);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      console.log(`[Extract] Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
      return buffer;
      
    } catch (error: any) {
      lastError = error;
      console.error(`[Extract] Download attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
        console.log(`[Extract] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`Failed to download PDF after ${maxRetries} attempts: ${lastError?.message}`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();

  try {
    const { textbookId, pageNumber } = req.body;

    if (!textbookId || !pageNumber) {
      return res.status(400).json({ error: 'Missing textbookId or pageNumber' });
    }

    console.log(`[Extract] Page ${pageNumber} for textbook ${textbookId}`);

    // Check cache first
    let existingPage;
    try {
      const { data, error } = await supabase
        .from('pages')
        .select('raw_text')
        .eq('textbook_id', textbookId)
        .eq('page_number', pageNumber)
        .maybeSingle();

      if (!error && data?.raw_text) {
        const cacheTime = Date.now() - startTime;
        console.log(`[Extract] Cache hit (${cacheTime}ms)`);
        return res.status(200).json({
          text: data.raw_text,
          cached: true,
          duration: cacheTime,
        });
      }
    } catch (cacheError) {
      console.warn('[Extract] Cache check failed, proceeding with extraction');
    }

    // Get textbook PDF URL
    const { data: textbook, error: textbookError } = await supabase
      .from('textbooks')
      .select('pdf_url')
      .eq('id', textbookId)
      .single();

    if (textbookError || !textbook?.pdf_url) {
      console.error('[Extract] Textbook not found:', textbookError);
      return res.status(404).json({ error: 'Textbook not found' });
    }

    // Download PDF with retry logic
    console.log(`[Extract] Downloading PDF...`);
    const buffer = await downloadPDFWithRetry(textbook.pdf_url);

    // Extract text using pdf-parse
    console.log(`[Extract] Extracting text from page ${pageNumber}`);
    const extractStart = Date.now();
    
    const pdfData = await pdfParse(buffer, {
      max: pageNumber, // Only parse up to requested page
    });

    const extractTime = Date.now() - extractStart;
    console.log(`[Extract] Parsed ${pdfData.numpages} pages in ${extractTime}ms`);

    // Split by form feed to get individual pages
    const pages = pdfData.text.split('\f');
    const pageIndex = pageNumber - 1;

    if (pageIndex < 0 || pageIndex >= pages.length) {
      console.error(`[Extract] Page ${pageNumber} not found (PDF has ${pages.length} pages)`);
      return res.status(400).json({ 
        error: `Invalid page number. PDF has ${pages.length} pages.` 
      });
    }

    const pageText = pages[pageIndex]?.trim() || 
      `[Page ${pageNumber} - No extractable text detected. This may be a scanned image.]`;
      
    console.log(`[Extract] Extracted ${pageText.length} characters`);

    // Cache the extracted page
    try {
      await supabase.from('pages').insert({
        textbook_id: textbookId,
        page_number: pageNumber,
        raw_text: pageText,
        processed: false,
      });
      console.log(`[Extract] Cached successfully`);
    } catch (insertError: any) {
      // If insert fails due to duplicate (race condition), that's okay
      if (insertError.code === '23505') {
        console.log('[Extract] Page already cached by another request');
      } else {
        console.error('[Extract] Cache failed:', insertError.message);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Extract] Complete in ${totalTime}ms`);

    return res.status(200).json({
      text: pageText,
      cached: false,
      duration: totalTime,
      metrics: {
        extractTime: Date.now() - startTime,
        textLength: pageText.length,
      },
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[Extract] Error:', error);

    // Determine error type and appropriate response
    let errorMessage = 'Failed to extract page';
    let statusCode = 500;

    if (error.message?.includes('timeout') || error.message?.includes('abort')) {
      errorMessage = 'PDF download timed out. Please try again.';
      statusCode = 504;
    } else if (error.message?.includes('Invalid PDF') || error.message?.includes('parse')) {
      errorMessage = 'Invalid or corrupted PDF file';
      statusCode = 400;
    } else if (error.message?.includes('download')) {
      errorMessage = 'Failed to download PDF. Check if the file is accessible.';
      statusCode = 502;
    }

    return res.status(statusCode).json({
      error: errorMessage,
      details: error.message,
      duration,
    });
  }
}

export const config = {
  runtime: 'nodejs', // Keep Node.js - pdf-parse works best here
  maxDuration: 60, // Allow time for retries and large PDFs
};


