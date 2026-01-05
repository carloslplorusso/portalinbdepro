
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://arumiloijqsxthlswojt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydW1pbG9panFzeHRobHN3b2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzUzNTEsImV4cCI6MjA3OTAxMTM1MX0.5EaB81wglbbtNi8FOzJoDMNd_aOmMULzm27pDClJDSg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkScenarios() {
    console.log("Checking Clinical Scenarios...");

    // 1. Get stats on scenario_text
    // We want to know:
    // - How many cases have scenario_text?
    // - How many are just 'Patient Data' specific?

    // Fetch all cases
    const { data: cases, error } = await supabase.from('clinical_cases').select('id, scenario_text');

    if (error) {
        console.error("Error:", error);
        return;
    }

    const total = cases.length;
    const withScenario = cases.filter(c => c.scenario_text && c.scenario_text.length > 5).length;
    const withoutScenario = total - withScenario;

    console.log(`Total Clinical Cases: ${total}`);
    console.log(`With Scenario Text (Item Sets?): ${withScenario}`);
    console.log(`Without Scenario Text (Standalone?): ${withoutScenario}`);

    // 2. Check a sample question linked to a case WITH scenario text
    // Can we find questions linked to these?
    const casesWithScenarioIds = cases.filter(c => c.scenario_text && c.scenario_text.length > 5).map(c => c.id);

    if (casesWithScenarioIds.length > 0) {
        const { count, error: qError } = await supabase.from('questions_bank')
            .select('*', { count: 'exact', head: true })
            .in('clinical_case_id', casesWithScenarioIds)
            .eq('is_active', true);

        console.log(`Questions linked to Scenario Cases: ${count}`);
    }
}

checkScenarios();
