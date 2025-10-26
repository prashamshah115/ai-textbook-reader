import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load .env from parent directory
const envPath = path.join(__dirname, '..', '.env');
config({ path: envPath });

// Load the enriched data
const dataPath = path.join(__dirname, 'semaphores_enriched_final.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

// Get Supabase credentials from environment
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICEKEY;
const USER_ID = process.argv[2]; // Pass as first command line argument

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env file!');
  console.error('Expected: VITE_SUPABASE_URL and SUPABASE_SERVICEKEY');
  process.exit(1);
}

if (!USER_ID) {
  console.error('❌ Missing USER_ID!');
  console.error('\nUsage:');
  console.error('  npx tsx import-to-supabase.ts <YOUR_USER_ID>');
  console.error('\nTo get your user ID:');
  console.error('  1. Open your app in browser');
  console.error('  2. Open console (F12)');
  console.error('  3. Run: localStorage.getItem("supabase.auth.token")');
  console.error('  4. Look for "user.id" in the JSON');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function importData() {
  console.log('🚀 Starting import...\n');
  
  try {
    // Check if bundle already exists
    const { data: existing, error: checkError } = await supabase
      .from('week_bundles')
      .select('id')
      .eq('user_id', USER_ID)
      .eq('course_code', data.courseCode)
      .eq('institution', data.institution)
      .eq('week_number', data.weekNumber)
      .single();

    if (existing) {
      console.log('⚠️  Bundle already exists with ID:', existing.id);
      console.log('✅ Nothing to import!');
      return;
    }

    // Insert week bundle
    console.log('📦 Creating week bundle...');
    const { data: bundle, error: bundleError } = await supabase
      .from('week_bundles')
      .insert({
        user_id: USER_ID,
        course_code: data.courseCode,
        course_name: 'Principles of Operating Systems',
        institution: data.institution,
        week_number: data.weekNumber,
        week_topic: data.weekTopic,
        parallel_run_id: data.aggregatedContent.parallelRunId,
        aggregated_content: data.aggregatedContent,
        status: 'active',
      })
      .select()
      .single();

    if (bundleError) {
      throw bundleError;
    }

    console.log('✅ Created bundle:', bundle.id);

    // Prepare content items
    const contentItems: any[] = [];
    let order = 0;

    // Add textbooks
    for (const textbook of data.aggregatedContent.textbooks) {
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
        display_order: order++,
      });
    }

    // Add slides
    for (const slide of data.aggregatedContent.slides) {
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
        display_order: order++,
      });
    }

    // Add homework
    for (const hw of data.aggregatedContent.homework) {
      contentItems.push({
        week_bundle_id: bundle.id,
        content_type: 'homework',
        title: hw.assignment,
        source_url: hw.url,
        metadata: {
          problems: hw.problems,
        },
        confidence_score: hw.confidence,
        display_order: order++,
      });
    }

    // Add papers
    for (const paper of data.aggregatedContent.papers) {
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
        display_order: order++,
      });
    }

    // Insert content items
    console.log(`📚 Inserting ${contentItems.length} content items...`);
    const { error: itemsError } = await supabase
      .from('content_items')
      .insert(contentItems);

    if (itemsError) {
      throw itemsError;
    }

    console.log('✅ Inserted all content items!\n');
    console.log('═══════════════════════════════════════════');
    console.log('🎉 IMPORT COMPLETE!');
    console.log('═══════════════════════════════════════════');
    console.log(`Bundle ID: ${bundle.id}`);
    console.log(`Course: ${data.courseCode} - ${data.weekTopic}`);
    console.log(`Materials: ${contentItems.length} items`);
    console.log(`  📚 Textbooks: ${data.aggregatedContent.textbooks.length}`);
    console.log(`  📊 Slides: ${data.aggregatedContent.slides.length}`);
    console.log(`  📝 Homework: ${data.aggregatedContent.homework.length}`);
    console.log(`  📄 Papers: ${data.aggregatedContent.papers.length}`);
    console.log('\n🔗 View at: /week/' + bundle.id);

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

importData();

