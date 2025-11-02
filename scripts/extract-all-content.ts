#!/usr/bin/env ts-node
/**
 * Batch Extraction Script
 * 
 * Populates extracted_text for all content items with status='pending'
 * 
 * Usage:
 *   npm run extract-all
 *   OR
 *   ts-node scripts/extract-all-content.ts
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import fetch from 'node-fetch';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICEKEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const parallelApiKey = process.env.PARALLEL_API_KEY || process.env.VITE_PARALLEL_API_KEY!;

if (!supabaseUrl || !supabaseServiceKey || !parallelApiKey) {
  console.error('❌ Missing environment variables:');
  console.error('   VITE_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICEKEY:', !!supabaseServiceKey);
  console.error('   PARALLEL_API_KEY:', !!parallelApiKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const RATE_LIMIT_DELAY = 5000; // 5 seconds between requests to avoid rate limits

interface ContentItem {
  id: string;
  title: string;
  source_url: string | null;
  extraction_status: string;
  content_type: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractContentItem(item: ContentItem): Promise<boolean> {
  try {
    console.log(`  📄 Extracting: ${item.title}`);
    console.log(`  🔗 URL: ${item.source_url}`);

    if (!item.source_url) {
      console.error(`  ❌ No source URL`);
      return false;
    }

    // Update status to processing
    await supabase
      .from('content_items')
      .update({ extraction_status: 'processing' })
      .eq('id', item.id);

    // Call Parallel AI to extract text
    console.log(`  🔄 Calling Parallel AI...`);
    
    const response = await fetch('https://api.parallel.ai/v1beta/search', {
      method: 'POST',
      headers: {
        'x-api-key': parallelApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        objective: `Extract the full text content from this document: ${item.source_url}. Include all text, headings, paragraphs, and important information.`,
        processor: 'base',
        max_results: 1,
        max_chars_per_result: 20000,
      }),
    });

    console.log(`  📡 Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`  ❌ Parallel API failed (${response.status}):`, errorText);
      
      await supabase
        .from('content_items')
        .update({ 
          extraction_status: 'failed',
          extraction_error: `Parallel API error: ${response.status}`
        })
        .eq('id', item.id);
      
      return false;
    }

    const result = await response.json();
    console.log(`  📊 Response keys:`, Object.keys(result));
    
    // Parse results - format from extract-content.ts
    let extractedText = '';
    if (result.results && result.results.length > 0) {
      console.log(`  📊 Found ${result.results.length} results`);
      console.log(`  📊 First result keys:`, Object.keys(result.results[0]));
      console.log(`  📊 First result sample:`, JSON.stringify(result.results[0]).substring(0, 300));
      
      extractedText = result.results
        .map((r: any) => {
          if (r.excerpts && Array.isArray(r.excerpts)) {
            return r.excerpts.join('\n\n');
          }
          return r.text || r.content || r.answer || r.output || '';
        })
        .join('\n\n')
        .trim();
    } else {
      console.log(`  ⚠️  Result structure:`, JSON.stringify(result).substring(0, 200));
    }

    if (!extractedText) {
      console.error(`  ❌ No text extracted`);
      
      await supabase
        .from('content_items')
        .update({ 
          extraction_status: 'failed',
          extraction_error: 'No text found in response'
        })
        .eq('id', item.id);
      
      return false;
    }

    // Update with extracted text
    await supabase
      .from('content_items')
      .update({
        extracted_text: extractedText,
        extraction_status: 'completed',
        extracted_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    console.log(`  ✅ Success: ${extractedText.length} chars extracted`);
    return true;

  } catch (error) {
    const errorMessage = error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown error';
    console.error(`  ❌ Error:`, errorMessage);
    if (error instanceof Error && error.stack) {
      console.error(`  Stack:`, error.stack.split('\n')[0]);
    }
    
    await supabase
      .from('content_items')
      .update({ 
        extraction_status: 'failed',
        extraction_error: errorMessage
      })
      .eq('id', item.id);
    
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('    Batch Content Extraction Script');
  console.log('═══════════════════════════════════════════════════\n');

  // Fetch all content items with pending extraction
  console.log('🔍 Fetching pending content items...\n');

  const { data: items, error } = await supabase
    .from('content_items')
    .select('id, title, source_url, extraction_status, content_type')
    .eq('extraction_status', 'pending')
    .not('source_url', 'is', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Database error:', error.message);
    process.exit(1);
  }

  if (!items || items.length === 0) {
    console.log('✅ No pending items found. All content is extracted!');
    process.exit(0);
  }

  console.log(`📊 Found ${items.length} items to extract\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i] as ContentItem;
    
    console.log(`[${i + 1}/${items.length}] ${item.content_type.toUpperCase()}`);
    
    const success = await extractContentItem(item);
    
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Rate limiting: wait between requests
    if (i < items.length - 1) {
      await sleep(RATE_LIMIT_DELAY);
    }

    console.log(''); // Empty line for readability
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                   SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed:     ${failCount}`);
  console.log(`📊 Total:      ${items.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (failCount > 0) {
    console.log('⚠️  Some extractions failed. Check logs above for details.');
    console.log('   You can re-run this script to retry failed items.\n');
  } else {
    console.log('🎉 All extractions completed successfully!\n');
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});


