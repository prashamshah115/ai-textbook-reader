#!/usr/bin/env ts-node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICEKEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   VITE_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICEKEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🚀 Creating CSE 120 Week 3 bundle...\n');

  // Read scraped data
  const data = JSON.parse(readFileSync('./scripts/week3_real_data.json', 'utf-8'));

  // Get user ID using admin auth
  const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
  if (userError || !users || users.length === 0) {
    console.error('❌ No users found:', userError);
    process.exit(1);
  }
  const userId = users[0].id;
  console.log(`Using user: ${userId}\n`);

  // Create week bundle
  const { data: bundle, error: bundleError } = await supabase
    .from('week_bundles')
    .insert({
      user_id: userId,
      course_code: data.courseCode,
      course_name: 'Principles of Operating Systems',
      institution: data.institution,
      week_number: data.weekNumber,
      week_topic: data.weekTopic,
      aggregated_content: data.aggregatedContent,
      status: 'active',
    })
    .select()
    .single();

  if (bundleError) {
    console.error('❌ Error creating bundle:', bundleError);
    process.exit(1);
  }

  console.log(`✅ Bundle created: ${bundle.id}\n`);

  // Create content items
  const contentItems = [];

  // Add textbooks
  for (const [index, textbook] of data.aggregatedContent.textbooks.entries()) {
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
      extraction_status: 'pending',
    });
  }

  // Add slides
  for (const [index, slide] of data.aggregatedContent.slides.entries()) {
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
      display_order: data.aggregatedContent.textbooks.length + index,
      extraction_status: 'pending',
    });
  }

  // Add papers
  for (const [index, paper] of data.aggregatedContent.papers.entries()) {
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
      display_order: data.aggregatedContent.textbooks.length + data.aggregatedContent.slides.length + index,
      extraction_status: 'pending',
    });
  }

  const { error: itemsError } = await supabase
    .from('content_items')
    .insert(contentItems);

  if (itemsError) {
    console.error('❌ Error creating content items:', itemsError);
    process.exit(1);
  }

  console.log(`✅ Created ${contentItems.length} content items\n`);
  console.log('📊 Summary:');
  console.log(`   Textbooks: ${data.aggregatedContent.textbooks.length}`);
  console.log(`   Slides: ${data.aggregatedContent.slides.length}`);
  console.log(`   Papers: ${data.aggregatedContent.papers.length}`);
  console.log(`\n✨ Bundle ID: ${bundle.id}`);
  console.log(`\nNext: Run extraction to get real text from URLs`);
  console.log(`   ts-node extract-all-content.ts\n`);
}

main().catch(console.error);

