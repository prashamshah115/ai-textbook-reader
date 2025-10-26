import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize clients
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface GenerateNotesRequest {
  bundleId: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { bundleId }: GenerateNotesRequest = req.body;

    if (!bundleId) {
      return res.status(400).json({ error: 'Missing required field: bundleId' });
    }

    // Fetch the week bundle
    const { data: bundle, error: bundleError } = await supabase
      .from('week_bundles')
      .select('*')
      .eq('id', bundleId)
      .single();

    if (bundleError || !bundle) {
      return res.status(404).json({ error: 'Week bundle not found' });
    }

    // Fetch all content items with extracted text
    const { data: contentItems, error: itemsError } = await supabase
      .from('content_items')
      .select('*')
      .eq('week_bundle_id', bundleId)
      .eq('extraction_status', 'completed')
      .not('extracted_text', 'is', null);

    if (itemsError) {
      throw itemsError;
    }

    if (!contentItems || contentItems.length === 0) {
      return res.status(400).json({ 
        error: 'No extracted text available for this bundle',
        message: 'Please wait for content extraction to complete'
      });
    }

    console.log(`[Generate Notes] Found ${contentItems.length} items with extracted text`);

    // Concatenate all extracted text
    const allText = contentItems
      .map(item => `## ${item.title}\n\n${item.extracted_text}`)
      .join('\n\n---\n\n');

    // Truncate if too long (GPT-4 context limit)
    const maxChars = 50000; // Approximately 12k tokens
    const truncatedText = allText.length > maxChars 
      ? allText.slice(0, maxChars) + '\n\n[Content truncated...]'
      : allText;

    console.log(`[Generate Notes] Processing ${truncatedText.length} characters`);

    // Generate notes using OpenAI
    const autoNotes = await generateNotesWithAI(
      bundle.course_code,
      bundle.week_number,
      bundle.week_topic,
      truncatedText
    );

    // Update the bundle with auto-generated notes
    const { error: updateError } = await supabase
      .from('week_bundles')
      .update({ 
        aggregated_content: {
          ...bundle.aggregated_content,
          autoNotes,
        }
      })
      .eq('id', bundleId);

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({
      success: true,
      notes: autoNotes,
      message: 'Auto-notes generated successfully',
    });

  } catch (error) {
    console.error('[Generate Notes] Error:', error);
    return res.status(500).json({
      error: 'Failed to generate notes',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Generate structured notes using OpenAI
 */
async function generateNotesWithAI(
  courseCode: string,
  weekNumber: number,
  weekTopic: string,
  extractedText: string
): Promise<string> {
  const prompt = `You are an expert teaching assistant for ${courseCode}. Generate comprehensive, well-structured notes for Week ${weekNumber}: ${weekTopic}.

Use the following course materials as your source:

${extractedText}

Please generate notes with the following structure:

# Week ${weekNumber}: ${weekTopic}

## Overview
[Brief overview of the week's topic]

## Key Concepts
[List and explain the main concepts with clear definitions]

## Important Points
[Highlight critical information, algorithms, or formulas]

## Examples
[Provide 1-2 concrete examples that illustrate the concepts]

## Common Misconceptions
[Address typical student confusions or errors]

## Practice Questions
[Generate 3-5 practice questions with varying difficulty]

## Summary
[Brief summary of what was covered]

Keep the notes:
- Clear and concise
- Well-structured with markdown formatting
- Focused on understanding, not memorization
- Suitable for exam preparation

Generate the notes now:`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: 'You are an expert teaching assistant who creates excellent study notes from course materials.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });

  return completion.choices[0]?.message?.content || 'Failed to generate notes';
}
