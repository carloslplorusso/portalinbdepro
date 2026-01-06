-- Run this in your Supabase SQL Editor to fix the "new row violates row-level security policy" error.

-- 1. Enable RLS on the table (ensure it is enabled)
ALTER TABLE public.report_issues ENABLE ROW LEVEL SECURITY;

-- 2. Allow ANYONE (Authenticated or Anonymous) to INSERT a report
-- This fixes the error by allowing the "insert" operation.
CREATE POLICY "Enable insert for all users"
ON public.report_issues
FOR INSERT
WITH CHECK (true);

-- 3. (Optional) Allow users to see only their OWN reports
CREATE POLICY "Enable select for own reports"
ON public.report_issues
FOR SELECT
USING (auth.uid() = user_id);
