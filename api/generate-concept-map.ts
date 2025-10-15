// Generate concept map using GPT-4
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
    const { textbookId, userId, pageStart, pageEnd, chapterId } = await req.json();

    if (!textbookId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ConceptMap] Generating for pages ${pageStart}-${pageEnd}`);

    // Get page content
    const { data: pages } = await supabase
      .from('pages')
      .select('raw_text, page_number')
      .eq('textbook_id', textbookId)
      .gte('page_number', pageStart)
      .lte('page_number', pageEnd)
      .order('page_number', { ascending: true });

    if (!pages || pages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No pages found in range' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const combinedText = pages.map(p => p.raw_text).join('\n\n');

    // Generate concept map
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: `Extract key concepts and their relationships from the text.

Return JSON format:
{
  "concepts": [
    {
      "id": "unique-id",
      "name": "Concept Name",
      "description": "Brief description",
      "importance": "high|medium|low"
    }
  ],
  "relationships": [
    {
      "from": "concept-id",
      "to": "concept-id",
      "type": "prerequisite|related|extends|applies",
      "description": "How they relate"
    }
  ]
}

Focus on the most important concepts and clear relationships.`
      }, {
        role: 'user',
        content: combinedText.slice(0, 12000)
      }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content returned from OpenAI');
    }
    
    const result = JSON.parse(content);

    // Save concept map
    const { data: saved, error: saveError } = await supabase
      .from('concept_maps')
      .insert({
        user_id: userId,
        textbook_id: textbookId,
        chapter_id: chapterId,
        page_range_start: pageStart,
        page_range_end: pageEnd,
        concepts: result.concepts || [],
        relationships: result.relationships || [],
      })
      .select()
      .single();

    if (saveError) throw saveError;

    console.log(`[ConceptMap] Saved ${result.concepts?.length} concepts`);

    return new Response(
      JSON.stringify({
        id: saved.id,
        concepts: result.concepts || [],
        relationships: result.relationships || [],
        pageRange: [pageStart, pageEnd],
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[ConceptMap] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate concept map',
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
  maxDuration: 60,
};

