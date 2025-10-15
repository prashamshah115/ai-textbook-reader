-- ================================================================
-- RLS POLICY VERIFICATION SCRIPT
-- ================================================================
-- Run this to check the current state of your RLS policies

-- 1. Check for policies still using inefficient auth.uid() calls
SELECT 
  'INEFFICIENT POLICIES' as check_type,
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE qual LIKE '%auth.uid()%' 
  AND qual NOT LIKE '%(select auth.uid())%'
ORDER BY tablename, policyname;

-- 2. Check for duplicate policies (performance issue)
SELECT 
  'DUPLICATE POLICIES' as check_type,
  tablename,
  cmd,
  COUNT(*) as policy_count,
  STRING_AGG(policyname, ', ') as policy_names
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename, cmd
HAVING COUNT(*) > 1
ORDER BY tablename, cmd;

-- 3. Check all current policies
SELECT 
  'ALL POLICIES' as check_type,
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- 4. Check which tables have RLS enabled
SELECT 
  'RLS STATUS' as check_type,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN (
    'textbooks', 'pages', 'chat_conversations', 'user_notes',
    'ai_processed_content', 'user_preferences', 'metrics',
    'textbook_web_context', 'chapters', 'jobs', 'events'
  )
ORDER BY tablename;
