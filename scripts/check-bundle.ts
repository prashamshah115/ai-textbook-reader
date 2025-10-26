#!/usr/bin/env ts-node
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICEKEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  // Check bundles
  const { data: bundles } = await supabase
    .from('week_bundles')
    .select('*')
    .eq('course_code', 'CSE 120')
    .eq('week_number', 3);

  console.log('📦 Week Bundles:', JSON.stringify(bundles, null, 2));

  if (bundles && bundles.length > 0) {
    const bundleId = bundles[0].id;
    const { data: items } = await supabase
      .from('content_items')
      .select('*')
      .eq('week_bundle_id', bundleId);

    console.log(`\n📚 Content Items for bundle ${bundleId}:`, JSON.stringify(items, null, 2));
  }
}

main().catch(console.error);

