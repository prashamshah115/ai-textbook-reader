/**
 * Test script for Parallel AI content aggregation
 * Run: npx tsx scripts/test-parallel.ts
 */

import { aggregateWeekContent } from '../src/lib/parallel';

async function testAggregation() {
  console.log('🔍 Testing Parallel AI Content Aggregation\n');
  console.log('='.repeat(60));
  
  try {
    console.log('\n📚 Aggregating content for CSE 120 Week 3...\n');
    
    const result = await aggregateWeekContent({
      courseCode: 'CSE 120',
      institution: 'UCSD',
      weekNumber: 3,
      weekTopic: 'Process Scheduling',
    });

    console.log('✅ Aggregation successful!\n');
    console.log('Run ID:', result.parallelRunId);
    console.log('Aggregated at:', result.aggregatedAt);
    console.log('\n' + '='.repeat(60));

    // Display textbooks
    console.log('\n📖 TEXTBOOKS FOUND:', result.textbooks.length);
    result.textbooks.forEach((book, i) => {
      console.log(`\n  ${i + 1}. ${book.title}`);
      if (book.authors) {
        console.log(`     Authors: ${book.authors.join(', ')}`);
      }
      console.log(`     Chapter: ${book.chapter}, Pages: ${book.pages[0]}-${book.pages[1]}`);
      console.log(`     Confidence: ${((book.confidence || 0) * 100).toFixed(0)}%`);
    });

    // Display slides
    console.log('\n\n📊 LECTURE SLIDES FOUND:', result.slides.length);
    result.slides.forEach((slide, i) => {
      console.log(`\n  ${i + 1}. ${slide.title}`);
      console.log(`     URL: ${slide.url}`);
      console.log(`     Pages: ${slide.pages}`);
      if (slide.professor) {
        console.log(`     Professor: ${slide.professor}`);
      }
      console.log(`     Confidence: ${((slide.confidence || 0) * 100).toFixed(0)}%`);
    });

    // Display homework
    console.log('\n\n📝 HOMEWORK FOUND:', result.homework.length);
    result.homework.forEach((hw, i) => {
      console.log(`\n  ${i + 1}. ${hw.assignment}`);
      console.log(`     Problems: ${hw.problems.join(', ')}`);
      if (hw.url) {
        console.log(`     URL: ${hw.url}`);
      }
      if (hw.dueDate) {
        console.log(`     Due: ${hw.dueDate}`);
      }
      console.log(`     Confidence: ${((hw.confidence || 0) * 100).toFixed(0)}%`);
    });

    // Display papers
    console.log('\n\n📄 RESEARCH PAPERS FOUND:', result.papers.length);
    result.papers.forEach((paper, i) => {
      console.log(`\n  ${i + 1}. ${paper.title}`);
      console.log(`     Authors: ${paper.authors.join(', ')}`);
      console.log(`     Year: ${paper.year}`);
      if (paper.venue) {
        console.log(`     Venue: ${paper.venue}`);
      }
      console.log(`     URL: ${paper.url}`);
      console.log(`     Confidence: ${((paper.confidence || 0) * 100).toFixed(0)}%`);
    });

    // Summary
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total materials found: ${
      result.textbooks.length +
      result.slides.length +
      result.homework.length +
      result.papers.length
    }`);
    console.log(`  - Textbooks: ${result.textbooks.length}`);
    console.log(`  - Slides: ${result.slides.length}`);
    console.log(`  - Homework: ${result.homework.length}`);
    console.log(`  - Papers: ${result.papers.length}`);
    console.log('\n✅ Test completed successfully!\n');

    // Output JSON for database insertion
    console.log('\n' + '='.repeat(60));
    console.log('📋 JSON OUTPUT (for database):');
    console.log('='.repeat(60));
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('\n❌ Error during aggregation:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testAggregation();



