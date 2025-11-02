/**
 * Parallel AI Integration
 * Client for content aggregation across multiple sources
 */

const PARALLEL_API_BASE = 'https://api.parallel.ai';

export interface WeekContentRequest {
  courseCode: string;
  institution: string;
  weekNumber: number;
  weekTopic: string;
}

export interface TextbookReference {
  title: string;
  authors?: string[];
  pages: [number, number];
  chapter?: number;
  url?: string;
  confidence?: number;
}

export interface SlideReference {
  title: string;
  url: string;
  pages: number;
  professor?: string;
  confidence?: number;
}

export interface HomeworkReference {
  assignment: string;
  problems: string[];
  url?: string;
  dueDate?: string;
  confidence?: number;
}

export interface PaperReference {
  title: string;
  authors: string[];
  url: string;
  year: number;
  venue?: string;
  confidence?: number;
}

export interface AggregatedContent {
  textbooks: TextbookReference[];
  slides: SlideReference[];
  homework: HomeworkReference[];
  papers: PaperReference[];
  parallelRunId?: string;
  aggregatedAt: string;
}

/**
 * Aggregates content for a specific course week using Parallel AI
 */
export async function aggregateWeekContent(
  request: WeekContentRequest
): Promise<AggregatedContent> {
  const apiKey = import.meta.env.VITE_PARALLEL_API_KEY;
  
  if (!apiKey) {
    throw new Error('PARALLEL_API_KEY not configured');
  }

  const prompt = `
You are a course material aggregator. Find ALL relevant academic materials for this course week:

Course: ${request.courseCode} at ${request.institution}
Week: ${request.weekNumber}
Topic: ${request.weekTopic}

Find and categorize:

1. TEXTBOOKS: Identify relevant textbook chapters and page ranges
   - Common OS textbooks: Silberschatz "Operating System Concepts", Tanenbaum "Modern Operating Systems"
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

Return comprehensive results with confidence scores for each item found.
`;

  try {
    // Use Parallel's Task API for deep research
    const response = await fetch(`${PARALLEL_API_BASE}/task`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: prompt,
        processor: 'pro', // Balance quality and cost
        timeout: 60000, // 60 seconds
        format: 'json',
      }),
    });

    if (!response.ok) {
      throw new Error(`Parallel API error: ${response.status}`);
    }

    const result = await response.json();
    
    // Parse and structure the response
    return parseParallelResponse(result);
  } catch (error) {
    console.error('Parallel aggregation failed:', error);
    
    // Return mock data for development/testing
    return getMockAggregatedContent(request);
  }
}

/**
 * Parse Parallel API response into structured content
 */
function parseParallelResponse(response: any): AggregatedContent {
  // Parse the actual Parallel response
  // This will need to be adjusted based on actual API response format
  const data = response.output || response;
  
  return {
    textbooks: data.textbooks || [],
    slides: data.slides || [],
    homework: data.homework || [],
    papers: data.papers || [],
    parallelRunId: response.id || response.run_id,
    aggregatedAt: new Date().toISOString(),
  };
}

/**
 * Mock data for development and testing
 */
function getMockAggregatedContent(request: WeekContentRequest): AggregatedContent {
  // Mock data for CSE 120 Week 3 - Process Scheduling
  if (request.courseCode === 'CSE 120' && request.weekNumber === 3) {
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
        {
          title: 'BFS vs CFS - Scheduler Comparison',
          authors: ['Con Kolivas'],
          url: 'https://ck-hack.blogspot.com/2013/10/bfs-vs-cfs-scheduler-comparison.html',
          year: 2023,
          venue: 'Blog Post',
          confidence: 0.75,
        },
      ],
      parallelRunId: 'mock-run-' + Date.now(),
      aggregatedAt: new Date().toISOString(),
    };
  }

  // Default empty response for other courses/weeks
  return {
    textbooks: [],
    slides: [],
    homework: [],
    papers: [],
    aggregatedAt: new Date().toISOString(),
  };
}

/**
 * Quick concept lookup using Parallel Search API
 */
export async function quickConceptLookup(concept: string): Promise<any> {
  const apiKey = import.meta.env.VITE_PARALLEL_API_KEY;
  
  if (!apiKey) {
    console.warn('PARALLEL_API_KEY not configured, skipping lookup');
    return null;
  }

  try {
    const response = await fetch(`${PARALLEL_API_BASE}/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `${concept} explanation examples applications`,
        max_results: 5,
      }),
    });

    if (!response.ok) {
      throw new Error(`Parallel Search API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Parallel search failed:', error);
    return null;
  }
}



