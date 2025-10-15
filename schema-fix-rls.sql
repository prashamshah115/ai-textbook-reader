-- ================================================================
-- RLS & ERROR FIXES - Run this after schema-day1-production.sql
-- ================================================================

-- 1. Fix metrics table - Add DEFAULT auth.uid() for user_id
-- This allows client-side inserts without explicitly passing user_id
ALTER TABLE metrics 
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 2. Add missing RLS policy for chat_conversations
-- (Might be missing from original schema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chat_conversations' 
    AND policyname = 'Users can view their own conversations'
  ) THEN
    CREATE POLICY "Users can view their own conversations"
      ON chat_conversations FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chat_conversations' 
    AND policyname = 'Users can insert their own conversations'
  ) THEN
    CREATE POLICY "Users can insert their own conversations"
      ON chat_conversations FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chat_conversations' 
    AND policyname = 'Users can update their own conversations'
  ) THEN
    CREATE POLICY "Users can update their own conversations"
      ON chat_conversations FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Ensure service_role can bypass RLS for all operations
GRANT ALL ON jobs TO service_role;
GRANT ALL ON events TO service_role;
GRANT ALL ON metrics TO service_role;
GRANT ALL ON textbooks TO service_role;
GRANT ALL ON pages TO service_role;
GRANT ALL ON ai_processed_content TO service_role;
GRANT ALL ON chat_conversations TO service_role;
GRANT ALL ON user_notes TO service_role;
GRANT ALL ON textbook_web_context TO service_role;

-- 4. Add helpful function to check RLS policies
CREATE OR REPLACE FUNCTION check_table_policies(table_name text)
RETURNS TABLE(policy_name text, policy_type text, policy_roles text[]) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    polname::text,
    CASE polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN '*' THEN 'ALL'
    END::text,
    polroles::text[]
  FROM pg_policy
  WHERE polrelid = table_name::regclass;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- SUCCESS MESSAGE
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ RLS Fixes Applied!';
  RAISE NOTICE '📊 Metrics table: user_id now auto-populates';
  RAISE NOTICE '🔐 Chat conversations: RLS policies ensured';
  RAISE NOTICE '🛡️  Service role: Full access granted';
  RAISE NOTICE '🔍 Helper function: check_table_policies() available';
  RAISE NOTICE '';
  RAISE NOTICE '📝 To verify policies, run: SELECT * FROM check_table_policies(''metrics'');';
END $$;

