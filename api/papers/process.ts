// Paper Processing API
// Based on Open Paper's proven PDF processing system
// Handles metadata extraction and preview generation

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Service key for admin operations
);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { paper_id } = req.body;

    if (!paper_id) {
      return res.status(400).json({ error: 'paper_id required' });
    }

    // Get paper from database
    const { data: paper, error: fetchError } = await supabase
      .from('papers')
      .select('*')
      .eq('id', paper_id)
      .single();

    if (fetchError || !paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Download PDF from storage
    const { data: pdfBlob, error: downloadError } = await supabase.storage
      .from('papers')
      .download(paper.storage_path);

    if (downloadError || !pdfBlob) {
      throw new Error('Failed to download PDF');
    }

    // Extract text using existing PDF extraction
    // (Your AI Textbook Reader already has this - reuse it!)
    const extractResponse = await fetch(
      `${process.env.RAILWAY_URL || 'http://localhost:8080'}/api/extract-pdf-text`,
      {
        method: 'POST',
        body: pdfBlob,
      }
    );

    if (!extractResponse.ok) {
      throw new Error('PDF extraction failed');
    }

    const extractData = await extractResponse.json();
    const fullText = extractData.pages.map((p: any) => p.text).join('\n\n');
    const pageCount = extractData.pages.length;

    // Extract metadata using AI (Open Paper's approach)
    const metadata = await extractMetadata(fullText);

    // Update paper with extracted data
    const { error: updateError } = await supabase
      .from('papers')
      .update({
        title: metadata.title || paper.title,
        authors: metadata.authors || [],
        abstract: metadata.abstract || null,
        total_pages: pageCount,
        metadata: {
          keywords: metadata.keywords || [],
          institutions: metadata.institutions || [],
          year: metadata.year,
        },
        status: 'completed',
      })
      .eq('id', paper_id);

    if (updateError) throw updateError;

    // Store extracted text in a separate table (for search)
    // This follows Open Paper's pattern of storing full text
    await storeExtractedText(paper_id, extractData.pages);

    return res.status(200).json({
      success: true,
      paper_id,
      metadata,
    });
  } catch (error: any) {
    console.error('Paper processing error:', error);

    // Update paper status to failed
    if (req.body.paper_id) {
      await supabase
        .from('papers')
        .update({
          status: 'failed',
          processing_error: error.message,
        })
        .eq('id', req.body.paper_id);
    }

    return res.status(500).json({
      error: 'Processing failed',
      message: error.message,
    });
  }
}

async function extractMetadata(text: string) {
  // Use first 3000 characters for metadata extraction (Open Paper's approach)
  const excerpt = text.slice(0, 3000);

  const prompt = `Extract metadata from this research paper excerpt. Return ONLY valid JSON.

Paper excerpt:
${excerpt}

Return this exact JSON structure:
{
  "title": "paper title",
  "authors": ["author1", "author2"],
  "abstract": "paper abstract or summary",
  "keywords": ["keyword1", "keyword2"],
  "institutions": ["institution1"],
  "year": 2024
}`;

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'You are a metadata extraction assistant. Return only valid JSON, no markdown.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || '{}';
    
    // Clean up response (remove markdown if present)
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Metadata extraction failed:', error);
    return {
      title: null,
      authors: [],
      abstract: null,
      keywords: [],
      institutions: [],
      year: null,
    };
  }
}

async function storeExtractedText(paperId: string, pages: any[]) {
  // Create a pages table entry for each page (similar to textbooks)
  // This enables full-text search and page-level operations
  
  // For now, we'll store in metadata. In production, you might want
  // a separate paper_pages table like textbooks have
  const { error } = await supabase
    .from('papers')
    .update({
      metadata: {
        pages: pages.map((p: any, idx: number) => ({
          page_number: idx + 1,
          text: p.text,
        })),
      },
    })
    .eq('id', paperId);

  if (error) {
    console.error('Failed to store extracted text:', error);
  }
}

