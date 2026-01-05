
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://arumiloijqsxthlswojt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydW1pbG9panFzeHRobHN3b2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzUzNTEsImV4cCI6MjA3OTAxMTM1MX0.5EaB81wglbbtNi8FOzJoDMNd_aOmMULzm27pDClJDSg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkEmptyCases() {
    console.log("Checking for Cases with NO Patient Data...");

    // Fetch all cases
    const { data: cases, error } = await supabase.from('clinical_cases').select('*');

    if (error) {
        console.error("Error:", error);
        return;
    }

    let strictlyEmptyCount = 0;
    let scenarioOnlyCount = 0; // Has scenario but no patient data? (Unlikely)
    let fullDataCount = 0;

    const emptyCaseIds = [];

    cases.forEach(c => {
        // defined as: No Chief Complaint AND No Medical History AND No Age
        const hasData = (c.chief_complaint && c.chief_complaint.length > 2) ||
            (c.medical_history && c.medical_history.length > 2) ||
            (c.patient_age !== null);

        const hasScenario = (c.scenario_text && c.scenario_text.length > 2);

        if (!hasData && !hasScenario) {
            strictlyEmptyCount++;
            emptyCaseIds.push(c.id);
        }
    });

    console.log(`Total Cases: ${cases.length}`);
    console.log(`Strictly Empty Cases (No Patient Data, No Scenario): ${strictlyEmptyCount}`);

    if (strictlyEmptyCount > 0) {
        console.log("Example Empty Case ID:", emptyCaseIds[0]);

        // Check if there are questions linked to these
        const { count } = await supabase.from('questions_bank')
            .select('*', { count: 'exact', head: true })
            .in('clinical_case_id', emptyCaseIds)
            .eq('is_active', true);

        console.log(`Active Questions linked to Strict Empty Cases: ${count}`);
    } else {
        console.log("No strictly empty cases found. Every case has at least some data.");
    }
}

checkEmptyCases();
