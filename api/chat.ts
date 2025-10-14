// Vercel Serverless Function for OpenAI Chat
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Server-side key
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ChatRequest {
  message: string;
  context: {
    pageText?: string;
    summary?: string;
    page: number;
    // Web context fields
    textbookOverview?: string;
    textbookAuthor?: string;
    textbookTitle?: string;
    keyTopics?: string[];
    // AI processed content
    pageSummary?: string;
    keyConcepts?: any;
    // Neighboring pages
    previousPageText?: string;
    nextPageText?: string;
  };
  conversationId: string;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body: ChatRequest = await req.json();
    const { message, context, conversationId } = body;

    // Get user preferences for personalization
    const { data: conversation } = await supabase
      .from('chat_conversations')
      .select('user_id, textbook_id')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      return new Response('Conversation not found', { status: 404 });
    }

    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', conversation.user_id)
      .single();

    // Build system prompt with web context bootstrapping
    const systemPrompt = `You are a helpful tutor assisting with textbook comprehension.

Student Level: ${preferences?.target_level || 'intermediate'}
Student Goal: ${preferences?.learning_goals || 'Understanding the material'}

${context.textbookOverview ? `📚 Textbook Overview (from web):\n${context.textbookOverview}\n\n` : ''}${context.textbookAuthor ? `Author: ${context.textbookAuthor}\n` : ''}${context.textbookTitle ? `Title: ${context.textbookTitle}\n` : ''}${context.keyTopics && context.keyTopics.length > 0 ? `Key Topics: ${context.keyTopics.join(', ')}\n\n` : ''}Current Context (Page ${context.page}):
${context.pageSummary ? `AI Summary: ${context.pageSummary}\n` : ''}${context.pageText ? `Page Content: ${context.pageText.slice(0, 2000)}...\n` : ''}${context.previousPageText ? `Previous Page Context: ${context.previousPageText.slice(0, 400)}...\n` : ''}
Provide clear, helpful responses that align with the student's level and goals. When full page text is available, prioritize it over the general overview.`;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content || 'No response generated';

    return new Response(
      JSON.stringify({ response }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[Chat API] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

export const config = {
  runtime: 'edge',
};

