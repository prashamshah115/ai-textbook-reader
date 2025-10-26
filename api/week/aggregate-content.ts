import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PARALLEL_API_BASE = 'https://api.parallel.ai';

interface AggregateContentRequest {
  courseCode: string;
  institution: string;
  weekNumber: number;
  weekTopic: string;
  userId: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { courseCode, institution, weekNumber, weekTopic, userId }: AggregateContentRequest = req.body;

    if (!courseCode || !institution || !weekNumber || !weekTopic || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if bundle already exists
    const { data: existingBundle } = await supabase
      .from('week_bundles')
      .select('*')
      .eq('user_id', userId)
      .eq('course_code', courseCode)
      .eq('institution', institution)
      .eq('week_number', weekNumber)
      .single();

    if (existingBundle) {
      return res.status(200).json({
        bundleId: existingBundle.id,
        message: 'Bundle already exists',
        content: existingBundle.aggregated_content,
      });
    }

    // Aggregate content using Parallel AI
    const aggregatedContent = await aggregateWithParallel(
      courseCode,
      institution,
      weekNumber,
      weekTopic
    );

    // Create week bundle
    const { data: bundle, error: bundleError } = await supabase
      .from('week_bundles')
      .insert({
        user_id: userId,
        course_code: courseCode,
        course_name: getCourseFullName(courseCode),
        institution: institution,
        week_number: weekNumber,
        week_topic: weekTopic,
        parallel_run_id: aggregatedContent.parallelRunId,
        aggregated_content: aggregatedContent,
        status: 'active',
      })
      .select()
      .single();

    if (bundleError) {
      throw bundleError;
    }

    // Create content items
    const contentItems = [];

    // Add textbooks
    for (const [index, textbook] of aggregatedContent.textbooks.entries()) {
      contentItems.push({
        week_bundle_id: bundle.id,
        content_type: 'textbook',
        title: textbook.title,
        source_url: textbook.url,
        metadata: {
          authors: textbook.authors,
          pages: textbook.pages,
          chapter: textbook.chapter,
        },
        confidence_score: textbook.confidence,
        display_order: index,
      });
    }

    // Add slides
    for (const [index, slide] of aggregatedContent.slides.entries()) {
      contentItems.push({
        week_bundle_id: bundle.id,
        content_type: 'slides',
        title: slide.title,
        source_url: slide.url,
        metadata: {
          pages: slide.pages,
          professor: slide.professor,
        },
        confidence_score: slide.confidence,
        display_order: aggregatedContent.textbooks.length + index,
      });
    }

    // Add homework
    for (const [index, hw] of aggregatedContent.homework.entries()) {
      contentItems.push({
        week_bundle_id: bundle.id,
        content_type: 'homework',
        title: hw.assignment,
        source_url: hw.url,
        metadata: {
          problems: hw.problems,
          dueDate: hw.dueDate,
        },
        confidence_score: hw.confidence,
        display_order: aggregatedContent.textbooks.length + aggregatedContent.slides.length + index,
      });
    }

    // Add papers
    for (const [index, paper] of aggregatedContent.papers.entries()) {
      contentItems.push({
        week_bundle_id: bundle.id,
        content_type: 'paper',
        title: paper.title,
        source_url: paper.url,
        metadata: {
          authors: paper.authors,
          year: paper.year,
          venue: paper.venue,
        },
        confidence_score: paper.confidence,
        display_order: aggregatedContent.textbooks.length + aggregatedContent.slides.length + aggregatedContent.homework.length + index,
      });
    }

    // Insert all content items
    const { data: insertedItems, error: itemsError } = await supabase
      .from('content_items')
      .insert(contentItems)
      .select();

    if (itemsError) {
      throw itemsError;
    }

    // Trigger async extraction for all content items
    if (insertedItems && insertedItems.length > 0) {
      console.log(`[Aggregate Content] Triggering extraction for ${insertedItems.length} items`);
      
      // Fire and forget - don't await extraction
      Promise.all(
        insertedItems.map(async (item) => {
          if (item.source_url) {
            try {
              const extractResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/extract-content`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contentItemId: item.id }),
              });
              
              if (!extractResponse.ok) {
                console.error(`[Aggregate Content] Extraction failed for ${item.id}`);
              }
            } catch (err) {
              console.error(`[Aggregate Content] Extraction error for ${item.id}:`, err);
            }
          }
        })
      ).catch(err => {
        console.error('[Aggregate Content] Extraction batch error:', err);
      });
    }

    return res.status(200).json({
      bundleId: bundle.id,
      message: 'Week bundle created successfully',
      content: aggregatedContent,
      itemsCount: contentItems.length,
      extractionStatus: 'queued',
    });

  } catch (error) {
    console.error('Error aggregating content:', error);
    return res.status(500).json({ 
      error: 'Failed to aggregate content',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Aggregate content using Parallel AI
 */
async function aggregateWithParallel(
  courseCode: string,
  institution: string,
  weekNumber: number,
  weekTopic: string
): Promise<any> {
  const apiKey = process.env.PARALLEL_API_KEY;

  // If no API key, return mock data
  if (!apiKey) {
    console.warn('PARALLEL_API_KEY not configured, using mock data');
    return getMockData(courseCode, weekNumber, weekTopic);
  }

  const prompt = `
You are a course material aggregator. Find ALL relevant academic materials for this course week:

Course: ${courseCode} at ${institution}
Week: ${weekNumber}
Topic: ${weekTopic}

Find and categorize:

1. TEXTBOOKS: Identify relevant textbook chapters and page ranges
   - Provide title, authors, chapter number, and page range

2. LECTURE SLIDES: Find course slides from the professor
   - Look for official course websites, lecture PDFs
   - Include title, URL, total pages

3. HOMEWORK: Find problem sets and assignments
   - Problem set numbers and specific problem numbers
   - URLs to assignment PDFs

4. RESEARCH PAPERS: Find recent (2020-2025) research papers on the topic
   - Academic papers from conferences/journals
   - Include title, authors, year, venue, arxiv/doi URL

Return results in JSON format with confidence scores.
`;

  try {
    const response = await fetch(`${PARALLEL_API_BASE}/task`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: prompt,
        processor: 'pro',
        timeout: 60000,
        format: 'json',
      }),
    });

    if (!response.ok) {
      throw new Error(`Parallel API error: ${response.status}`);
    }

    const result = await response.json();
    return {
      ...result.output,
      parallelRunId: result.id,
      aggregatedAt: new Date().toISOString(),
    };

  } catch (error) {
    console.error('Parallel API failed, using mock data:', error);
    return getMockData(courseCode, weekNumber, weekTopic);
  }
}

/**
 * Mock data for development
 */
function getMockData(courseCode: string, weekNumber: number, weekTopic: string) {
  if (courseCode === 'CSE 120' && weekNumber === 3) {
    return {
      textbooks: [
        {
          title: 'Operating System Concepts',
          authors: ['Abraham Silberschatz', 'Peter Baer Galvin', 'Greg Gagne'],
          pages: [185, 220],
          chapter: 5,
          confidence: 0.95,
        },
        {
          title: 'Modern Operating Systems',
          authors: ['Andrew S. Tanenbaum', 'Herbert Bos'],
          pages: [73, 110],
          chapter: 2,
          confidence: 0.90,
        },
      ],
      slides: [
        {
          title: 'Week 3: Process Scheduling',
          url: 'https://cseweb.ucsd.edu/classes/sp24/cse120-a/lectures/week3-scheduling.pdf',
          pages: 45,
          professor: 'Prof. Geoffrey Voelker',
          confidence: 0.98,
        },
      ],
      homework: [
        {
          assignment: 'Problem Set 3',
          problems: ['3.1', '3.2', '3.3', '3.4'],
          url: 'https://cseweb.ucsd.edu/classes/sp24/cse120-a/homework/ps3.pdf',
          dueDate: '2024-02-15',
          confidence: 0.92,
        },
      ],
      papers: [
        {
          title: 'The Linux Completely Fair Scheduler',
          authors: ['Ingo Molnar'],
          url: 'https://www.kernel.org/doc/Documentation/scheduler/sched-design-CFS.txt',
          year: 2023,
          venue: 'Linux Kernel Documentation',
          confidence: 0.88,
        },
        {
          title: 'Lottery Scheduling: Flexible Proportional-Share Resource Management',
          authors: ['Carl A. Waldspurger', 'William E. Weihl'],
          url: 'https://www.usenix.org/legacy/publications/library/proceedings/osdi/full_papers/waldspurger.pdf',
          year: 1994,
          venue: 'OSDI',
          confidence: 0.85,
        },
      ],
      parallelRunId: 'mock-run-' + Date.now(),
      aggregatedAt: new Date().toISOString(),
    };
  }

  return {
    textbooks: [],
    slides: [],
    homework: [],
    papers: [],
    parallelRunId: 'mock-run-' + Date.now(),
    aggregatedAt: new Date().toISOString(),
  };
}

/**
 * Get full course name from course code
 */
function getCourseFullName(courseCode: string): string {
  const courseNames: Record<string, string> = {
    'CSE 120': 'Principles of Operating Systems',
    'CSE 130': 'Programming Languages',
    'CSE 140': 'Components and Design Techniques for Digital Systems',
  };

  return courseNames[courseCode] || courseCode;
}


