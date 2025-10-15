// Semantic search using pgvector
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

  try {
    const { query, textbookId, threshold = 0.7, limit = 10 } = await req.json();

    if (!query || !textbookId) {
      return new Response(
        JSON.stringify({ error: 'Missing query or textbookId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Search] Query: "${query}" for textbook ${textbookId}`);

    // Generate embedding for query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Search using pgvector similarity
    const { data: results, error } = await supabase.rpc('match_pages', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      filter_textbook_id: textbookId,
    });

    if (error) {
      console.error('[Search] RPC error:', error);
      throw error;
    }

    console.log(`[Search] Found ${results?.length || 0} results`);

    // Log search query
    await supabase.from('search_queries').insert({
      query_text: query,
      textbook_id: textbookId,
      results_count: results?.length || 0,
    });

    return new Response(
      JSON.stringify({
        results: results || [],
        query,
        count: results?.length || 0,
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[Search] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Search failed',
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
};

