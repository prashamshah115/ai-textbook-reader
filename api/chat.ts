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

// 🔥 FIX BUG #1: Updated to match ChatContext's context structure
interface ChatRequest {
  message: string;
  context: {
    page: number;
    pageText?: string;
    previousPageText?: string;
    nextPageText?: string;
    textbookTitle?: string;
    textbookAuthor?: string;
    textbookOverview?: string;
    keyTopics?: string[];
    chapterSummary?: string;
    userNotes?: string;
    aiInsights?: {
      applications?: any;
      keyConcepts?: any;
    };
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

    console.log('[Chat API] Request received', {
      conversationId,
      hasPageText: !!context.pageText,
      page: context.page,
      hasOverview: !!context.textbookOverview,
    });

    // 🔥 FIX BUG #2: Verify conversation exists (removed user_preferences query)
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('user_id, textbook_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('[Chat API] Conversation not found:', convError);
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { 
          status: 404, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // Build system prompt with available context
    const systemPrompt = buildSystemPrompt(context);

    console.log('[Chat API] Starting OpenAI stream');

    // 🔥 Stream chat responses using SSE
    const stream = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 1000,
      stream: true,
    });

    // Create SSE response stream
    const encoder = new TextEncoder();
    let firstTokenSent = false;
    const startTime = Date.now();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            
            if (content) {
              // Track first token latency
              if (!firstTokenSent) {
                const firstTokenLatency = Date.now() - startTime;
                console.log(`[Chat] First token in ${firstTokenLatency}ms`);
                firstTokenSent = true;
              }

              // Send SSE formatted data
              const data = JSON.stringify({ content });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          // Send completion marker
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          console.log('[Chat API] Stream completed');
          controller.close();
        } catch (error) {
          console.error('[Chat API] Stream error:', error);
          const errorData = JSON.stringify({ 
            error: error instanceof Error ? error.message : 'Stream error' 
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Chat API] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// 🔥 FIX BUG #2: Build system prompt from available context
function buildSystemPrompt(context: ChatRequest['context']): string {
  const parts: string[] = [
    'You are a helpful tutor assisting with textbook comprehension.',
    '',
    `Current Page: ${context.page}`,
  ];

  // Add textbook overview if available
  if (context.textbookOverview) {
    parts.push('', '📚 Textbook Overview:');
    parts.push(context.textbookOverview);
    
    if (context.textbookAuthor) {
      parts.push(`Author: ${context.textbookAuthor}`);
    }
    if (context.textbookTitle) {
      parts.push(`Title: ${context.textbookTitle}`);
    }
    if (context.keyTopics && context.keyTopics.length > 0) {
      parts.push(`Key Topics: ${context.keyTopics.join(', ')}`);
    }
  }

  // Add chapter context
  if (context.chapterSummary) {
    parts.push('', '📖 Chapter Summary:');
    parts.push(context.chapterSummary);
  }

  // Add current page text (priority content)
  if (context.pageText) {
    parts.push('', `📄 Page ${context.page} Content:`);
    parts.push(context.pageText.slice(0, 2000));
    if (context.pageText.length > 2000) {
      parts.push('...(truncated for length)');
    }
  } else {
    parts.push('', '⚠️ Page text not yet extracted. Answer general questions about the textbook using available context.');
  }

  // Add neighboring context
  if (context.previousPageText) {
    parts.push('', '← Previous Page Context:');
    parts.push(context.previousPageText.slice(0, 400) + '...');
  }
  if (context.nextPageText) {
    parts.push('', '→ Next Page Context:');
    parts.push(context.nextPageText.slice(0, 400) + '...');
  }

  // Add user notes
  if (context.userNotes) {
    parts.push('', '📝 Student Notes:');
    parts.push(context.userNotes);
  }

  // Add AI insights
  if (context.aiInsights) {
    parts.push('', '🤖 AI-Generated Insights:');
    if (context.aiInsights.keyConcepts) {
      parts.push('Key Concepts:', JSON.stringify(context.aiInsights.keyConcepts, null, 2));
    }
    if (context.aiInsights.applications) {
      parts.push('Applications:', JSON.stringify(context.aiInsights.applications, null, 2));
    }
  }

  parts.push('', 'Provide clear, helpful responses based on the available context.');

  return parts.join('\n');
}

export const config = {
  runtime: 'edge',
};

