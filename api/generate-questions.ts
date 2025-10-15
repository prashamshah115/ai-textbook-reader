// Smart AI Question Generation
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
    const { textbookId, userId, count = 5, pageNumbers } = await req.json();

    if (!textbookId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Questions] Generating ${count} questions for user ${userId}`);

    // Get weak topics for this user
    const { data: stats } = await supabase
      .from('user_reading_stats')
      .select('topic, confidence_score, times_failed')
      .eq('user_id', userId)
      .eq('textbook_id', textbookId)
      .order('confidence_score', { ascending: true })
      .limit(3);

    const weakTopics = stats?.map(s => s.topic) || [];
    console.log(`[Questions] Weak topics:`, weakTopics);

    // Get page content
    let query = supabase
      .from('pages')
      .select('raw_text, page_number')
      .eq('textbook_id', textbookId);

    if (pageNumbers && pageNumbers.length > 0) {
      query = query.in('page_number', pageNumbers);
    } else {
      query = query.limit(5);
    }

    const { data: pages } = await query;
    const pageTexts = pages?.map(p => `Page ${p.page_number}:\n${p.raw_text}`).join('\n\n') || '';

    if (!pageTexts) {
      return new Response(
        JSON.stringify({ error: 'No page content found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate questions with OpenAI
    const systemPrompt = weakTopics.length > 0
      ? `You are generating practice questions for a student.

Student struggles with: ${weakTopics.join(', ')}

Generate ${count} questions in JSON format:
{
  "questions": [
    {
      "question": "...",
      "answer": "...",
      "difficulty": "easy|medium|hard",
      "topic": "...",
      "hint": "helpful hint for struggling students",
      "page_number": number
    }
  ]
}

Focus on the topics where the student struggles. Include helpful hints.
Make questions progressively harder but start easy to build confidence.`
      : `You are generating practice questions from textbook content.

Generate ${count} well-structured questions in JSON format:
{
  "questions": [
    {
      "question": "...",
      "answer": "...",
      "difficulty": "easy|medium|hard",
      "topic": "...",
      "hint": "helpful hint",
      "page_number": number
    }
  ]
}

Create a mix of easy, medium, and hard questions.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: pageTexts.slice(0, 8000) }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content returned from OpenAI');
    }
    
    const result = JSON.parse(content);
    const questions = result.questions || [];

    console.log(`[Questions] Generated ${questions.length} questions`);

    // Save to flashcards
    const flashcards = questions.map((q: any) => ({
      user_id: userId,
      textbook_id: textbookId,
      page_number: q.page_number || pages?.[0]?.page_number || null,
      question: q.question,
      answer: q.answer,
      hint: q.hint,
      source: 'ai_generated',
      difficulty: q.difficulty || 'medium',
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('flashcards')
      .insert(flashcards)
      .select();

    if (insertError) {
      console.error('[Questions] Insert error:', insertError);
      throw insertError;
    }

    console.log(`[Questions] Saved ${inserted?.length} flashcards`);

    return new Response(
      JSON.stringify({
        questions,
        saved: inserted?.length || 0,
        weakTopics,
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[Questions] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate questions',
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

