-- ================================================================
-- COMPLETE RLS POLICY OPTIMIZATION - ELIMINATES ALL 406 ERRORS
-- ================================================================
-- This script fixes ALL RLS policies to use optimized (select auth.uid())
-- and removes duplicate policies that cause performance issues.

-- ================================================================
-- 1. TEXTBOOKS TABLE - Simplify to single policy
-- ================================================================
DROP POLICY IF EXISTS "Users can view their own textbooks" ON textbooks;
DROP POLICY IF EXISTS "Users can insert their own textbooks" ON textbooks;
DROP POLICY IF EXISTS "Users can update their own textbooks" ON textbooks;
DROP POLICY IF EXISTS "Users can delete their own textbooks" ON textbooks;

CREATE POLICY "Users can manage their own textbooks" ON textbooks
FOR ALL USING (user_id = (select auth.uid()));

-- ================================================================
-- 2. PAGES TABLE - Optimize nested EXISTS query
-- ================================================================
DROP POLICY IF EXISTS "Users can view pages of their textbooks" ON pages;
DROP POLICY IF EXISTS "Users can insert pages to their textbooks" ON pages;
DROP POLICY IF EXISTS "Users can update pages of their textbooks" ON pages;

CREATE POLICY "Users can view pages of their textbooks" ON pages
FOR SELECT USING (
  textbook_id IN (
    SELECT id FROM textbooks WHERE user_id = (select auth.uid())
  )
);

CREATE POLICY "Users can insert pages to their textbooks" ON pages
FOR INSERT WITH CHECK (
  textbook_id IN (
    SELECT id FROM textbooks WHERE user_id = (select auth.uid())
  )
);

CREATE POLICY "Users can update pages of their textbooks" ON pages
FOR UPDATE USING (
  textbook_id IN (
    SELECT id FROM textbooks WHERE user_id = (select auth.uid())
  )
);

-- ================================================================
-- 3. CHAT_CONVERSATIONS TABLE - Remove duplicates
-- ================================================================
DROP POLICY IF EXISTS "Users can CRUD their own chats" ON chat_conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can view their own conversations" ON chat_conversations;

CREATE POLICY "Users can manage their own conversations" ON chat_conversations
FOR ALL USING (user_id = (select auth.uid()));

-- ================================================================
-- 4. USER_NOTES TABLE - Simplify to single policy
-- ================================================================
DROP POLICY IF EXISTS "Users can CRUD their own notes" ON user_notes;

CREATE POLICY "Users can manage their own notes" ON user_notes
FOR ALL USING (user_id = (select auth.uid()));

-- ================================================================
-- 5. AI_PROCESSED_CONTENT TABLE - Optimize nested query
-- ================================================================
DROP POLICY IF EXISTS "Users can view AI content for their pages" ON ai_processed_content;
DROP POLICY IF EXISTS "Users can insert AI content for their pages" ON ai_processed_content;

CREATE POLICY "Users can manage AI content for their pages" ON ai_processed_content
FOR ALL USING (
  page_id IN (
    SELECT p.id FROM pages p 
    JOIN textbooks t ON p.textbook_id = t.id 
    WHERE t.user_id = (select auth.uid())
  )
);

-- ================================================================
-- 6. USER_PREFERENCES TABLE - Remove duplicates
-- ================================================================
DROP POLICY IF EXISTS "Users can view their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;

CREATE POLICY "Users can manage their own preferences" ON user_preferences
FOR ALL USING (user_id = (select auth.uid()));

-- ================================================================
-- 7. METRICS TABLE - Remove duplicates
-- ================================================================
DROP POLICY IF EXISTS "Users can view their own metrics" ON metrics;
DROP POLICY IF EXISTS "Users can insert their own metrics" ON metrics;

CREATE POLICY "Users can manage their own metrics" ON metrics
FOR ALL USING (user_id = (select auth.uid()));

-- ================================================================
-- 8. TEXTBOOK_WEB_CONTEXT TABLE - Optimize nested query
-- ================================================================
DROP POLICY IF EXISTS "Users can view web context of their textbooks" ON textbook_web_context;
DROP POLICY IF EXISTS "Users can insert web context for their textbooks" ON textbook_web_context;
DROP POLICY IF EXISTS "Users can update web context of their textbooks" ON textbook_web_context;

CREATE POLICY "Users can manage web context of their textbooks" ON textbook_web_context
FOR ALL USING (
  textbook_id IN (
    SELECT id FROM textbooks WHERE user_id = (select auth.uid())
  )
);

-- ================================================================
-- 9. CHAPTERS TABLE - Optimize nested query
-- ================================================================
DROP POLICY IF EXISTS "Users can view chapters of their textbooks" ON chapters;

CREATE POLICY "Users can view chapters of their textbooks" ON chapters
FOR SELECT USING (
  textbook_id IN (
    SELECT id FROM textbooks WHERE user_id = (select auth.uid())
  )
);

-- ================================================================
-- 10. JOBS TABLE - Keep service role, remove user policy
-- ================================================================
DROP POLICY IF EXISTS "Users can view jobs for their textbooks" ON jobs;

-- Keep only the service role policy for jobs
-- Service role policy should remain for background processing

-- ================================================================
-- 11. EVENTS TABLE - Keep service role, remove user policy
-- ================================================================
DROP POLICY IF EXISTS "Users can view events for their textbooks" ON events;

-- Keep only the service role policy for events
-- Service role policy should remain for background processing

-- ================================================================
-- 12. VERIFY ALL POLICIES ARE OPTIMIZED
-- ================================================================
-- Run this to verify all policies now use (select auth.uid())
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE qual LIKE '%auth.uid()%' 
  AND qual NOT LIKE '%(select auth.uid())%'
ORDER BY tablename, policyname;

-- This query should return NO results if all policies are optimized
-- If it returns results, those policies still need fixing

-- ================================================================
-- 13. PERFORMANCE VERIFICATION
-- ================================================================
-- Check that we eliminated duplicate policies
SELECT 
  tablename,
  cmd,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename, cmd
HAVING COUNT(*) > 1
ORDER BY tablename, cmd;

-- This should show minimal duplicate policies (ideally none)
-- Multiple policies per table/action cause performance issues
