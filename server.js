const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const pdfParse = require('pdf-parse');

dotenv.config();

// DEBUG: Check environment variables
console.log('==================== ENVIRONMENT DEBUG ====================');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
console.log('SUPABASE_URL value:', process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.substring(0, 30)}...` : '❌ MISSING');
console.log('SUPABASE_SERVICE_KEY exists:', !!process.env.SUPABASE_SERVICE_KEY);
console.log('SUPABASE_SERVICE_KEY value:', process.env.SUPABASE_SERVICE_KEY ? `${process.env.SUPABASE_SERVICE_KEY.substring(0, 30)}...` : '❌ MISSING');
console.log('EXTRACTION_API_KEY exists:', !!process.env.EXTRACTION_API_KEY);
console.log('EXTRACTION_API_KEY value:', process.env.EXTRACTION_API_KEY ? `${process.env.EXTRACTION_API_KEY.substring(0, 20)}...` : '❌ MISSING');
console.log('All env keys containing SUPABASE or EXTRACTION:');
console.log(Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('EXTRACTION')));
console.log('Total environment variables:', Object.keys(process.env).length);
console.log('===========================================================');

// Validate required environment variables before creating Supabase client
if (!process.env.SUPABASE_URL) {
  console.error('❌ FATAL: SUPABASE_URL is not set in environment variables');
  console.error('Available variables:', Object.keys(process.env).join(', '));
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ FATAL: SUPABASE_SERVICE_KEY is not set in environment variables');
  process.exit(1);
}

if (!process.env.EXTRACTION_API_KEY) {
  console.error('⚠️  WARNING: EXTRACTION_API_KEY is not set - API will be unprotected!');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Supabase client
console.log('✅ Initializing Supabase client...');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
console.log('✅ Supabase client initialized successfully');

// API Key authentication middleware
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.EXTRACTION_API_KEY) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid or missing API key' 
    });
  }
  
  next();
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'pdf-extraction-service',
    timestamp: new Date().toISOString()
  });
});

// Main extraction endpoint
app.post('/extract', authenticateApiKey, async (req, res) => {
  const { textbookId, pdfUrl } = req.body;

  if (!textbookId || !pdfUrl) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['textbookId', 'pdfUrl']
    });
  }

  console.log(`[Extraction Service] Starting extraction for textbook ${textbookId}`);

  try {
    // Update status to processing
    await supabase
      .from('textbooks')
      .update({ 
        processing_status: 'processing',
        processing_started_at: new Date().toISOString(),
        processing_progress: 0
      })
      .eq('id', textbookId);

    // Download PDF from Supabase Storage
    console.log(`[Extraction Service] Downloading PDF from: ${pdfUrl}`);
    const pdfResponse = await fetch(pdfUrl);
    
    if (!pdfResponse.ok) {
      throw new Error(`Failed to download PDF: ${pdfResponse.statusText}`);
    }

    const arrayBuffer = await pdfResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[Extraction Service] PDF downloaded, size: ${buffer.length} bytes`);

    // Extract text from PDF
    console.log(`[Extraction Service] Extracting text...`);
    const pdfData = await pdfParse(buffer);
    
    const totalPages = pdfData.numpages;
    console.log(`[Extraction Service] Extracted ${totalPages} pages`);

    // Split text by pages (form feed character '\f' separates pages)
    const pageTexts = pdfData.text.split('\f');

    // Create page records
    const pageRecords = pageTexts.map((text, index) => ({
      textbook_id: textbookId,
      page_number: index + 1,
      raw_text: text.trim() || `[Page ${index + 1} - No extractable text]`,
      processed: false,
    }));

    // Insert pages in batches
    const batchSize = 100;
    let processedCount = 0;

    for (let i = 0; i < pageRecords.length; i += batchSize) {
      const batch = pageRecords.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('pages')
        .insert(batch);

      if (insertError) {
        console.error(`[Extraction Service] Insert error:`, insertError);
        throw insertError;
      }

      processedCount += batch.length;
      const progress = Math.round((processedCount / totalPages) * 100);

      // Update progress
      await supabase
        .from('textbooks')
        .update({ 
          processing_progress: progress,
          metadata: {
            last_processed_page: processedCount,
            total_pages: totalPages
          }
        })
        .eq('id', textbookId);

      console.log(`[Extraction Service] Progress: ${progress}% (${processedCount}/${totalPages})`);
    }

    // Update status to completed
    await supabase
      .from('textbooks')
      .update({ 
        processing_status: 'completed',
        processing_completed_at: new Date().toISOString(),
        processing_progress: 100,
        total_pages: totalPages
      })
      .eq('id', textbookId);

    console.log(`[Extraction Service] Completed extraction for textbook ${textbookId}`);

    res.json({ 
      success: true,
      textbookId,
      totalPages,
      message: 'PDF extraction completed successfully'
    });

  } catch (error) {
    console.error('[Extraction Service] Error:', error);

    // Update status to failed
    await supabase
      .from('textbooks')
      .update({ 
        processing_status: 'failed',
        processing_error: error.message || 'Unknown error'
      })
      .eq('id', textbookId);

    res.status(500).json({ 
      error: 'Extraction failed',
      details: error.message || 'Unknown error'
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 PDF Extraction Service running on port ${PORT}`);
  console.log(`📍 Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`📍 Public URL will be provided by Railway`);
});
