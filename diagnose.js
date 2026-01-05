
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://arumiloijqsxthlswojt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydW1pbG9panFzeHRobHN3b2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzUzNTEsImV4cCI6MjA3OTAxMTM1MX0.5EaB81wglbbtNi8FOzJoDMNd_aOmMULzm27pDClJDSg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function diagnose() {
    console.log("Diagnosing questions_bank...");

    // 1. Total Active
    const { count: total, error: e1 } = await supabase.from('questions_bank').select('*', { count: 'exact', head: true }).eq('is_active', true);
    if (e1) console.error("Error Total:", e1);
    console.log("Total Active Questions:", total);

    // 2. Both NULL
    const { count: bothNull, error: e2 } = await supabase.from('questions_bank')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .is('case_id', null)
        .is('clinical_case_id', null);
    if (e2) console.error("Error Both Null:", e2);
    console.log("Questions with BOTH case_id AND clinical_case_id NULL (Current Query):", bothNull);

    // 3. case_id NULL
    const { count: caseNull, error: e3 } = await supabase.from('questions_bank')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .is('case_id', null);
    console.log("Questions with case_id NULL:", caseNull);

    // 4. clinical_case_id NULL
    const { count: clinNull, error: e4 } = await supabase.from('questions_bank')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .is('clinical_case_id', null);
    console.log("Questions with clinical_case_id NULL:", clinNull);

    // 5. Sample Data to see what's in there
    const { data: sample, error: e5 } = await supabase.from('questions_bank').select('id, case_id, clinical_case_id').limit(5);
    console.log("Sample Data:", sample);
}

diagnose();
