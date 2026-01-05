
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://arumiloijqsxthlswojt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydW1pbG9panFzeHRobHN3b2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzUzNTEsImV4cCI6MjA3OTAxMTM1MX0.5EaB81wglbbtNi8FOzJoDMNd_aOmMULzm27pDClJDSg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyFilter() {
    console.log("Verifying Filter (Two-Step)...");

    // Step 1: Get Valid "Standalone" Case IDs (where scenario_text IS NULL)
    // Note: User data had some empty strings or just Titles.
    // Based on 'check_scenarios.js', we distinguish by scenario_text existing.

    // Query: scenario_text IS NULL OR length < 5 ? 
    // Supabase .is('scenario_text', null) is safest first.

    const { data: cases, error: cError } = await supabase
        .from('clinical_cases')
        .select('id, scenario_text')
        .or('scenario_text.is.null,scenario_text.eq.""');
    // We might need to handle empty string if text is ""

    if (cError) {
        console.error("Error fetching cases:", cError);
        return;
    }

    // Filter locally for safety if needed (e.g. length check)
    // But let's trust the query for now.
    const standaloneCaseIds = cases.map(c => c.id);
    console.log(`Found ${standaloneCaseIds.length} Standalone Cases (No Scenario).`);

    if (standaloneCaseIds.length === 0) return;

    // Step 2: Fetch Questions linked to these cases
    const { count, error: qError } = await supabase
        .from('questions_bank')
        .select('*', { count: 'exact', head: true })
        .in('clinical_case_id', standaloneCaseIds)
        .is('case_id', null) // Ensure no legacy grouping
        .eq('is_active', true);

    if (qError) console.error("Error fetching questions:", qError);
    else console.log(`Found ${count} Active Standalone Questions.`);
}

verifyFilter();
