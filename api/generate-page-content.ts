// API endpoint to generate applications and practice questions for a specific page
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { textbookId, pageNumber } = req.body;

    if (!textbookId || !pageNumber) {
      return res.status(400).json({ error: 'Missing textbookId or pageNumber' });
    }

    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ API key not configured' });
    }

    console.log(`[GeneratePageContent] Processing page ${pageNumber} for textbook ${textbookId}`);

    // TRY CONTENT_ITEMS FIRST (week bundle extracted text), THEN PAGES
    let pageText: string | null = null;
    let pageData: any = null; // For storing AI content later
    
    // Try content_items first (prioritize extracted_text from course materials)
    const { data: contentItems } = await supabase
      .from('content_items')
      .select('extracted_text, title, content_type')
      .eq('extraction_status', 'completed')
      .not('extracted_text', 'is', null)
      .limit(3);
    
    if (contentItems && contentItems.length > 0) {
      console.log(`[GeneratePageContent] Found ${contentItems.length} extracted content items`);
      // Combine extracted texts (prioritize textbooks)
      const textbookItems = contentItems.filter(item => item.content_type === 'textbook');
      const relevantItems = textbookItems.length > 0 ? textbookItems : contentItems;
      
      pageText = relevantItems
        .map(item => `=== ${item.title} ===\n${item.extracted_text}`)
        .join('\n\n')
        .substring(0, 10000); // Limit to 10k chars
    }
    
    // Always get page record (for storage), fallback for text extraction
    const { data: fetchedPageData } = await supabase
      .from('pages')
      .select('*')
      .eq('textbook_id', textbookId)
      .eq('page_number', pageNumber)
      .maybeSingle();
    
    pageData = fetchedPageData;
    
    // Use page text if we didn't get it from content_items
    if (!pageText && pageData?.raw_text) {
      pageText = pageData.raw_text;
    }
    
    // If still no text, try on-demand extraction
    if (!pageText) {
      console.log('[GeneratePageContent] Page text not found, extracting on-demand...');
      
      try {
        const extractResponse = await fetch(`${req.headers.origin || 'http://localhost:5173'}/api/extract-single-page`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ textbookId, pageNumber }),
        });

        if (!extractResponse.ok) {
          throw new Error('On-demand extraction failed');
        }

        const { text } = await extractResponse.json();
        pageText = text;

        console.log('[GeneratePageContent] On-demand extraction successful');
      } catch (extractError) {
        console.error('[GeneratePageContent] On-demand extraction failed:', extractError);
        return res.status(503).json({ 
          error: 'Text not available. Check that content has been extracted.',
          code: 'TEXT_NOT_EXTRACTED',
          details: 'Try running the extraction script or wait for background processing.'
        });
      }
    }

    if (!pageText || pageText.trim().length < 50) {
      return res.status(400).json({ 
        error: 'Text is too short or empty',
        code: 'INSUFFICIENT_TEXT'
      });
    }

    console.log(`[GeneratePageContent] Generating content for ${pageText.length} characters of text`);

    // Generate Applications using GROQ
    const applicationsPrompt = `You are analyzing a textbook page. Based on the content below, identify 3-5 real-world applications or examples of how these concepts are used in practice.

For each application:
- Be specific and practical
- Mention real companies, technologies, or scenarios when possible
- Keep each application to 1-2 sentences

Page content:
${pageText.substring(0, 3000)}

Return ONLY a JSON array of strings, like: ["application 1", "application 2", "application 3"]`;

    const applicationsResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful teaching assistant. Always respond with valid JSON only, no markdown or extra text.',
          },
          {
            role: 'user',
            content: applicationsPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!applicationsResponse.ok) {
      const errorText = await applicationsResponse.text();
      console.error('[GeneratePageContent] GROQ applications error:', errorText);
      throw new Error(`GROQ API error: ${applicationsResponse.status}`);
    }

    const applicationsJson = await applicationsResponse.json();
    let applications: string[] = [];
    
    try {
      const applicationsText = applicationsJson.choices[0]?.message?.content || '[]';
      // Try to extract JSON from potential markdown code blocks
      const jsonMatch = applicationsText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        applications = JSON.parse(jsonMatch[0]);
      } else {
        applications = JSON.parse(applicationsText);
      }
    } catch (parseError) {
      console.error('[GeneratePageContent] Failed to parse applications:', parseError);
      applications = ['Unable to generate applications. Please try regenerating.'];
    }

    // Generate Practice Questions using GROQ
    const questionsPrompt = `You are creating practice questions for a textbook page. Based on the content below, generate 4-6 practice questions with answers.

For each question:
- Make it test understanding, not just memorization
- Include a mix of difficulties (easy, medium, hard)
- Provide a clear, educational answer (2-3 sentences)

Page content:
${pageText.substring(0, 3000)}

Return ONLY a JSON array like:
[
  {"question": "Q1 here", "answer": "A1 here", "difficulty": "easy"},
  {"question": "Q2 here", "answer": "A2 here", "difficulty": "medium"}
]`;

    const questionsResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful teaching assistant. Always respond with valid JSON only, no markdown or extra text.',
          },
          {
            role: 'user',
            content: questionsPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!questionsResponse.ok) {
      const errorText = await questionsResponse.text();
      console.error('[GeneratePageContent] GROQ questions error:', errorText);
      throw new Error(`GROQ API error: ${questionsResponse.status}`);
    }

    const questionsJson = await questionsResponse.json();
    let questions: Array<{ question: string; answer: string; difficulty: string }> = [];
    
    try {
      const questionsText = questionsJson.choices[0]?.message?.content || '[]';
      // Try to extract JSON from potential markdown code blocks
      const jsonMatch = questionsText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      } else {
        questions = JSON.parse(questionsText);
      }
    } catch (parseError) {
      console.error('[GeneratePageContent] Failed to parse questions:', parseError);
      questions = [{
        question: 'Unable to generate questions. Please try regenerating.',
        answer: 'Error occurred during generation.',
        difficulty: 'unknown'
      }];
    }

    // Store AI content (only if we have a page record)
    if (pageData && pageData.id) {
      const { data: existingContent } = await supabase
        .from('ai_processed_content')
        .select('id')
        .eq('page_id', pageData.id)
        .maybeSingle();

      if (existingContent) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('ai_processed_content')
          .update({
            applications,
            practice_questions: questions,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingContent.id);

        if (updateError) {
          console.error('[GeneratePageContent] Error updating content:', updateError);
        } else {
          console.log('[GeneratePageContent] Updated existing AI content');
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('ai_processed_content')
          .insert({
            page_id: pageData.id,
            applications,
            practice_questions: questions,
          });

        if (insertError) {
          console.error('[GeneratePageContent] Error inserting content:', insertError);
        } else {
          console.log('[GeneratePageContent] Inserted new AI content');
        }
      }
    } else {
      console.log('[GeneratePageContent] No page record - skipping AI content storage (content from week bundle)');
    }

    console.log(`[GeneratePageContent] Successfully generated ${applications.length} applications and ${questions.length} questions`);

    return res.status(200).json({
      success: true,
      applications,
      questions,
    });
  } catch (error) {
    console.error('[GeneratePageContent] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ 
      error: 'Failed to generate content',
      details: errorMessage,
    });
  }
}

export const config = {
  runtime: 'nodejs',
  maxDuration: 30, // 30 seconds should be enough for one page
};


