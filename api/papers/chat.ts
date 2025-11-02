// Paper Chat API - Stream AI responses with citations
// Based on Open Paper's proven chat system with citation extraction

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get user from auth token
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { conversation_id, content } = req.body;

    if (!conversation_id || !content) {
      return res.status(400).json({ error: 'conversation_id and content required' });
    }

    // Get conversation and paper
    const { data: conversation, error: convError } = await supabase
      .from('paper_conversations')
      .select('*')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get paper and its content
    const { data: paper, error: paperError } = await supabase
      .from('papers')
      .select('*')
      .eq('id', conversation.paper_id)
      .single();

    if (paperError || !paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Get conversation history
    const { data: messages } = await supabase
      .from('paper_messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(10);

    // Build context from paper
    const paperContext = buildPaperContext(paper);

    // Build system prompt
    const systemPrompt = `You are an AI research assistant helping users understand research papers.

CURRENT PAPER:
Title: ${paper.title}
Authors: ${paper.authors?.join(', ') || 'Unknown'}
Abstract: ${paper.abstract || 'Not available'}

${paperContext}

INSTRUCTIONS:
- Answer questions about this specific paper
- Be precise and cite specific sections when possible
- Use clear, academic language
- If information isn't in the paper, say so
- Reference page numbers when discussing specific content
- Help clarify complex concepts and methodologies

When citing content, format it as: [Page X] followed by your explanation.`;

    // Build message history
    const chatHistory = messages?.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })) || [];

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Save user message
    await supabase.from('paper_messages').insert({
      conversation_id,
      user_id: user.id,
      role: 'user',
      content,
    });

    // Stream response
    const stream = await groq.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...chatHistory,
        { role: 'user', content },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      stream: true,
    });

    let fullResponse = '';
    const citations: any[] = [];

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;

        // Send content chunk
        res.write(`data: ${JSON.stringify({ type: 'content', content })}\n\n`);

        // Extract citations (simple pattern: [Page X])
        const citationMatches = content.matchAll(/\[Page (\d+)\]/g);
        for (const match of citationMatches) {
          const pageNum = parseInt(match[1]);
          citations.push({
            page: pageNum,
            text: content.slice(Math.max(0, match.index! - 50), match.index! + 50),
            confidence: 0.9,
          });

          // Send citation
          res.write(
            `data: ${JSON.stringify({
              type: 'citation',
              citation: { page: pageNum, text: '', confidence: 0.9 },
            })}\n\n`
          );
        }
      }
    }

    // Save assistant message
    await supabase.from('paper_messages').insert({
      conversation_id,
      user_id: user.id,
      role: 'assistant',
      content: fullResponse,
      citations: citations.length > 0 ? citations : null,
      model: 'llama-3.1-70b-versatile',
    });

    // Send done signal
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Chat error:', error);
    res.write(
      `data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`
    );
    res.end();
  }
}

function buildPaperContext(paper: any): string {
  let context = '';

  // Add page excerpts if available
  if (paper.metadata?.pages) {
    const pages = paper.metadata.pages as any[];
    // Include first page, middle, and last for context
    const keyPages = [
      pages[0],
      pages[Math.floor(pages.length / 2)],
      pages[pages.length - 1],
    ].filter(Boolean);

    context += '\nKEY EXCERPTS:\n';
    keyPages.forEach((page: any) => {
      if (page.text) {
        context += `\n[Page ${page.page_number}]\n${page.text.slice(0, 500)}...\n`;
      }
    });
  }

  // Add keywords
  if (paper.metadata?.keywords && paper.metadata.keywords.length > 0) {
    context += `\nKEY CONCEPTS: ${paper.metadata.keywords.join(', ')}\n`;
  }

  return context;
}

