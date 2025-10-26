#!/usr/bin/env ts-node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICEKEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const { error } = await supabase
    .from('content_items')
    .update({ extraction_status: 'pending', extraction_error: null })
    .eq('extraction_status', 'failed');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ Reset all failed items to pending');
  }
}

main();

