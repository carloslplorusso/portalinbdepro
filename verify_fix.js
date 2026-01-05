
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://arumiloijqsxthlswojt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydW1pbG9panFzeHRobHN3b2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzUzNTEsImV4cCI6MjA3OTAxMTM1MX0.5EaB81wglbbtNi8FOzJoDMNd_aOmMULzm27pDClJDSg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyFix() {
    console.log("Verifying Fix Logic...");

    // Simulate the NEW query logic (case_id IS NULL only)
    const { count: standAloneCount, error } = await supabase.from('questions_bank')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .is('case_id', null);

    // Attempting to match the code exactly: .is('case_id', null)

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Potential Stand Alone Questions with new logic:", standAloneCount);
        if (standAloneCount > 0) {
            console.log("SUCCESS: The new logic will find questions!");
        } else {
            console.log("FAILURE: Still 0 questions.");
        }
    }
}

verifyFix();
