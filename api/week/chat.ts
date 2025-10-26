import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

// Initialize clients
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

interface ChatRequest {
  bundleId: string;
  contentItemId?: string;
  currentPage?: number;
  message: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      bundleId,
      contentItemId,
      currentPage,
      message,
      conversationHistory = [],
    }: ChatRequest = req.body;

    if (!bundleId || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Fetch week bundle with all materials
    const { data: bundle, error: bundleError } = await supabase
      .from('week_bundles')
      .select('*')
      .eq('id', bundleId)
      .single();

    if (bundleError || !bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    // Fetch all content items
    const { data: contentItems, error: itemsError } = await supabase
      .from('content_items')
      .select('*')
      .eq('week_bundle_id', bundleId)
      .order('display_order', { ascending: true });

    if (itemsError) {
      throw itemsError;
    }

    // Build context with ALL materials
    const context = buildWeekBundleContext(
      bundle,
      contentItems || [],
      contentItemId,
      currentPage
    );

    // Build system prompt with multi-source awareness
    const systemPrompt = `You are an AI tutor helping a student study ${bundle.course_code} (${bundle.course_name}) at ${bundle.institution}.

This is Week ${bundle.week_number}: ${bundle.week_topic}

You have access to ALL course materials for this week:
${context}

Your capabilities:
1. Answer questions by synthesizing information from ALL available sources
2. Cross-reference between textbook, slides, homework, and papers
3. Explain concepts using examples from different materials
4. Help with homework problems by referencing relevant textbook sections and papers
5. Point out connections between theory (textbook) and practice (papers)

When answering:
- Cite specific sources (e.g., "According to Silberschatz Ch. 5..." or "The Week 3 slides explain...")
- Cross-reference materials when relevant (e.g., "This concept in the textbook relates to Problem 3.1")
- Synthesize information from multiple sources for comprehensive answers
- If a concept appears in multiple materials, mention all of them

Be conversational, clear, and educational. Help the student see connections across materials.`;

    // Prepare messages for Claude
    const messages = [
      ...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: message,
      },
    ];

    // Stream response from Claude
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      temperature: 0.7,
      system: systemPrompt,
      messages: messages,
    });

    // Set up SSE response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream tokens
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ token: chunk.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('Error in week chat:', error);
    return res.status(500).json({
      error: 'Failed to process chat',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Build comprehensive context from all week materials
 * Uses EXTRACTED TEXT for deep context (extract once, use everywhere)
 */
function buildWeekBundleContext(
  bundle: any,
  contentItems: any[],
  currentContentItemId?: string,
  currentPage?: number
): string {
  let context = '';

  // Current content being viewed
  if (currentContentItemId) {
    const currentItem = contentItems.find(item => item.id === currentContentItemId);
    if (currentItem) {
      context += `\n📍 CURRENTLY VIEWING: ${currentItem.title} (${currentItem.content_type})`;
      if (currentPage) {
        context += ` - Page ${currentPage}`;
      }
      context += '\n';
    }
  }

  context += '\n📚 AVAILABLE COURSE MATERIALS:\n\n';

  // Add extracted text from all content items
  const itemsWithText = contentItems.filter(
    item => item.extraction_status === 'completed' && item.extracted_text
  );

  if (itemsWithText.length === 0) {
    // Fallback to metadata if extraction not complete
    const aggregatedContent = bundle.aggregated_content;
    
    if (aggregatedContent.textbooks && aggregatedContent.textbooks.length > 0) {
      context += '📚 TEXTBOOKS:\n';
      aggregatedContent.textbooks.forEach((book: any) => {
        context += `  - ${book.title}`;
        if (book.authors) {
          context += ` by ${book.authors.join(', ')}`;
        }
        context += ` (Ch. ${book.chapter}, pp. ${book.pages[0]}-${book.pages[1]})\n`;
      });
    }

    if (aggregatedContent.slides && aggregatedContent.slides.length > 0) {
      context += '\n📊 LECTURE SLIDES:\n';
      aggregatedContent.slides.forEach((slide: any) => {
        context += `  - ${slide.title}\n`;
      });
    }

    context += '\n⚠️  Note: Full text extraction is still in progress. Answers may be limited.\n';
    
    return context;
  }

  // Include extracted text from each content item
  itemsWithText.forEach((item: any) => {
    const icon = {
      textbook: '📚',
      slides: '📊',
      homework: '📝',
      paper: '📄',
    }[item.content_type] || '📄';

    context += `${icon} ${item.title.toUpperCase()}\n`;
    context += `${'='.repeat(60)}\n`;
    
    // Truncate very long texts to fit in context window
    const maxChars = 8000; // Approximately 2k tokens per item
    const text = item.extracted_text.length > maxChars
      ? item.extracted_text.slice(0, maxChars) + '\n\n[Content truncated for length...]'
      : item.extracted_text;
    
    context += text;
    context += '\n\n';
  });

  context += `\nℹ️  You have access to ${itemsWithText.length} fully extracted course materials. Use this information to provide detailed, accurate answers.\n`;

  return context;
}


