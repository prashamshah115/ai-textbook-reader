// Health Check Endpoint - Tests API configuration
export default async function handler(_req: Request) {
  const results: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // Check 1: Environment Variables
  results.checks.env = {
    GROQ_API_KEY: process.env.GROQ_API_KEY ? '✅ Set' : '❌ Missing',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing',
    SUPABASE_URL: process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? '✅ Set' : '❌ Missing',
  };

  // Check 2: GROQ API Connection
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
            { role: 'user', content: 'test' }
          ],
          max_tokens: 5,
        }),
      });

      if (groqResponse.ok) {
        results.checks.groq = '✅ Connected';
      } else {
        const errorText = await groqResponse.text();
        results.checks.groq = `❌ Error ${groqResponse.status}: ${errorText.substring(0, 100)}`;
      }
    } catch (error) {
      results.checks.groq = `❌ ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  } else {
    results.checks.groq = '⏭️ Skipped (no API key)';
  }

  // Check 3: OpenAI API Connection
  if (process.env.OPENAI_API_KEY) {
    try {
      const openaiResponse = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      });

      if (openaiResponse.ok) {
        results.checks.openai = '✅ Connected';
      } else {
        results.checks.openai = `❌ Error ${openaiResponse.status}`;
      }
    } catch (error) {
      results.checks.openai = `❌ ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  } else {
    results.checks.openai = '⏭️ Skipped (no API key)';
  }

  // Check 4: Supabase Connection
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    try {
      const supabaseResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        },
      });

      if (supabaseResponse.ok || supabaseResponse.status === 404) {
        results.checks.supabase = '✅ Connected';
      } else {
        results.checks.supabase = `❌ Error ${supabaseResponse.status}`;
      }
    } catch (error) {
      results.checks.supabase = `❌ ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  } else {
    results.checks.supabase = '⏭️ Skipped (missing credentials)';
  }

  // Determine overall status
  const hasErrors = Object.values(results.checks).some(check => {
    if (typeof check === 'string') {
      return check.includes('❌');
    }
    if (typeof check === 'object' && check !== null) {
      return Object.values(check).some(v => typeof v === 'string' && v.includes('❌'));
    }
    return false;
  });

  if (hasErrors) {
    results.status = 'error';
  }

  return new Response(
    JSON.stringify(results, null, 2),
    {
      status: hasErrors ? 500 : 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

export const config = {
  runtime: 'edge',
};

