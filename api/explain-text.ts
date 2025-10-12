// Vercel Serverless Function for Text Explanation
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface ExplainRequest {
  text: string;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Check if GROQ API key is present
    if (!GROQ_API_KEY) {
      console.error('[Explain API] GROQ_API_KEY is not configured');
      return new Response(
        JSON.stringify({ 
          error: 'GROQ API key is not configured',
          details: 'The server is missing the GROQ_API_KEY environment variable'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body: ExplainRequest = await req.json();
    const { text } = body;

    if (!text || text.length > 1000) {
      return new Response(
        JSON.stringify({ 
          error: 'Text must be between 1 and 1000 characters',
          provided: text?.length || 0
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Explain API] Processing text:', text.substring(0, 50) + '...');

    // Call GROQ for explanation
    const groqResponse = await fetch(GROQ_API_URL, {
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
            content: 'You are a helpful tutor. Explain the given text clearly and concisely in 2-3 sentences. Use simple language.',
          },
          {
            role: 'user',
            content: `Explain this: "${text}"`,
          },
        ],
        temperature: 0.3,
        max_tokens: 150,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('[Explain API] GROQ API error:', groqResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: `GROQ API error: ${groqResponse.status}`,
          details: errorText.substring(0, 500),
          apiKeyPresent: !!GROQ_API_KEY,
          apiKeyPrefix: GROQ_API_KEY ? GROQ_API_KEY.substring(0, 10) + '...' : 'N/A'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const groqJson = await groqResponse.json();
    const explanation = groqJson.choices[0]?.message?.content || 'Unable to generate explanation';

    console.log('[Explain API] Success, explanation length:', explanation.length);

    return new Response(
      JSON.stringify({ explanation }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[Explain API] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate explanation',
        details: errorMessage,
        stack: errorStack?.substring(0, 500),
      }),
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

