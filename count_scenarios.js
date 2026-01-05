
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://arumiloijqsxthlswojt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydW1pbG9panFzeHRobHN3b2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzUzNTEsImV4cCI6MjA3OTAxMTM1MX0.5EaB81wglbbtNi8FOzJoDMNd_aOmMULzm27pDClJDSg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function countScenarios() {
    console.log("Counting Active Questions with Scenario Text...");

    // 1. Get IDs of cases that have scenarios
    const { data: cases, error: cError } = await supabase
        .from('clinical_cases')
        .select('id, scenario_text')
        .not('scenario_text', 'is', null)
        .neq('scenario_text', '');

    if (cError) {
        console.error("Error fetching cases:", cError);
        return;
    }

    // Filter strictly in JS just in case empty strings slipped through
    const scenarioCaseIds = cases.filter(c => c.scenario_text && c.scenario_text.trim().length > 0).map(c => c.id);

    console.log(`Cases with Scenario Text: ${scenarioCaseIds.length}`);

    // 2. Count Active Questions linked to these cases
    const { count, error: qError } = await supabase
        .from('questions_bank')
        .select('*', { count: 'exact', head: true })
        .in('clinical_case_id', scenarioCaseIds)
        .eq('is_active', true);

    if (qError) {
        console.error("Error fetching questions:", qError);
    } else {
        console.log(`Active Questions linked to Scenarios: ${count}`);
    }
}

countScenarios();
