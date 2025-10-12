// Comprehensive Debug Endpoint
import { createClient } from '@supabase/supabase-js';

export default async function handler(_req: Request) {
  const results: any = {
    timestamp: new Date().toISOString(),
    environment: {},
    groq: {},
    openai: {},
    supabase: {},
  };

  // 1. Check Environment Variables
  results.environment = {
    GROQ_API_KEY: process.env.GROQ_API_KEY ? {
      present: true,
      prefix: process.env.GROQ_API_KEY.substring(0, 10) + '...',
      length: process.env.GROQ_API_KEY.length,
    } : { present: false },
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? {
      present: true,
      prefix: process.env.OPENAI_API_KEY.substring(0, 10) + '...',
      length: process.env.OPENAI_API_KEY.length,
    } : { present: false },
    SUPABASE_URL: process.env.SUPABASE_URL || 'MISSING',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? {
      present: true,
      prefix: process.env.SUPABASE_SERVICE_KEY.substring(0, 20) + '...',
      length: process.env.SUPABASE_SERVICE_KEY.length,
    } : { present: false },
  };

  // 2. Test GROQ API
  if (process.env.GROQ_API_KEY) {
    try {
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Say "test successful"' }
          ],
          max_tokens: 10,
        }),
      });

      const responseText = await groqResponse.text();
      
      if (groqResponse.ok) {
        try {
          const data = JSON.parse(responseText);
          results.groq = {
            status: 'SUCCESS',
            statusCode: groqResponse.status,
            response: data.choices?.[0]?.message?.content || 'No content',
          };
        } catch {
          results.groq = {
            status: 'SUCCESS_BUT_INVALID_JSON',
            statusCode: groqResponse.status,
            rawResponse: responseText.substring(0, 200),
          };
        }
      } else {
        results.groq = {
          status: 'FAILED',
          statusCode: groqResponse.status,
          error: responseText.substring(0, 500),
        };
      }
    } catch (error) {
      results.groq = {
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  } else {
    results.groq = { status: 'SKIPPED', reason: 'No API key' };
  }

  // 3. Test OpenAI API
  if (process.env.OPENAI_API_KEY) {
    try {
      const openaiResponse = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      });

      if (openaiResponse.ok) {
        results.openai = { status: 'SUCCESS', statusCode: openaiResponse.status };
      } else {
        const errorText = await openaiResponse.text();
        results.openai = {
          status: 'FAILED',
          statusCode: openaiResponse.status,
          error: errorText.substring(0, 500),
        };
      }
    } catch (error) {
      results.openai = {
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  } else {
    results.openai = { status: 'SKIPPED', reason: 'No API key' };
  }

  // 4. Test Supabase Connection
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    try {
      // Test 1: Basic REST API call
      const restResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        },
      });

      results.supabase.rest = {
        status: restResponse.ok || restResponse.status === 404 ? 'SUCCESS' : 'FAILED',
        statusCode: restResponse.status,
      };

      // Test 2: Try to create Supabase client
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_KEY
        );

        // Test 3: Try a simple query
        const { data, error } = await supabase
          .from('textbooks')
          .select('id')
          .limit(1);

        if (error) {
          results.supabase.query = {
            status: 'FAILED',
            error: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          };
        } else {
          results.supabase.query = {
            status: 'SUCCESS',
            resultCount: data?.length || 0,
          };
        }
      } catch (clientError) {
        results.supabase.client = {
          status: 'ERROR',
          message: clientError instanceof Error ? clientError.message : 'Unknown error',
        };
      }
    } catch (error) {
      results.supabase.error = {
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  } else {
    results.supabase = { status: 'SKIPPED', reason: 'Missing credentials' };
  }

  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config = {
  runtime: 'edge',
};

