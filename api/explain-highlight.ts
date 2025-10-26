// 🔥 PHASE 3: Instant Highlight Explanations using Groq (Llama 3.1)
import { createClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Simple in-memory cache (for same-session repeated highlights)
const explanationCache = new Map<string, string>();
const MAX_CACHE_SIZE = 100;

function hashText(text: string): string {
  // Simple hash for caching (not cryptographic)
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const startTime = Date.now();

  try {
    const { text, context } = await req.json();
    const { docId, pageNum } = context || {};

    if (!text || text.length < 5) {
      return Response.json(
        { error: 'Text is too short to explain' },
        { status: 400 }
      );
    }

    // Truncate very long selections
    const truncatedText = text.length > 1000 
      ? text.substring(0, 1000) + '...'
      : text;

    // Generate cache key
    const cacheKey = hashText(truncatedText);

    // Check cache
    if (explanationCache.has(cacheKey)) {
      const cached = explanationCache.get(cacheKey)!;
      console.log(`[Explain] Cache hit ✓ (${Date.now() - startTime}ms)`);
      return Response.json({
        explanation: cached,
        cached: true,
        duration: Date.now() - startTime,
      });
    }

    // Fetch context from extracted text (for Sprint content)
    let additionalContext = '';
    
    // Try to fetch from content_items (Sprint system)
    if (docId) {
      try {
        const { data: contentItem } = await supabase
          .from('content_items')
          .select('title, extracted_text, content_type')
          .eq('id', docId)
          .maybeSingle();

        if (contentItem && contentItem.extracted_text) {
          // Find surrounding context (±500 chars around selected text)
          const textIndex = contentItem.extracted_text.indexOf(truncatedText);
          if (textIndex >= 0) {
            const start = Math.max(0, textIndex - 500);
            const end = Math.min(contentItem.extracted_text.length, textIndex + truncatedText.length + 500);
            const surroundingText = contentItem.extracted_text.slice(start, end);
            
            additionalContext = `Source: ${contentItem.title} (${contentItem.content_type})\n\nSurrounding context:\n${surroundingText}`;
          } else {
            additionalContext = `Source: ${contentItem.title} (${contentItem.content_type})`;
          }
        }
      } catch (err) {
        console.warn('[Explain] Failed to fetch from content_items:', err);
      }
    }
    
    // Fallback to textbooks table (legacy system)
    if (!additionalContext && docId) {
      try {
        const { data: textbook } = await supabase
          .from('textbooks')
          .select('title, metadata')
          .eq('id', docId)
          .maybeSingle();

        if (textbook) {
          additionalContext = `Textbook: ${textbook.title}`;
          if (textbook.metadata?.subject) {
            additionalContext += `\nSubject: ${textbook.metadata.subject}`;
          }
          if (pageNum) {
            additionalContext += `\nPage: ${pageNum}`;
          }
        }
      } catch (err) {
        console.warn('[Explain] Failed to fetch from textbooks:', err);
      }
    }

    // Generate explanation using Groq (Llama 3.1 - FAST)
    console.log(`[Explain] Generating with Groq...`);
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant', // Fast, cost-effective
      messages: [
        {
          role: 'system',
          content: `You are a helpful tutor explaining textbook concepts. Be concise (2-3 sentences max). Focus on clarity and simplicity.${additionalContext ? `\n\nContext:\n${additionalContext}` : ''}`,
        },
        {
          role: 'user',
          content: `Explain this highlighted text:\n\n"${truncatedText}"`,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const explanation: string = completion.choices[0]?.message?.content || 'No explanation generated.';

    // Cache result (with size limit)
    if (explanationCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entry (first key)
      const firstKey = explanationCache.keys().next().value;
      explanationCache.delete(firstKey);
    }
    explanationCache.set(cacheKey, explanation);

    const duration = Date.now() - startTime;
    console.log(`[Explain] ✓ Generated in ${duration}ms`);

    return Response.json({
      explanation,
      cached: false,
      duration,
      model: 'llama-3.1-8b-instant',
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[Explain] Error:', error);

    // Handle rate limits gracefully
    if (error.status === 429) {
      return Response.json(
        {
          error: 'Rate limit reached. Please try again in a moment.',
          duration,
        },
        { status: 429 }
      );
    }

    return Response.json(
      {
        error: 'Failed to generate explanation',
        details: error.message,
        duration,
      },
      { status: 500 }
    );
  }
}

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

