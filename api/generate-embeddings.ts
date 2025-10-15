// Generate embeddings for semantic search
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const startTime = Date.now();

  try {
    const { textbookId, batchSize = 10 } = await req.json();

    if (!textbookId) {
      return new Response(
        JSON.stringify({ error: 'Missing textbookId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Embeddings] Generating for textbook ${textbookId}`);

    // Get pages without embeddings
    const { data: pages, error: fetchError } = await supabase
      .from('pages')
      .select('id, raw_text, page_number')
      .eq('textbook_id', textbookId)
      .is('embedding', null)
      .not('raw_text', 'is', null)
      .limit(batchSize);

    if (fetchError) throw fetchError;

    if (!pages || pages.length === 0) {
      return new Response(
        JSON.stringify({ 
          processed: 0, 
          message: 'All pages already have embeddings',
          duration: Date.now() - startTime
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Embeddings] Processing ${pages.length} pages`);

    let processed = 0;
    const errors = [];

    for (const page of pages) {
      try {
        // Truncate text to 8000 characters for embedding model
        const textToEmbed = page.raw_text.slice(0, 8000);

        // Generate embedding
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: textToEmbed,
        });

        const embedding = response.data[0].embedding;

        // Save to database
        const { error: updateError } = await supabase
          .from('pages')
          .update({
            embedding: embedding,
            embedding_model: 'text-embedding-3-small',
            embedding_created_at: new Date().toISOString(),
          })
          .eq('id', page.id);

        if (updateError) {
          errors.push({ page: page.page_number, error: updateError.message });
          console.error(`[Embeddings] Failed to save page ${page.page_number}:`, updateError);
        } else {
          processed++;
          console.log(`[Embeddings] ✓ Page ${page.page_number}`);
        }
      } catch (error: any) {
        errors.push({ page: page.page_number, error: error.message });
        console.error(`[Embeddings] Error on page ${page.page_number}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Embeddings] Completed ${processed}/${pages.length} in ${duration}ms`);

    return new Response(
      JSON.stringify({
        processed,
        total: pages.length,
        errors: errors.length > 0 ? errors : undefined,
        duration,
        remaining: pages.length - processed,
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[Embeddings] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate embeddings',
        details: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export const config = {
  runtime: 'edge',
  maxDuration: 300, // 5 minutes for batch processing
};

