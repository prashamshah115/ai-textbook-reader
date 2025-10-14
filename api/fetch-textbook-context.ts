// Vercel Edge Function for Web Context Bootstrapping
// Fetches textbook overview from web search to enable immediate chat
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface SearchRequest {
  textbookId: string;
  title: string;
  author?: string;
  subject?: string;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { textbookId, title, author, subject }: SearchRequest = await req.json();

    console.log('[Web Context] Fetching for:', title);

    // Check if already cached
    const { data: existing } = await supabase
      .from('textbook_web_context')
      .select('*')
      .eq('textbook_id', textbookId)
      .maybeSingle();

    if (existing && existing.status === 'fetched') {
      console.log('[Web Context] Using cached data');
      return new Response(
        JSON.stringify({ success: true, context: existing, cached: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build search query
    const queries = [
      `"${title}" textbook summary`,
      `"${title}" table of contents`,
      `"${title}" ${subject || ''} key concepts overview`,
    ];

    // Check if Tavily API is configured
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    
    if (!TAVILY_API_KEY) {
      console.log('[Web Context] No search API configured, using minimal context');
      const minimal = await saveMinimalContext(textbookId, title, author, subject);
      return new Response(
        JSON.stringify({ success: true, context: minimal, usedFallback: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch from Tavily with timeout
    console.log('[Web Context] Searching web...');
    const searchPromises = queries.map((query) =>
      fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query: query,
          max_results: 3,
          include_answer: true,
          search_depth: 'basic',
        }),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })
        .then((r) => r.json())
        .catch((err) => {
          console.log('[Web Context] Search timeout/error:', err.message);
          return null;
        })
    );

    const results = await Promise.allSettled(searchPromises);

    // Extract and combine results
    const summaryParts: string[] = [];
    const links: string[] = [];
    const topics: string[] = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        const data = result.value;
        if (data.answer) {
          summaryParts.push(data.answer);
        }
        if (data.results && Array.isArray(data.results)) {
          data.results.forEach((r: any) => {
            if (r.url && !links.includes(r.url)) {
              links.push(r.url);
            }
            if (r.content) {
              summaryParts.push(r.content.slice(0, 400));
            }
          });
        }
      }
    });

    // Build final summary
    const webSummary =
      summaryParts.length > 0
        ? summaryParts.join('\n\n').slice(0, 2500) // Limit to 2.5k chars
        : `This textbook is titled "${title}"${author ? ` by ${author}` : ''}.${
            subject ? ` It covers ${subject}.` : ''
          }`;

    console.log('[Web Context] Saving to database...');

    // Save to database
    const { data: saved, error } = await supabase
      .from('textbook_web_context')
      .upsert(
        {
          textbook_id: textbookId,
          title,
          author,
          subject,
          web_summary: webSummary,
          key_topics: topics.slice(0, 10),
          source_links: links.slice(0, 5),
          status: 'fetched',
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'textbook_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('[Web Context] Database error:', error);
      throw error;
    }

    // Update textbook metadata_ready flag
    await supabase
      .from('textbooks')
      .update({ metadata_ready: true })
      .eq('id', textbookId);

    console.log('[Web Context] ✅ Complete');

    return new Response(
      JSON.stringify({ success: true, context: saved }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Web Context] Error:', error);
    
    // Try to save minimal context even on error
    try {
      const body = await req.json();
      if (body.textbookId && body.title) {
        const minimal = await saveMinimalContext(
          body.textbookId,
          body.title,
          body.author,
          body.subject
        );
        return new Response(
          JSON.stringify({ success: true, context: minimal, hadError: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch {}

    return new Response(
      JSON.stringify({ error: 'Failed to fetch context' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function saveMinimalContext(
  textbookId: string,
  title: string,
  author?: string,
  subject?: string
) {
  const { data, error } = await supabase
    .from('textbook_web_context')
    .upsert(
      {
        textbook_id: textbookId,
        title,
        author,
        subject,
        web_summary: `This textbook is titled "${title}"${author ? ` by ${author}` : ''}.${
          subject ? ` It covers ${subject}.` : ''
        }`,
        key_topics: [],
        source_links: [],
        status: 'fetched',
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'textbook_id' }
    )
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('textbooks')
    .update({ metadata_ready: true })
    .eq('id', textbookId);

  return data;
}

export const config = {
  runtime: 'edge',
};

